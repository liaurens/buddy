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
