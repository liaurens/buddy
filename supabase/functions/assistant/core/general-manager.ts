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
import { classifyWithAI } from './ai-classifier.ts'
import { AICallCollector } from './ai-wrapper.ts'
import { PipelineTracker, safeExecute } from './error-handler.ts'
import { getManager } from '../managers/index.ts'
import { logInteraction } from '../tools/learnings.tool.ts'
import { logError, extractError } from './error-logger.ts'

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
          // Tier 3: AI classification
          try {
            const { routed: aiRouted, aiResult } = await classifyWithAI(input, context.aiConfig.key, context.aiConfig.provider, context.aiConfig.model)
            routed = aiRouted
            aiCalls.record(aiResult)
            tracker.endStep('success')
          } catch (err) {
            const { message, stack } = extractError(err)
            logError({
              userId: context.userId,
              input,
              errorType: 'ai_error',
              errorMessage: message,
              errorStack: stack,
              step: 'ai_classification',
              aiProvider: context.aiConfig.provider,
              context: { tier: 3 },
            }, context.supabase)
            // Fall through to general.question on classification failure
            routed = {
              domain: 'extra',
              action: 'general.question',
              params: { content: input },
              rawInput: input,
              routingMethod: 'ai',
            }
            tracker.endStep('error', message)
          }
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
