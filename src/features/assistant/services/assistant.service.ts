import { supabase } from '../../../services/supabase'
import { captureOutbox, type DeliveryResult } from '../../../services/offline/captureOutbox'
import { logAppEvent } from '../../../services/app-events'
import type { AssistantRequest, AssistantResponse } from '../types'
import type { AssistantCommandMetadata } from '../types'

/** Intent used for the synthetic response when a capture is queued offline. */
export const OFFLINE_CAPTURE_INTENT = 'capture.offline'

interface InvokeResult {
  response: AssistantResponse
  networkError: boolean
}

function isNetworkError(error: { name?: string; message?: string }): boolean {
  if (error.name === 'FunctionsFetchError') return true
  return /failed to fetch|network|load failed|fetch failed/i.test(error.message ?? '')
}

/**
 * Raw call to the assistant edge function — no offline handling. Used both by
 * the user-facing send path and by the outbox flush (which must not re-queue).
 */
async function invokeAssistant(input: string): Promise<InvokeResult> {
  const { data, error } = await supabase.functions.invoke('assistant', {
    body: { input, source: 'web' } satisfies AssistantRequest,
  })

  if (error) {
    return {
      networkError: isNetworkError(error),
      response: {
        success: false,
        intent: 'unknown',
        action_taken: '',
        data: {},
        error: error.message || 'Request failed',
      },
    }
  }

  return { response: data as AssistantResponse, networkError: false }
}

async function queueOfflineCapture(input: string): Promise<AssistantResponse> {
  await captureOutbox.enqueue(input)
  void logAppEvent('capture_submitted', { offline: true })
  return {
    success: true,
    intent: OFFLINE_CAPTURE_INTENT,
    action_taken: "Saved offline — it will sync automatically when you're back online.",
    data: {},
  }
}

/**
 * Calls the assistant edge function with an authenticated session.
 * Offline-safe: with no connectivity (or a network-level failure) the capture
 * is written to the local outbox instead of being lost, and replayed later.
 */
export async function sendAssistantMessage(input: string): Promise<AssistantResponse> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return queueOfflineCapture(input)
  }

  const { response, networkError } = await invokeAssistant(input)
  if (networkError) {
    return queueOfflineCapture(input)
  }

  void logAppEvent('capture_submitted', { offline: false, success: response.success })
  return response
}

/**
 * Replay any captures queued while offline. Items are removed once the server
 * has received them (even if it answered with a domain-level error — retrying
 * those forever would wedge the queue); network failures stop the flush.
 */
export async function flushPendingCaptures(): Promise<number> {
  const { delivered } = await captureOutbox.flush(async (text): Promise<DeliveryResult> => {
    const { networkError } = await invokeAssistant(text)
    if (networkError) return 'retry'
    void logAppEvent('capture_synced')
    return 'delivered'
  })
  return delivered
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
