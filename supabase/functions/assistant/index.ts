import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { authenticateRequest } from './auth.ts'
import { resolveIntent } from './intent.ts'
import { dispatch } from './dispatcher.ts'
import { logInteraction } from './tools/learnings.tool.ts'
import type { AssistantRequest, AssistantResponse } from './types.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse body
    let body: AssistantRequest
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ success: false, error: 'Invalid JSON body', intent: 'unknown', action_taken: '', data: {} }, 400)
    }

    // Validate input
    if (!body.input || body.input.trim() === '') {
      return jsonResponse({ success: false, error: 'input is required', intent: 'unknown', action_taken: '', data: {} }, 400)
    }

    // Authenticate
    let userId: string
    try {
      userId = await authenticateRequest(req, body, supabase)
    } catch {
      return jsonResponse({ success: false, error: 'Authentication failed', intent: 'unknown', action_taken: '', data: {} }, 401)
    }

    // Load AI config from user settings (optional)
    const { data: aiSettings } = await supabase
      .from('settings')
      .select('key, value')
      .eq('user_id', userId)
      .in('key', ['ai_provider', 'ai_api_key'])

    const aiConfig = aiSettings?.reduce((acc: Record<string, string>, s: { key: string; value: string }) => {
      acc[s.key] = s.value
      return acc
    }, {})

    const aiProvider = aiConfig?.['ai_provider'] || 'anthropic'
    const aiKey = aiConfig?.['ai_api_key'] || ''

    // Detect intent
    const detected = await resolveIntent(
      body.input.trim(),
      aiKey ? { key: aiKey, provider: aiProvider } : undefined
    )

    // Execute
    const source = body.source || 'web'
    const result = await dispatch(detected, { userId, supabase, source })

    const latencyMs = Date.now() - startTime

    // Log interaction (non-blocking)
    logInteraction(
      userId,
      body.input,
      detected.intent,
      detected.method,
      result as Record<string, unknown>,
      source,
      0, // tokens_used — would need to be tracked per AI call
      latencyMs,
      supabase
    )

    const response: AssistantResponse = {
      success: result.success,
      intent: detected.intent,
      action_taken: result.action_taken,
      data: result.data,
      suggestions: result.suggestions,
    }

    return jsonResponse(response, result.success ? 200 : 422)
  } catch (err) {
    console.error('Assistant error:', err)
    return jsonResponse(
      { success: false, error: 'Internal server error', intent: 'unknown', action_taken: '', data: {} },
      500
    )
  }
})

function jsonResponse(body: AssistantResponse | { success: false; error: string; intent: string; action_taken: string; data: Record<string, unknown> }, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
