// Supabase Edge Function: Google Calendar Auth
// OAuth code exchange (PKCE), disconnect (revoke), and connection status.
// Tokens are stored in the service-role-only google_calendar_credentials vault.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  corsHeaders, json, serviceClient, getUserId,
  GOOGLE_TOKEN_URL, GOOGLE_REVOKE_URL, GOOGLE_USERINFO_URL, GOOGLE_CALENDAR_SCOPE,
} from '../_shared/googleCalendar.ts'

interface AuthBody {
  action: 'exchange' | 'disconnect' | 'status'
  code?: string
  code_verifier?: string
  redirect_uri?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const userId = await getUserId(req)
    const body = await req.json() as AuthBody
    const supabase = serviceClient()

    if (body.action === 'status') {
      const { data } = await supabase
        .from('google_calendar_credentials')
        .select('google_email, status')
        .eq('user_id', userId)
        .maybeSingle()
      const connected = !!data && data.status === 'connected'
      return json({ connected, googleEmail: data?.google_email ?? null, status: data?.status ?? 'disconnected' })
    }

    if (body.action === 'disconnect') {
      const { data } = await supabase
        .from('google_calendar_credentials')
        .select('refresh_token')
        .eq('user_id', userId)
        .maybeSingle()
      const refreshToken = (data as { refresh_token?: string } | null)?.refresh_token
      if (refreshToken) {
        try {
          await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(refreshToken)}`, { method: 'POST' })
        } catch (e) {
          console.warn('Google token revoke failed (continuing):', e)
        }
      }
      await supabase.from('google_calendar_credentials').delete().eq('user_id', userId)
      return json({ connected: false })
    }

    if (body.action === 'exchange') {
      if (!body.code || !body.code_verifier || !body.redirect_uri) {
        return json({ error: 'Missing code, code_verifier, or redirect_uri' }, 400)
      }

      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')!,
          client_secret: Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')!,
          code: body.code,
          code_verifier: body.code_verifier,
          redirect_uri: body.redirect_uri,
          grant_type: 'authorization_code',
        }),
      })

      if (!tokenRes.ok) {
        const text = await tokenRes.text()
        console.error('Token exchange failed:', tokenRes.status, text)
        return json({ error: 'Token exchange failed' }, 400)
      }

      const tokens = await tokenRes.json() as {
        access_token: string
        refresh_token?: string
        expires_in: number
        scope: string
      }

      if (!tokens.refresh_token) {
        // No refresh token => prior consent without offline access. Force re-consent.
        return json({ error: 'no_refresh_token' }, 400)
      }

      // Fetch the connected account email for display.
      let googleEmail: string | null = null
      try {
        const infoRes = await fetch(GOOGLE_USERINFO_URL, {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        })
        if (infoRes.ok) googleEmail = (await infoRes.json()).email ?? null
      } catch (e) {
        console.warn('userinfo fetch failed (continuing):', e)
      }

      const { error: upsertError } = await supabase
        .from('google_calendar_credentials')
        .upsert({
          user_id: userId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          scope: tokens.scope ?? GOOGLE_CALENDAR_SCOPE,
          google_email: googleEmail,
          status: 'connected',
        }, { onConflict: 'user_id' })

      if (upsertError) {
        console.error('Credential upsert failed:', upsertError)
        return json({ error: 'Failed to store credentials' }, 500)
      }

      return json({ connected: true, googleEmail })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message === 'Authentication required' ? 401 : 500
    console.error('google-calendar-auth error:', message)
    return json({ error: message }, status)
  }
})
