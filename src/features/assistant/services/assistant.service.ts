import { supabase } from '../../../services/supabase'
import type { AssistantRequest, AssistantResponse } from '../types'

/**
 * Calls the assistant edge function with an authenticated session.
 */
export async function sendAssistantMessage(input: string): Promise<AssistantResponse> {
  const { data, error } = await supabase.functions.invoke('assistant', {
    body: { input, source: 'web' } satisfies AssistantRequest,
  })

  if (error) {
    return {
      success: false,
      intent: 'unknown',
      action_taken: '',
      data: {},
      error: error.message || 'Request failed',
    }
  }

  return data as AssistantResponse
}

/**
 * Directly invoke a tool action with structured params, bypassing natural-language routing.
 * Used by dedicated UIs (e.g. Planner) that already know the action to run.
 */
export async function invokeAssistantAction(
  domain: string,
  action: string,
  params: Record<string, unknown> = {}
): Promise<AssistantResponse> {
  const { data, error } = await supabase.functions.invoke('assistant', {
    body: { input: '', source: 'web', domain, action, params } satisfies AssistantRequest,
  })

  if (error) {
    return {
      success: false,
      intent: action,
      action_taken: '',
      data: {},
      error: error.message || 'Request failed',
    }
  }

  return data as AssistantResponse
}
