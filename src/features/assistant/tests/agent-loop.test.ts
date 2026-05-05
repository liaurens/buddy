/**
 * Tests for the agent-loop helpers — Gemini schema stripping, tool-name
 * sanitization, and the response aggregation that maps multi-step results
 * to an AssistantResponse.
 *
 * Re-implemented inline (matches the project pattern for testing edge code).
 *
 * Sources:
 * - supabase/functions/assistant/core/ai-wrapper.ts (stripSchemaForGemini)
 * - supabase/functions/assistant/core/agent-loop.ts (sanitizeToolName)
 * - supabase/functions/assistant/core/general-manager.ts (buildAgentResponse)
 */
import { describe, it, expect } from 'vitest'

interface JsonSchema {
  type?: string
  description?: string
  properties?: Record<string, JsonSchema>
  required?: string[]
  enum?: Array<string | number>
  items?: JsonSchema
  format?: string
}

function stripSchemaForGemini(schema: JsonSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (schema.type) out.type = schema.type.toUpperCase()
  if (schema.description) out.description = schema.description
  if (schema.enum) out.enum = schema.enum.map(String)
  if (schema.format === 'date-time' || schema.format === 'date') out.format = schema.format
  if (schema.items) out.items = stripSchemaForGemini(schema.items)
  if (schema.properties) {
    out.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([k, v]) => [k, stripSchemaForGemini(v)])
    )
  }
  if (schema.required) out.required = schema.required
  return out
}

function sanitizeToolName(intent: string): string {
  return intent.replace(/\./g, '_')
}
function unsanitizeToolName(name: string): string {
  return name.replace(/_/g, '.')
}

interface AssistantStep {
  id: string
  domain: string
  action: string
  params: Record<string, unknown>
  result: { success: boolean; action_taken: string; data: Record<string, unknown>; suggestions?: string[] }
  durationMs: number
}

interface AgentLoopResult {
  steps: AssistantStep[]
  finalText: string
  stoppedReason: string
  totalTokens: { input: number; output: number }
}

function buildAgentResponse(loop: AgentLoopResult) {
  const overallSuccess = loop.steps.length === 0
    ? loop.finalText.length > 0
    : loop.steps.every(s => s.result.success)
  const firstStep = loop.steps[0]
  const intent = firstStep?.action ?? 'general.question'
  const domain = firstStep?.domain ?? 'extra'
  let actionTaken = loop.finalText
  if (!actionTaken) {
    actionTaken = loop.steps.length === 0
      ? "I'm not sure how to help with that."
      : loop.steps.map(s => `${s.result.success ? '✓' : '✗'} ${s.result.action_taken}`).join('\n')
  }
  return { success: overallSuccess, intent, domain, action_taken: actionTaken, steps: loop.steps }
}

describe('stripSchemaForGemini', () => {
  it('uppercases type and keeps allowed format', () => {
    const out = stripSchemaForGemini({ type: 'string', format: 'date-time' })
    expect(out).toEqual({ type: 'STRING', format: 'date-time' })
  })

  it('drops formats Gemini does not support', () => {
    const out = stripSchemaForGemini({ type: 'string', format: 'email' })
    expect(out).toEqual({ type: 'STRING' })
  })

  it('coerces enum values to strings', () => {
    const out = stripSchemaForGemini({ type: 'integer', enum: [1, 2, 3] })
    expect(out.enum).toEqual(['1', '2', '3'])
  })

  it('walks nested properties recursively', () => {
    const out = stripSchemaForGemini({
      type: 'object',
      properties: {
        outer: {
          type: 'object',
          properties: { inner: { type: 'integer' } },
        },
      },
      required: ['outer'],
    })
    expect(out).toMatchObject({
      type: 'OBJECT',
      properties: {
        outer: {
          type: 'OBJECT',
          properties: { inner: { type: 'INTEGER' } },
        },
      },
      required: ['outer'],
    })
  })
})

describe('tool-name sanitization', () => {
  it('round-trips dotted intents through underscore form', () => {
    expect(sanitizeToolName('school.assignment.create')).toBe('school_assignment_create')
    expect(unsanitizeToolName('school_assignment_create')).toBe('school.assignment.create')
    expect(unsanitizeToolName(sanitizeToolName('task.create'))).toBe('task.create')
  })
})

describe('buildAgentResponse', () => {
  it('treats a pure-text response (no tool calls) as a successful answer', () => {
    const r = buildAgentResponse({
      steps: [],
      finalText: 'You currently have 4 open tasks.',
      stoppedReason: 'end_turn',
      totalTokens: { input: 50, output: 20 },
    })
    expect(r.success).toBe(true)
    expect(r.action_taken).toBe('You currently have 4 open tasks.')
    expect(r.intent).toBe('general.question')
  })

  it('marks success when all steps succeed', () => {
    const r = buildAgentResponse({
      steps: [
        {
          id: 't1',
          domain: 'school',
          action: 'school.assignment.create',
          params: {},
          result: { success: true, action_taken: 'Assignment X added', data: {} },
          durationMs: 100,
        },
      ],
      finalText: 'Created assignment X with reminder.',
      stoppedReason: 'end_turn',
      totalTokens: { input: 100, output: 30 },
    })
    expect(r.success).toBe(true)
    expect(r.intent).toBe('school.assignment.create')
    expect(r.domain).toBe('school')
    expect(r.steps).toHaveLength(1)
  })

  it('reports failure when any step fails (best-effort multi-step)', () => {
    const r = buildAgentResponse({
      steps: [
        {
          id: 't1',
          domain: 'school',
          action: 'school.assignment.create',
          params: {},
          result: { success: true, action_taken: 'Assignment created', data: {} },
          durationMs: 80,
        },
        {
          id: 't2',
          domain: 'planning',
          action: 'notification.schedule.relative',
          params: {},
          result: { success: false, action_taken: 'Refusing past time', data: { error: 'past_time' } },
          durationMs: 20,
        },
      ],
      finalText: '',
      stoppedReason: 'end_turn',
      totalTokens: { input: 200, output: 40 },
    })
    expect(r.success).toBe(false)
    // No finalText → falls back to summarized step list
    expect(r.action_taken).toContain('✓ Assignment created')
    expect(r.action_taken).toContain('✗ Refusing past time')
  })
})
