/**
 * General Manager (Component III)
 *
 * Routes every request through three tiers:
 * 1. Slash commands (/task, /note, etc.) — zero AI cost
 * 2. Natural language rules — zero AI cost
 * 3. AI classification — cheap model fallback
 *
 * Then dispatches to the appropriate domain manager.
 *
 * IQ: 3/10 — mostly routing, minimal AI
 * Access: 9/10 — can see all domains
 * Usage: 7/10 — every request goes through it
 */

import type { AgentContext, AssistantResponse, Domain, RoutedCommand, ToolResult } from '../types.ts'
import { parseSlashCommand, parseLegacyFlag } from './command-parser.ts'
import { matchRules, matchDynamicRules, loadDynamicRules } from './rule-engine.ts'
import { AICallCollector } from './ai-wrapper.ts'
import { PipelineTracker, safeExecute } from './error-handler.ts'
import { getManager } from '../managers/index.ts'
import { logInteraction } from '../tools/learnings.tool.ts'
import { logError } from './error-logger.ts'
import { runAgentLoop, type AgentLoopResult } from './agent-loop.ts'

/**
 * Build an AssistantResponse from an agent-loop run.
 * Aggregates per-step results so the UI can render ✓/✗ for each step.
 */
function buildAgentResponse(input: string, loop: AgentLoopResult): AssistantResponse {
  const anyFailed = loop.steps.some(s => !s.result.success)
  const isEmpty = loop.steps.length === 0 && !loop.finalText

  // Empty case: model returned no tool calls AND no text. Surface as a soft clarify
  // (amber styling), not a hard error — user's input was understood as English but
  // the model declined to act.
  if (isEmpty) {
    return {
      success: true,
      intent: 'general.question',
      domain: 'extra',
      action_taken: `I didn't pick a tool for that. Could you rephrase, or try a slash command? (e.g. "/task ${input.slice(0, 40)}")`,
      data: {
        clarify: true,
        stoppedReason: loop.stoppedReason,
      },
      steps: [],
    }
  }

  const overallSuccess = loop.steps.length === 0
    ? loop.finalText.length > 0
    : loop.steps.every(s => s.result.success)

  const firstStep = loop.steps[0]
  const intent: string = firstStep?.action ?? 'general.question'
  const domain: Domain = firstStep?.domain ?? 'extra'

  const actionTaken = loop.finalText
    ? loop.finalText
    : loop.steps.map(s => `${s.result.success ? '✓' : '✗'} ${s.result.action_taken}`).join('\n')

  const suggestions = loop.steps
    .flatMap(s => s.result.suggestions ?? [])
    .filter((v, i, a) => v && a.indexOf(v) === i)
    .slice(0, 4)

  return {
    success: overallSuccess,
    intent,
    domain,
    action_taken: actionTaken,
    data: {
      stoppedReason: loop.stoppedReason,
      anyFailed,
    },
    suggestions: suggestions.length > 0 ? suggestions : undefined,
    steps: loop.steps,
  }
}

/**
 * If any step failed, persist a structured failure report (non-blocking) so
 * the user can debug it later. Reuses the existing assistant_error_logs table;
 * the full transcript goes into the context JSONB column.
 */
function maybeLogFailureReport(input: string, loop: AgentLoopResult, context: AgentContext): void {
  // Empty-loop case (model gave no tool calls AND no text) — log so we can debug
  // why the agent declined. Reuses the same table as step failures.
  if (loop.steps.length === 0 && !loop.finalText) {
    logError(
      {
        userId: context.userId,
        input,
        errorType: 'execution_error',
        errorMessage: 'Agent loop returned no tool calls and no text',
        step: 'ai_conversation',
        domain: 'extra',
        intent: 'general.question',
        routingMethod: 'ai',
        aiProvider: context.aiConfig?.provider,
        aiModel: context.aiConfig?.model,
        context: {
          stopped_reason: loop.stoppedReason,
          total_tokens: loop.totalTokens,
          transcript: loop.transcript,
        },
      },
      context.supabase
    )
    return
  }

  if (!loop.steps.some(s => !s.result.success)) return
  const failedSteps = loop.steps.filter(s => !s.result.success)
  for (const step of failedSteps) {
    logError(
      {
        userId: context.userId,
        input,
        errorType: 'execution_error',
        errorMessage: step.result.action_taken,
        step: 'ai_conversation',
        domain: step.domain,
        intent: step.action,
        routingMethod: 'ai',
        aiProvider: context.aiConfig?.provider,
        aiModel: context.aiConfig?.model,
        context: {
          step_id: step.id,
          step_params: step.params,
          step_data: step.result.data,
          all_steps: loop.steps.map(s => ({
            id: s.id,
            domain: s.domain,
            action: s.action,
            success: s.result.success,
            action_taken: s.result.action_taken,
            durationMs: s.durationMs,
          })),
          stopped_reason: loop.stoppedReason,
          total_tokens: loop.totalTokens,
          transcript: loop.transcript,
        },
      },
      context.supabase
    )
  }
}

/**
 * Main entry point: resolve input → route → execute → log → respond.
 */
