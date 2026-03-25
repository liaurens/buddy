/**
 * Google Calendar OAuth Callback
 *
 * Flow:
 * 1. User clicks "Connect Google Calendar" in settings
 * 2. Frontend sends them to Google's consent screen
 * 3. Google redirects here with ?code=...&state=<jwt>
 * 4. We exchange code for tokens, store them, redirect user back
 *
 * Required Supabase secrets:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   FRONTEND_URL  (e.g. https://buddy4life.netlify.app)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!
  const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://buddy4life.netlify.app'

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const stateJwt = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  // User denied access
  if (error) {
    return Response.redirect(`${frontendUrl}/settings?google_calendar=denied`, 302)
  }

  if (!code || !stateJwt) {
    return Response.redirect(`${frontendUrl}/settings?google_calendar=error&reason=missing_params`, 302)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Verify the JWT from state to get userId
  const { data: { user }, error: authError } = await supabase.auth.getUser(stateJwt)
  if (authError || !user) {
    return Response.redirect(`${frontendUrl}/settings?google_calendar=error&reason=auth_failed`, 302)
  }
  const userId = user.id

  // Exchange authorization code for access + refresh tokens
  const redirectUri = `${supabaseUrl}/functions/v1/google-calendar-auth`
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    const errText = await tokenRes.text()
    console.error('Token exchange failed:', errText)
    return Response.redirect(`${frontendUrl}/settings?google_calendar=error&reason=token_exchange`, 302)
  }

  const tokens = await tokenRes.json()
  const { access_token, refresh_token, expires_in, scope } = tokens

  if (!refresh_token) {
    // Google only sends refresh_token on first authorization.
    // If missing, the user needs to revoke and re-authorize.
    return Response.redirect(`${frontendUrl}/settings?google_calendar=error&reason=no_refresh_token`, 302)
  }

  // Fetch Google account email for display
  let email: string | null = null
  try {
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    if (profileRes.ok) {
      const profile = await profileRes.json()
      email = profile.email ?? null
    }
  } catch {
    // Non-critical
  }

  const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString()

  // Upsert tokens (replace any existing connection)
  const { error: upsertError } = await supabase
    .from('google_calendar_tokens')
    .upsert({
      user_id: userId,
      access_token,
      refresh_token,
      expires_at: expiresAt,
      scope,
      email,
    }, { onConflict: 'user_id' })

  if (upsertError) {
    console.error('Token upsert failed:', upsertError.message)
    return Response.redirect(`${frontendUrl}/settings?google_calendar=error&reason=db_error`, 302)
  }

  // Success — redirect back to settings
  return Response.redirect(`${frontendUrl}/settings?google_calendar=connected`, 302)
})
