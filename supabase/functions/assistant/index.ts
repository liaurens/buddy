import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { authenticateRequest } from './auth.ts'
import { handleRequest } from './core/general-manager.ts'
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

    // Route and execute via General Manager
    const source = body.source || 'web'
    const { response } = await handleRequest(
      body.input.trim(),
      { userId, supabase, source },
      aiKey ? { key: aiKey, provider: aiProvider } : undefined
    )

    return jsonResponse(response, response.success ? 200 : 422)
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
