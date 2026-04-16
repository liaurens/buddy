import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { authenticateRequest } from './auth.ts'
import { handleRequest } from './core/general-manager.ts'
import { logError, extractError } from './core/error-logger.ts'
import { getManager } from './managers/index.ts'
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

  let supabase: ReturnType<typeof createClient> | undefined
  let inputText = ''

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse body
    let body: AssistantRequest
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ success: false, error: 'Invalid JSON body', intent: 'unknown', action_taken: '', data: {} }, 400)
    }

    inputText = body.input || ''

    const isDirect = Boolean(body.action && body.domain)

    // Validate input (only required for routed path)
    if (!isDirect && (!body.input || body.input.trim() === '')) {
      return jsonResponse({ success: false, error: 'input is required', intent: 'unknown', action_taken: '', data: {} }, 400)
    }

    // Authenticate
    let userId: string
    try {
      userId = await authenticateRequest(req, body, supabase)
    } catch (err) {
      const { message, stack } = extractError(err)
      // Log auth error with whatever context we have
      logError({
        userId: 'unknown',
        input: inputText,
        errorType: 'auth_error',
        errorMessage: message,
        errorStack: stack,
        step: 'auth',
        requestMetadata: { source: body.source },
      }, supabase)
      return jsonResponse({ success: false, error: 'Authentication failed', intent: 'unknown', action_taken: '', data: {} }, 401)
    }

    // Load AI config from user settings (optional)
    const { data: aiSettings } = await supabase
      .from('settings')
      .select('key, value')
      .eq('user_id', userId)
      .in('key', ['ai_aiProvider', 'ai_aiApiKey', 'ai_aiModel'])

    const aiConfig = aiSettings?.reduce((acc: Record<string, string>, s: { key: string; value: string }) => {
      acc[s.key] = s.value
      return acc
    }, {})

    const aiProvider = aiConfig?.['ai_aiProvider'] || 'anthropic'
    const aiKey = aiConfig?.['ai_aiApiKey'] || ''
    const rawModel = aiConfig?.['ai_aiModel']
    const aiModel = (rawModel && rawModel !== 'null') ? rawModel : undefined
    const resolvedAiConfig = aiKey ? { key: aiKey, provider: aiProvider, model: aiModel } : undefined

    const source = body.source || 'web'
    const context = { userId, supabase, source, aiConfig: resolvedAiConfig }

    // Direct-invoke path: skip routing and call the handler for (domain, action).
    // Used by dedicated UIs that already know which action to run with which params.
    if (isDirect) {
      const manager = getManager(body.domain!)
      if (!manager.hasAction(body.action!)) {
        return jsonResponse({
          success: false,
          error: `Unknown action "${body.action}" for domain "${body.domain}"`,
          intent: body.action!,
          action_taken: '',
          data: {},
        }, 400)
      }
      const result = await manager.execute(body.action!, body.params ?? {}, context)
      return jsonResponse({
        success: result.success,
        intent: body.action!,
        domain: body.domain,
        action_taken: result.action_taken,
        data: result.data,
        suggestions: result.suggestions,
      } as AssistantResponse, 200)
    }

    // Route and execute via General Manager
    const { response } = await handleRequest(body.input.trim(), context)

    return jsonResponse(response, 200)
  } catch (err) {
    console.error('Assistant error:', err)
    const { message, stack } = extractError(err)
    // Log unhandled errors
    if (supabase) {
      logError({
        userId: 'unknown',
        input: inputText,
        errorType: 'execution_error',
        errorMessage: message,
        errorStack: stack,
        step: 'execution',
        requestMetadata: { unhandled: true },
      }, supabase)
    }
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
