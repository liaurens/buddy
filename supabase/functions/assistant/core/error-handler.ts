/**
 * Error Handler — Structured error handling for the assistant pipeline.
 *
 * Captures errors with context (which step, which domain, what input)
 * so the HR agent can analyze patterns.
 */

import type { ToolResult } from '../types.ts'

export interface ProcessingStep {
  step: string
  durationMs: number
  result: 'success' | 'error' | 'skipped'
  error?: string
}

export class PipelineTracker {
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

/**
 * Wraps a tool execution with error handling.
 * Returns a safe ToolResult even if the handler throws.
 */
export async function safeExecute(
  fn: () => Promise<ToolResult>,
  fallbackMessage: string
): Promise<ToolResult> {
  try {
    return await fn()
  } catch (err) {
    console.error(`Tool execution error: ${err}`)
    return {
      success: false,
      action_taken: fallbackMessage,
      data: { error: String(err) },
    }
  }
}
