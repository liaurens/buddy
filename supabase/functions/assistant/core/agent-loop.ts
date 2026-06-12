/**
 * Agent Loop — the agentic Tier 3 of the assistant.
 *
 * Replaces the single-intent classifier when an AI key is configured.
 * The model picks tools, fills structured arguments, and the loop executes them
 * best-effort across multiple turns. Tool failures are fed back to the model
 * so it can retry, adapt, or move on.
 *
 * Caps:
 *   MAX_ITER             — hard ceiling on conversation turns
 *   MAX_TOOL_CALLS_TOTAL — hard ceiling on total tool executions across the run
 *   MAX_TOKENS_BUDGET    — soft budget; once exceeded the loop returns whatever it has
 */

import type {
  AgentContext,
  AssistantStep,
  Domain,
  Intent,
  JsonSchema,
  ToolResult,
} from '../types.ts'
import { ALL_TOOLS } from '../tools/registry.ts'
import { getManager } from '../managers/index.ts'
import { validate } from './schema-validator.ts'
import { safeExecute } from './error-handler.ts'
import {
  callAIWithTools,
  toolCallToAIResult,
  type AIMessage,
  type AIToolCall,
  type AIToolDef,
  type AIToolResultMsg,
  type AICallCollector,
} from './ai-wrapper.ts'

const MAX_ITER = 8
const MAX_TOOL_CALLS_TOTAL = 15
const MAX_TOKENS_BUDGET = 40_000
const PER_CALL_TIMEOUT_MS = 12_000

// Small/cheap models that are prone to empty first turns and benefit from
// force-tool retry. Match on substring (model strings vary by provider).
const SMALL_MODEL_HINTS = ['haiku', 'flash', '4o-mini', 'gpt-4o-mini', 'gpt-5-mini']
function isSmallModel(model: string | undefined): boolean {
  if (!model) return true // unknown → treat as small (safer)
  const m = model.toLowerCase()
  return SMALL_MODEL_HINTS.some(h => m.includes(h))
}

export interface AgentLoopResult {
  steps: AssistantStep[]
  finalText: string
  transcript: AIMessage[]
  stoppedReason: 'end_turn' | 'max_iter' | 'budget_exceeded' | 'tool_call_cap' | 'error'
  totalTokens: { input: number; output: number }
}

/**
 * Build the AIToolDef list from the registry, filtering to actions that have
 * an inputSchema (only those are exposed to the model).
 */
export function buildToolList(): {
  tools: AIToolDef[]
  byName: Map<string, { domain: Domain; action: Intent; schema?: JsonSchema }>
} {
  const tools: AIToolDef[] = []
  const byName = new Map<string, { domain: Domain; action: Intent; schema?: JsonSchema }>()
  for (const tool of ALL_TOOLS) {
    for (const action of tool.actions) {
      if (!action.inputSchema) continue
      const name = sanitizeToolName(action.action)
      tools.push({
        name,
        description: action.description,
        input_schema: action.inputSchema,
      })
      byName.set(name, { domain: tool.domain, action: action.action, schema: action.inputSchema })
    }
  }
  return { tools, byName }
}

// Anthropic and OpenAI both require tool names match /^[a-zA-Z0-9_-]+$/.
// Our intents use dots ('task.create'); replace with underscores both ways.
function sanitizeToolName(intent: string): string {
  return intent.replace(/\./g, '_')
}
function unsanitizeToolName(name: string): Intent {
  return name.replace(/_/g, '.') as Intent
}

interface SystemPromptContext {
  todayIso: string
  classes: Array<{ id: string; name: string }>
}

