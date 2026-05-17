import { supabase } from '../../../services/supabase'
import type { AssistantRequest, AssistantResponse } from '../types'
import type { AssistantCommandMetadata } from '../types'

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
 * Fetch the live registry of slash commands from the backend. Used by the
 * frontend hint dropdown so it stays in sync with whichever tools are
 * actually registered server-side.
 */
export async function fetchAssistantCommands(): Promise<AssistantCommandMetadata[]> {
  const response = await invokeAssistantAction('extra', 'system.commands')
  const commands = (response.data?.commands as AssistantCommandMetadata[] | undefined) ?? []
  return commands
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
