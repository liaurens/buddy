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
import { parseSlashCommand, parseLegacyFlag, getAvailableCommands } from './command-parser.ts'
import { matchRules } from './rule-engine.ts'
import { classifyWithAI } from './ai-classifier.ts'
import { PipelineTracker, safeExecute } from './error-handler.ts'
import { getManager } from '../managers/index.ts'
import { logInteraction } from '../tools/learnings.tool.ts'

interface AIConfig {
  key: string
  provider: string
}

/**
 * Main entry point: resolve input → route → execute → log → respond.
 */
export async function handleRequest(
  input: string,
  context: AgentContext,
  aiConfig?: AIConfig
): Promise<{ response: AssistantResponse; tracker: PipelineTracker }> {
  const tracker = new PipelineTracker()

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
        // Tier 3: AI classification
        if (aiConfig?.key) {
          routed = await classifyWithAI(input, aiConfig.key, aiConfig.provider)
          tracker.endStep('success')
        } else {
          // No AI available — default to note creation
          routed = {
            domain: 'content',
            action: 'note.create',
            params: { content: input },
            rawInput: input,
            routingMethod: 'rule',
          }
          tracker.endStep('success')
        }
      }
    }
  }

  // ─── Step 2: Handle system commands ───────────────────────────────────────
  if (routed.action === 'system.help') {
    const commands = getAvailableCommands()
    const helpText = commands
      .map(c => `${c.command} — ${c.description}`)
      .join('\n')

    return {
      response: {
        success: true,
        intent: 'system.help',
        domain: 'extra',
        action_taken: 'Available commands',
        data: { commands, help: helpText },
      },
      tracker,
    }
  }

  // ─── Step 3: Execute via domain manager ───────────────────────────────────
  tracker.startStep('execution')
  const manager = getManager(routed.domain)

  let result: ToolResult
  if (manager.hasAction(routed.action)) {
    result = await safeExecute(
      () => manager.execute(routed.action, routed.params, context),
      `Failed to execute ${routed.action}`
    )
  } else {
    // Action not found in target domain — fall back to note creation
    const contentManager = getManager('content')
    result = await safeExecute(
      () => contentManager.execute('note.create', { content: input }, context),
      'Failed to process input'
    )
  }
  tracker.endStep(result.success ? 'success' : 'error')

  // ─── Step 4: Find which tool handled it ───────────────────────────────────
  const toolId = manager.tools.find(t =>
    t.actions.some(a => a.action === routed.action)
  )?.id

  // ─── Step 5: Log (non-blocking) ──────────────────────────────────────────
  logInteraction(
    context.userId,
    input,
    routed.action,
    routed.routingMethod,
    result as unknown as Record<string, unknown>,
    context.source,
    0,
    tracker.getTotalDuration(),
    context.supabase as Parameters<typeof logInteraction>[8],
    routed.domain,
    toolId
  )

  // ─── Step 6: Build response ───────────────────────────────────────────────
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
