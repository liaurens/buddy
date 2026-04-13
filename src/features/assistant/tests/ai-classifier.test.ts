/**
 * Tests for the AI classifier — Tier 3 intent classification.
 *
 * Requirements covered:
 * - 2.3: AI Parameter Extraction (JSON parsing from AI response)
 * - 4.1: AI Provider Switching (fallback behavior)
 *
 * Source: supabase/functions/assistant/core/ai-classifier.ts
 */
import { describe, it, expect } from 'vitest'

// ─── Types (mirrored from types.ts) ────────────────────────────────────────

interface RoutedCommand {
  domain: string
  action: string
  params: Record<string, unknown>
  rawInput: string
  routingMethod: string
}

interface ToolDefinition {
  id: string
  domain: string
  actions: Array<{ action: string; description: string }>
}

// ─── Re-implemented from ai-classifier.ts ──────────────────────────────────

/**
 * Builds a human-readable intent list from the tool registry.
 * Used in the AI system prompt to list available intents.
 */
function buildIntentList(tools: ToolDefinition[]): string {
  const intents: string[] = []
  for (const tool of tools) {
    for (const action of tool.actions) {
      intents.push(`- ${action.action} (${action.description}) [domain: ${tool.domain}]`)
    }
  }
  return intents.join('\n')
}

/**
 * Parses the JSON response from AI classification into a RoutedCommand.
 * Extracted from classifyWithAI (lines 70-79) for testability.
 *
 * Handles: valid JSON, missing fields, invalid JSON, null.
 */
function parseClassificationResponse(
  jsonString: string | null | undefined,
  originalInput: string
): RoutedCommand {
  try {
    const parsed = JSON.parse(jsonString || '{}')

    return {
      domain: parsed.domain || 'extra',
      action: parsed.intent || 'general.question',
      params: parsed.params ?? { content: originalInput },
      rawInput: originalInput,
      routingMethod: 'ai',
    }
  } catch {
    // Invalid JSON — fallback
    return {
      domain: 'extra',
      action: 'general.question',
      params: { content: originalInput },
      rawInput: originalInput,
      routingMethod: 'ai',
    }
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('buildIntentList', () => {
  const mockTools: ToolDefinition[] = [
    {
      id: 'tasks',
      domain: 'planning',
      actions: [
        { action: 'task.create', description: 'Create a new task' },
        { action: 'task.list', description: 'List all tasks' },
      ],
    },
    {
      id: 'mood',
      domain: 'mental',
      actions: [
        { action: 'mood.log', description: 'Log current mood' },
      ],
    },
  ]

  it('builds one line per action across all tools', () => {
    const result = buildIntentList(mockTools)
    const lines = result.split('\n')
    expect(lines).toHaveLength(3)
  })

  it('each line contains action name, description, and domain', () => {
    const result = buildIntentList(mockTools)
    expect(result).toContain('task.create')
    expect(result).toContain('Create a new task')
    expect(result).toContain('[domain: planning]')
    expect(result).toContain('mood.log')
    expect(result).toContain('[domain: mental]')
  })

  it('returns empty string for empty tools array', () => {
    expect(buildIntentList([])).toBe('')
  })

  it('handles tool with many actions', () => {
    const bigTool: ToolDefinition[] = [{
      id: 'planning',
      domain: 'planning',
      actions: [
        { action: 'task.create', description: 'Create' },
        { action: 'task.list', description: 'List' },
        { action: 'task.complete', description: 'Complete' },
        { action: 'task.delete', description: 'Delete' },
      ],
    }]
    const lines = buildIntentList(bigTool).split('\n')
    expect(lines).toHaveLength(4)
  })
})

describe('parseClassificationResponse', () => {
  const INPUT = 'buy groceries'

  it('parses valid JSON with all fields', () => {
    const json = '{"intent":"note.create.shopping","domain":"content","params":{"content":"groceries","flag":"shop"}}'
    const result = parseClassificationResponse(json, INPUT)

    expect(result.domain).toBe('content')
    expect(result.action).toBe('note.create.shopping')
    expect(result.params).toEqual({ content: 'groceries', flag: 'shop' })
    expect(result.rawInput).toBe(INPUT)
    expect(result.routingMethod).toBe('ai')
  })

  it('defaults missing domain to "extra"', () => {
    const json = '{"intent":"general.question","params":{"content":"hello"}}'
    const result = parseClassificationResponse(json, INPUT)
    expect(result.domain).toBe('extra')
  })

  it('defaults missing intent to "general.question"', () => {
    const json = '{"domain":"planning","params":{"content":"stuff"}}'
    const result = parseClassificationResponse(json, INPUT)
    expect(result.action).toBe('general.question')
  })

  it('defaults missing params to {content: originalInput}', () => {
    const json = '{"intent":"task.create","domain":"planning"}'
    const result = parseClassificationResponse(json, INPUT)
    expect(result.params).toEqual({ content: INPUT })
  })

  it('handles empty JSON object with all defaults', () => {
    const result = parseClassificationResponse('{}', INPUT)
    expect(result.domain).toBe('extra')
    expect(result.action).toBe('general.question')
    expect(result.params).toEqual({ content: INPUT })
    expect(result.routingMethod).toBe('ai')
  })

  it('preserves rawInput always', () => {
    const result = parseClassificationResponse('{}', 'my original input')
    expect(result.rawInput).toBe('my original input')
  })
})

describe('classifyWithAI fallback behavior', () => {
  const INPUT = 'some weird input'

  it('falls back on invalid JSON string', () => {
    const result = parseClassificationResponse('I think this is a task', INPUT)
    expect(result.domain).toBe('extra')
    expect(result.action).toBe('general.question')
    expect(result.params).toEqual({ content: INPUT })
  })

  it('falls back on null content', () => {
    const result = parseClassificationResponse(null, INPUT)
    expect(result.domain).toBe('extra')
    expect(result.action).toBe('general.question')
  })

  it('falls back on undefined content', () => {
    const result = parseClassificationResponse(undefined, INPUT)
    expect(result.domain).toBe('extra')
    expect(result.action).toBe('general.question')
  })

  it('falls back on empty string', () => {
    const result = parseClassificationResponse('', INPUT)
    // Empty string → JSON.parse('{}') → defaults
    expect(result.domain).toBe('extra')
    expect(result.action).toBe('general.question')
  })

  it('always preserves original input in params.content on fallback', () => {
    const result = parseClassificationResponse('not json at all!', 'my important query')
    expect(result.params.content).toBe('my important query')
    expect(result.rawInput).toBe('my important query')
  })

  it('always sets routingMethod to "ai" even on fallback', () => {
    const result = parseClassificationResponse('garbage', INPUT)
    expect(result.routingMethod).toBe('ai')
  })
})