async function fetchClasses(context: AgentContext): Promise<Array<{ id: string; name: string }>> {
  // deno-lint-ignore no-explicit-any
  const sb = context.supabase as any
  try {
    const { data } = await sb
      .from('classes')
      .select('id, name')
      .eq('user_id', context.userId)
      .eq('archived', false)
      .order('name', { ascending: true })
      .limit(20)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function buildSystemPrompt(ctx: SystemPromptContext): string {
  const classesBlock = ctx.classes.length > 0
    ? `User's classes:\n${ctx.classes.map(c => `- ${c.name} (id: ${c.id})`).join('\n')}\n`
    : `User has no classes yet — use school_class_create before adding assignments.\n`

  return `Today's date (user's local): ${ctx.todayIso}

You are a personal productivity assistant for a single user. You have tools to create, list, and update items across the user's app: tasks, reminders, checklists, notes, school assignments, classes, goals, skills (Growth Hub), strategies (Toolbox), and tracker check-ins.

${classesBlock}
Hard rules — every turn MUST end with either a tool_use OR text. Never end a turn empty.
- If the user asks for an action (create, add, log, schedule, list, complete…), call the matching tool. Do not describe what you would do — just do it.
- Bias toward action over clarification. Missing fields are not a reason to ask — fill sensible defaults (e.g. task with no date → no due date; task with vague title → use the user's exact words as the title). Only ask when the *intent* is unclear (you can't tell which tool to call), never when only specific fields are missing.
- Never suggest slash commands ("/task ...", "/note ...", etc.). The user is talking to you — call the tool yourself.
- If the intent is genuinely unclear, reply with one short clarifying question as text (no tool call). Never stay silent.

Grounding rule:
- For any ambiguous request ("what should I work on?", "how am I doing?", "plan my day"), call task_list_today and calendar_today first, then answer from what they return.
- When the user asks "how do I handle X" or "what should I do about X", call strategy_find first — surface the user's OWN strategies before generic advice.

Action mapping examples:
- "make a new task called dentist" → task_create({ title: "dentist" })
- "add a task to call mom tomorrow" → task_create({ title: "call mom", due_date: "<tomorrow ISO>" })
- "remind me at 3pm to take meds" → notification_schedule({ message: "take meds", time: "15:00" })
- "remind me about the dentist task tomorrow at 9am" → task_reminder_set({ task: "dentist", at: "<tomorrow 9am ISO>" })
- "log 30 min Spanish practice" → skill_log({ skill: "Spanish", minutes: 30 })
- "what's my packing checklist look like?" → checklist_get({ name: "packing" })

Multi-step requests are normal. Chain tool calls as needed.
- For school deadlines with a "remind me X days/hours before" phrasing, prefer school_assignment_create with reminder_days_before / reminder_hours_before. The handler creates both the assignment and the reminder atomically.
- For non-school reminders relative to a specific time, use notification_schedule_relative with anchor + offset_*.
- Resolve dates yourself: convert relative phrases ("next Tuesday", "over een week", "tomorrow at 3pm") into ISO 8601 before calling tools.
- All ISO timestamps without an offset are interpreted as the user's local time.
- Fuzzy-matched fields ("task", "skill", "checklist", "item") accept substring matches against active rows.

When a tool returns \`suggestions\`, surface them to the user — don't paraphrase, just pass them along.

If a tool returns an error, read it and retry with corrected arguments, call a different tool, or ask the user a clarifying question.
After all tool calls succeed, reply with a short natural-language confirmation.
Be terse.`
}

export async function runAgentLoop(
  input: string,
  context: AgentContext,
  aiCalls: AICallCollector
): Promise<AgentLoopResult> {
  if (!context.aiConfig?.key) {
    return {
      steps: [],
      finalText: '',
      transcript: [],
      stoppedReason: 'error',
      totalTokens: { input: 0, output: 0 },
    }
  }

  const { tools, byName } = buildToolList()

  const classes = await fetchClasses(context)
  const todayIso = new Date().toISOString().slice(0, 10)
  const systemPrompt = buildSystemPrompt({ todayIso, classes })

  const messages: AIMessage[] = [{ role: 'user', content: input }]
  const steps: AssistantStep[] = []
  let totalIn = 0
  let totalOut = 0
  let stoppedReason: AgentLoopResult['stoppedReason'] = 'max_iter'
  let finalText = ''

  for (let iter = 0; iter < MAX_ITER; iter++) {
    if (totalIn + totalOut > MAX_TOKENS_BUDGET) {
      stoppedReason = 'budget_exceeded'
      finalText = finalText || 'Stopped early: token budget exceeded.'
      break
    }

    let resp
    try {
      resp = await callAIWithTools(
        messages,
        tools,
        { key: context.aiConfig.key, provider: context.aiConfig.provider },
        {
          model: context.aiConfig.model,
          systemPrompt,
          cacheSystemPrompt: context.aiConfig.provider === 'anthropic',
          maxTokens: 1024,
        }
      )
    } catch (err) {
      stoppedReason = 'error'
      finalText = `Agent loop failed: ${err instanceof Error ? err.message : String(err)}`
      break
    }

    aiCalls.record(toolCallToAIResult(resp))
    totalIn += resp.tokensIn
    totalOut += resp.tokensOut

    // Force-tool retry: small models sometimes go shy and return an empty first
    // turn. Retry once with toolChoice='any' to force a pick. Capable models
    // (Sonnet, Opus, Pro, large GPTs) almost never need this — skip them.
    if (
      iter === 0 &&
      resp.toolCalls.length === 0 &&
      !resp.content &&
      isSmallModel(resp.model)
    ) {
      console.warn(
        `[agent-loop] empty first turn — retrying with tool_choice=any: provider=${resp.provider} model=${resp.model} input="${input.slice(0, 80)}"`
      )
      try {
        resp = await callAIWithTools(
          messages,
          tools,
          { key: context.aiConfig.key, provider: context.aiConfig.provider },
          {
            model: context.aiConfig.model,
            systemPrompt,
            cacheSystemPrompt: context.aiConfig.provider === 'anthropic',
            maxTokens: 1024,
            toolChoice: 'any',
          }
        )
        aiCalls.record(toolCallToAIResult(resp))
        totalIn += resp.tokensIn
        totalOut += resp.tokensOut
      } catch (err) {
        stoppedReason = 'error'
        finalText = `Agent loop failed: ${err instanceof Error ? err.message : String(err)}`
        break
      }
    }

    if (resp.toolCalls.length === 0) {
      // Model returned a final text response (or asked a clarifying question).
      finalText = resp.content
      messages.push({ role: 'assistant', content: resp.content })
      stoppedReason = 'end_turn'
      if (!resp.content) {
        console.warn(
          `[agent-loop] still empty after force-tool retry: provider=${resp.provider} model=${resp.model} ` +
            `stopReason=${resp.stopReason} in=${resp.tokensIn} out=${resp.tokensOut} input="${input.slice(0, 80)}"`
        )
      }
      break
    }

    // Persist assistant turn (text + tool calls) so the model has its own history.
    messages.push({ role: 'assistant', content: resp.content, toolCalls: resp.toolCalls })

    const toolResults: AIToolResultMsg[] = []
    for (const call of resp.toolCalls) {
      if (steps.length >= MAX_TOOL_CALLS_TOTAL) {
        stoppedReason = 'tool_call_cap'
        finalText = finalText || 'Stopped early: tool call cap reached.'
        break
      }
      const stepResult = await executeToolCall(call, byName, context)
      steps.push(stepResult)
      toolResults.push({
        tool_use_id: call.id,
        content: JSON.stringify({
          success: stepResult.result.success,
          action_taken: stepResult.result.action_taken,
          data: stepResult.result.data,
        }),
        is_error: !stepResult.result.success,
      })
    }
    messages.push({ role: 'tool_results', results: toolResults })

    if (stoppedReason === 'tool_call_cap') break
    // continue loop — model gets to see results and either call more tools or finish
  }

  return {
    steps,
    finalText,
    transcript: messages,
    stoppedReason,
    totalTokens: { input: totalIn, output: totalOut },
  }
}

async function executeToolCall(
  call: AIToolCall,
  byName: Map<string, { domain: Domain; action: Intent; schema?: JsonSchema }>,
  context: AgentContext
): Promise<AssistantStep> {
  const startMs = Date.now()
  const lookup = byName.get(call.name)
  if (!lookup) {
    return {
      id: call.id,
      domain: 'extra',
      action: 'unknown' as Intent,
      params: call.input,
      result: {
        success: false,
        action_taken: `Unknown tool "${call.name}". Pick one from the provided tool list.`,
        data: { error: 'unknown_tool' },
      },
      durationMs: Date.now() - startMs,
    }
  }

  const validation = validate(call.input, lookup.schema)
  if (!validation.ok) {
    return {
      id: call.id,
      domain: lookup.domain,
      action: lookup.action,
      params: call.input,
      result: {
        success: false,
        action_taken: `Invalid arguments: ${validation.error}`,
        data: { error: 'validation_error', field: validation.field },
      },
      durationMs: Date.now() - startMs,
    }
  }

  const manager = getManager(lookup.domain)
  let toolResult: ToolResult
  try {
    toolResult = await Promise.race([
      safeExecute(
        () => manager.execute(lookup.action, call.input, context),
        `Failed to execute ${lookup.action}`
      ),
      new Promise<ToolResult>((_, reject) =>
        setTimeout(() => reject(new Error('tool_timeout')), PER_CALL_TIMEOUT_MS)
      ),
    ])
  } catch (err) {
    toolResult = {
      success: false,
      action_taken: `Tool ${lookup.action} failed: ${err instanceof Error ? err.message : String(err)}`,
      data: { error: 'execution_error' },
    }
  }

  return {
    id: call.id,
    domain: lookup.domain,
    action: lookup.action,
    params: call.input,
    result: toolResult,
    durationMs: Date.now() - startMs,
  }
}

export { unsanitizeToolName, sanitizeToolName }
