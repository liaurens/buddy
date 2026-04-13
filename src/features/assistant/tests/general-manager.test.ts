/**
 * Tests for the general manager building blocks — pipeline tracking,
 * safe execution, dynamic rule matching, and error extraction.
 *
 * Requirements covered:
 * - 1.3: Dynamic Rule Injection (Tier 2b)
 * - 3.1: Hard Failures & Logging (error handling)
 *
 * Sources:
 * - supabase/functions/assistant/core/error-handler.ts
 * - supabase/functions/assistant/core/rule-engine.ts
 * - supabase/functions/assistant/core/error-logger.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Types (mirrored from types.ts) ────────────────────────────────────────

interface ToolResult {
  success: boolean
  action_taken: string
  data?: unknown
  suggestions?: string[]
}

interface RoutedCommand {
  domain: string
  action: string
  params: Record<string, unknown>
  rawInput: string
  routingMethod: string
}

interface DynamicRule {
  id: string
  domain: string
  pattern: string
  action: string
  confidence: number
}

// ─── Re-implemented from error-handler.ts ──────────────────────────────────

interface ProcessingStep {
  step: string
  durationMs: number
  result: 'success' | 'error' | 'skipped'
  error?: string
}

class PipelineTracker {
  private steps: ProcessingStep[] = []
  private currentStep: { step: string; startTime: number } | null = null

  startStep(step: string): void {
    this.currentStep = { step, startTime: Date.now() }
  }

  endStep(result: 'success' | 'error' | 'skipped', error?: string): void {
    if (!this.currentStep) return
    this.steps.push({
      step: this.currentStep.step,
      durationMs: Date.now() - this.currentStep.startTime,
      result,
      error,
    })
    this.currentStep = null
  }

  getSteps(): ProcessingStep[] {
    return this.steps
  }

  getTotalDuration(): number {
    return this.steps.reduce((sum, s) => sum + s.durationMs, 0)
  }
}

async function safeExecute(
  fn: () => Promise<ToolResult>,
  fallbackMessage: string
): Promise<ToolResult> {
  try {
    return await fn()
  } catch (err) {
    return {
      success: false,
      action_taken: fallbackMessage,
      data: { error: String(err) },
    }
  }
}

// ─── Re-implemented from rule-engine.ts ────────────────────────────────────

function matchDynamicRules(input: string, dynamicRules: DynamicRule[]): RoutedCommand | null {
  for (const rule of dynamicRules) {
    try {
      const regex = new RegExp(rule.pattern, 'i')
      if (regex.test(input)) {
        return {
          domain: rule.domain,
          action: rule.action,
          params: { content: input },
          rawInput: input,
          routingMethod: 'rule',
        }
      }
    } catch {
      // Invalid regex — skip
    }
  }
  return null
}

// ─── Re-implemented from error-logger.ts ───────────────────────────────────

function extractError(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack }
  }
  return { message: String(err) }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('PipelineTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('tracks a single step with name, duration, and result', () => {
    const tracker = new PipelineTracker()
    tracker.startStep('routing')
    vi.advanceTimersByTime(50)
    tracker.endStep('success')

    const steps = tracker.getSteps()
    expect(steps).toHaveLength(1)
    expect(steps[0].step).toBe('routing')
    expect(steps[0].durationMs).toBe(50)
    expect(steps[0].result).toBe('success')
  })

  it('tracks multiple steps in order', () => {
    const tracker = new PipelineTracker()

    tracker.startStep('routing')
    vi.advanceTimersByTime(30)
    tracker.endStep('success')

    tracker.startStep('execution')
    vi.advanceTimersByTime(100)
    tracker.endStep('success')

    const steps = tracker.getSteps()
    expect(steps).toHaveLength(2)
    expect(steps[0].step).toBe('routing')
    expect(steps[1].step).toBe('execution')
  })

  it('sums total duration correctly', () => {
    const tracker = new PipelineTracker()

    tracker.startStep('routing')
    vi.advanceTimersByTime(30)
    tracker.endStep('success')

    tracker.startStep('execution')
    vi.advanceTimersByTime(70)
    tracker.endStep('success')

    expect(tracker.getTotalDuration()).toBe(100)
  })

  it('endStep without startStep is a no-op', () => {
    const tracker = new PipelineTracker()
    tracker.endStep('success') // should not throw
    expect(tracker.getSteps()).toHaveLength(0)
  })

  it('records error message on error steps', () => {
    const tracker = new PipelineTracker()
    tracker.startStep('ai_classification')
    vi.advanceTimersByTime(10)
    tracker.endStep('error', 'API timeout')

    const steps = tracker.getSteps()
    expect(steps[0].result).toBe('error')
    expect(steps[0].error).toBe('API timeout')
  })
})

describe('safeExecute', () => {
  it('returns the ToolResult unchanged on success', async () => {
    const expected: ToolResult = {
      success: true,
      action_taken: 'Created task',
      data: { id: '123' },
    }

    const result = await safeExecute(async () => expected, 'Fallback')
    expect(result).toEqual(expected)
  })

  it('catches a thrown error and returns a safe result', async () => {
    const result = await safeExecute(
      async () => { throw new Error('DB connection failed') },
      'Failed to execute task'
    )

    expect(result.success).toBe(false)
    expect(result.action_taken).toBe('Failed to execute task')
    expect(result.data).toEqual({ error: 'Error: DB connection failed' })
  })

  it('catches an async rejection', async () => {
    const result = await safeExecute(
      () => Promise.reject('Network error'),
      'Something went wrong'
    )

    expect(result.success).toBe(false)
    expect(result.action_taken).toBe('Something went wrong')
  })
})

describe('matchDynamicRules', () => {
  const rules: DynamicRule[] = [
    { id: 'r1', domain: 'health', pattern: '\\b(?:workout|exercise)\\b', action: 'tracker.checkin', confidence: 0.8 },
    { id: 'r2', domain: 'studying', pattern: '\\b(?:study|leren)\\b', action: 'study.log', confidence: 0.7 },
  ]

  it('matches input against a dynamic rule pattern', () => {
    const result = matchDynamicRules('log my workout', rules)
    expect(result).not.toBeNull()
    expect(result!.domain).toBe('health')
    expect(result!.action).toBe('tracker.checkin')
    expect(result!.params).toEqual({ content: 'log my workout' })
  })

  it('matches Dutch input', () => {
    const result = matchDynamicRules('ik ga leren', rules)
    expect(result).not.toBeNull()
    expect(result!.domain).toBe('studying')
    expect(result!.action).toBe('study.log')
  })

  it('returns null when no rules match', () => {
    const result = matchDynamicRules('buy groceries', rules)
    expect(result).toBeNull()
  })

  it('first matching rule wins', () => {
    const overlapping: DynamicRule[] = [
      { id: 'r1', domain: 'content', pattern: '\\bnote\\b', action: 'note.create', confidence: 0.9 },
      { id: 'r2', domain: 'content', pattern: '\\bnote\\b', action: 'note.query', confidence: 0.5 },
    ]
    const result = matchDynamicRules('create a note', overlapping)
    expect(result!.action).toBe('note.create')
  })

  it('sets routingMethod to "rule"', () => {
    const result = matchDynamicRules('log workout', rules)
    expect(result!.routingMethod).toBe('rule')
  })

  it('skips rules with invalid regex patterns', () => {
    const badRules: DynamicRule[] = [
      { id: 'bad', domain: 'extra', pattern: '[invalid(', action: 'system.help', confidence: 0.5 },
      { id: 'good', domain: 'health', pattern: '\\bworkout\\b', action: 'tracker.checkin', confidence: 0.8 },
    ]
    // Should not throw, should skip invalid and match the valid one
    const result = matchDynamicRules('log workout', badRules)
    expect(result).not.toBeNull()
    expect(result!.domain).toBe('health')
  })

  it('returns null for empty rule set', () => {
    const result = matchDynamicRules('anything', [])
    expect(result).toBeNull()
  })
})

describe('extractError', () => {
  it('extracts message and stack from Error instance', () => {
    const err = new Error('Something broke')
    const extracted = extractError(err)
    expect(extracted.message).toBe('Something broke')
    expect(extracted.stack).toBeDefined()
    expect(extracted.stack).toContain('Something broke')
  })

  it('converts string to message', () => {
    const extracted = extractError('plain string error')
    expect(extracted.message).toBe('plain string error')
    expect(extracted.stack).toBeUndefined()
  })

  it('converts number to stringified message', () => {
    const extracted = extractError(404)
    expect(extracted.message).toBe('404')
  })

  it('converts object to stringified message', () => {
    const extracted = extractError({ code: 'ERR' })
    expect(extracted.message).toBe('[object Object]')
  })

  it('handles null', () => {
    const extracted = extractError(null)
    expect(extracted.message).toBe('null')
  })
})