export async function handleRequest(
  input: string,
  context: AgentContext
): Promise<{ response: AssistantResponse; tracker: PipelineTracker }> {
  const tracker = new PipelineTracker()
  const aiCalls = new AICallCollector()

  // ─── Step 1: Route ────────────────────────────────────────────────────────
  tracker.startStep('routing')
  let routed: RoutedCommand

  // Tier 1: Slash commands
  const slashResult = parseSlashCommand(input)
  if (slashResult) {
    routed = slashResult
    tracker.endStep('success')
  } else {
    // Tier 1b: Legacy -flag syntax
    const legacyResult = parseLegacyFlag(input)
    if (legacyResult) {
      routed = legacyResult
      tracker.endStep('success')
    } else {
      // Tier 2: Natural language rules
      const ruleResult = matchRules(input)
      if (ruleResult) {
        routed = ruleResult
        tracker.endStep('success')
      } else {
        // Tier 2b: Dynamic rules from database (trainer-generated)
        const dynamicRules = await loadDynamicRules(context.userId, context.supabase)
        const dynamicResult = matchDynamicRules(input, dynamicRules)
        if (dynamicResult) {
          routed = dynamicResult
          tracker.endStep('success')
        } else if (context.aiConfig?.key) {
          // Tier 3: agentic tool-use loop
          tracker.endStep('success')
          const loopResult = await runAgentLoop(input, context, aiCalls)

          // Persist failure transcripts for debugging
          maybeLogFailureReport(input, loopResult, context)

          const response = buildAgentResponse(input, loopResult)
          // Fire-and-forget interaction log
          logInteraction(
            {
              userId: context.userId,
              input,
              detectedIntent: response.intent,
              detectionMethod: 'ai',
              response: response as unknown as Record<string, unknown>,
              source: context.source,
              tokensUsed: loopResult.totalTokens.input + loopResult.totalTokens.output,
              latencyMs: tracker.getTotalDuration(),
              domain: response.domain,
              toolId: undefined,
              routingMethod: 'ai',
              errorDetails: response.success ? undefined : { stoppedReason: loopResult.stoppedReason },
              aiCalls: aiCalls.toJSON(),
              processingSteps: tracker.getSteps() as unknown as Array<Record<string, unknown>>,
            },
            context.supabase
          )
          return { response, tracker }
        } else {
          // No AI available — route to general.question (tells user to configure AI)
          routed = {
            domain: 'extra',
            action: 'general.question',
            params: { content: input },
            rawInput: input,
            routingMethod: 'rule',
          }
          tracker.endStep('success')
        }
      }
    }
  }

  // ─── Step 2: Execute via domain manager ───────────────────────────────────
  tracker.startStep('execution')
  const manager = getManager(routed.domain)

  let result: ToolResult
  if (manager.hasAction(routed.action)) {
    result = await safeExecute(
      () => manager.execute(routed.action, routed.params, context),
      `Failed to execute ${routed.action}`
    )
  } else {
    // Action not found in target domain — fall back to general.question
    const extraManager = getManager('extra')
    result = await safeExecute(
      () => extraManager.execute('general.question', { content: input }, context),
      'Failed to process input'
    )
    logError({
      userId: context.userId,
      input,
      errorType: 'routing_error',
      errorMessage: `Action "${routed.action}" not found in domain "${routed.domain}"`,
      step: 'execution',
      domain: routed.domain,
      intent: routed.action,
      routingMethod: routed.routingMethod,
      context: { params: routed.params },
    }, context.supabase)
  }

  // Log execution errors
  if (!result.success) {
    logError({
      userId: context.userId,
      input,
      errorType: 'execution_error',
      errorMessage: result.action_taken,
      step: 'execution',
      domain: routed.domain,
      intent: routed.action,
      routingMethod: routed.routingMethod,
      context: { data: result.data, params: routed.params },
    }, context.supabase)
  }
  tracker.endStep(result.success ? 'success' : 'error')

  // ─── Step 3: Find which tool handled it ───────────────────────────────────
  const toolId = manager.tools.find(t =>
    t.actions.some(a => a.action === routed.action)
  )?.id

  // ─── Step 4: Log (non-blocking) ──────────────────────────────────────────
  const totalTokens = aiCalls.getTotalTokens()
  logInteraction(
    {
      userId: context.userId,
      input,
      detectedIntent: routed.action,
      detectionMethod: routed.routingMethod,
      response: result as unknown as Record<string, unknown>,
      source: context.source,
      tokensUsed: totalTokens.input + totalTokens.output,
      latencyMs: tracker.getTotalDuration(),
      domain: routed.domain,
      toolId,
      routingMethod: routed.routingMethod,
      errorDetails: result.success ? undefined : (result.data as Record<string, unknown>),
      aiCalls: aiCalls.toJSON(),
      processingSteps: tracker.getSteps() as unknown as Array<Record<string, unknown>>,
    },
    context.supabase
  )

  // ─── Step 5: Build response ───────────────────────────────────────────────
  const response: AssistantResponse = {
    success: result.success,
    intent: routed.action,
    domain: routed.domain,
    action_taken: result.action_taken,
    data: result.data,
    suggestions: result.suggestions,
  }

  return { response, tracker }
}
