import type { ToolResult } from '../types.ts'

export type LearningType = 'new_rule' | 'correction' | 'behavior' | 'note'

export interface Learning {
  id: string
  user_id: string
  type: LearningType
  content: Record<string, unknown>
  active: boolean
  created_at: string
}

export async function createLearning(
  userId: string,
  type: LearningType,
  content: Record<string, unknown>,
  // deno-lint-ignore no-explicit-any
  supabase: any
): Promise<ToolResult> {
  const { data, error } = await supabase
    .from('assistant_learnings')
    .insert({ user_id: userId, type, content })
    .select()
    .single()

  if (error) {
    return { success: false, action_taken: 'Failed to save learning', data: { error: error.message } }
  }

  return {
    success: true,
    action_taken: `Learning recorded (${type})`,
    data: { learning_id: data.id },
  }
}

export async function getLearnings(
  userId: string,
  // deno-lint-ignore no-explicit-any
  supabase: any,
  type?: LearningType
): Promise<Learning[]> {
  let query = supabase
    .from('assistant_learnings')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)
    .order('created_at', { ascending: false })

  if (type) {
    query = query.eq('type', type)
  }

  const { data } = await query
  return data ?? []
}

export async function logInteraction(
  userId: string,
  input: string,
  detectedIntent: string,
  detectionMethod: string,
  response: Record<string, unknown>,
  source: string,
  tokensUsed: number,
  latencyMs: number,
  // deno-lint-ignore no-explicit-any
  supabase: any,
  domain?: string,
  toolId?: string
): Promise<void> {
  try {
    await supabase.from('assistant_logs').insert({
      user_id: userId,
      input,
      detected_intent: detectedIntent,
      detection_method: detectionMethod,
      response,
      tokens_used: tokensUsed,
      latency_ms: latencyMs,
      source,
      domain: domain || null,
      tool_id: toolId || null,
    })
  } catch {
    // Non-critical, don't throw
  }
}
