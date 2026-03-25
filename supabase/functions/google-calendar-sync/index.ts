/**
 * Google Calendar Sync — Daily cron job
 *
 * For each user with a Google Calendar token:
 * 1. Refreshes the access token if expired
 * 2. Fetches upcoming events (today + 7 days)
 * 3. Keeps only events with the user's chosen "important" colorId
 * 4. Creates a task in `todos` for each new important event
 * 5. Records the synced event to avoid duplicate tasks
 *
 * Required Supabase secrets:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *
 * Can be triggered:
 *   - By pg_cron daily at 7 AM
 *   - Manually via POST (no body needed)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Google Calendar color names for readable task titles
const GOOGLE_COLOR_NAMES: Record<number, string> = {
  1: 'Lavender',
  2: 'Sage',
  3: 'Grape',
  4: 'Flamingo',
  5: 'Banana',
  6: 'Tangerine',
  7: 'Peacock',
  8: 'Graphite',
  9: 'Blueberry',
  10: 'Basil',
  11: 'Tomato',
}

interface GoogleToken {
  user_id: string
  access_token: string
  refresh_token: string
  expires_at: string
  email: string | null
}

interface GoogleEvent {
  id: string
  summary?: string
  description?: string
  colorId?: string
  start: { date?: string; dateTime?: string }
  end: { date?: string; dateTime?: string }
}

interface UserCalendarSetting {
  value: string // JSON string
}

// deno-lint-ignore no-explicit-any
type SupabaseClient = any

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Fetch all users with Google Calendar tokens
  const { data: tokens, error: tokensError } = await supabase
    .from('google_calendar_tokens')
    .select('user_id, access_token, refresh_token, expires_at, email')

  if (tokensError) {
    console.error('Failed to fetch tokens:', tokensError.message)
    return jsonResponse({ error: 'Failed to fetch tokens' }, 500)
  }

  const results = []
  for (const token of (tokens as GoogleToken[]) ?? []) {
    const result = await syncUserCalendar(token, supabase, clientId, clientSecret)
    results.push({ user_id: token.user_id, ...result })
  }

  return jsonResponse({ synced: results.length, results })
})

async function syncUserCalendar(
  token: GoogleToken,
  supabase: SupabaseClient,
  clientId: string,
  clientSecret: string
): Promise<{ tasksCreated: number; error?: string }> {
  // Get user's important color setting (default: 11 = Tomato/Red)
  const { data: colorSetting } = await supabase
    .from('settings')
    .select('value')
    .eq('user_id', token.user_id)
    .eq('key', 'calendar_importantColorId')
    .single() as { data: UserCalendarSetting | null }

  const importantColorId = colorSetting
    ? parseInt(JSON.parse(colorSetting.value), 10)
    : 11

  // Check if auto-task creation is enabled (default: true)
  const { data: autoTaskSetting } = await supabase
    .from('settings')
    .select('value')
    .eq('user_id', token.user_id)
    .eq('key', 'calendar_autoCreateTasksFromCalendar')
    .single() as { data: UserCalendarSetting | null }

  const autoCreateTasks = autoTaskSetting
    ? JSON.parse(autoTaskSetting.value) !== false
    : true

  if (!autoCreateTasks) return { tasksCreated: 0 }

  // Refresh token if expired (5-minute buffer)
  let accessToken = token.access_token
  const expiresAt = new Date(token.expires_at)
  if (expiresAt <= new Date(Date.now() + 5 * 60 * 1000)) {
    const refreshed = await refreshAccessToken(token.refresh_token, clientId, clientSecret)
    if (refreshed.error) {
      return { tasksCreated: 0, error: `Token refresh failed: ${refreshed.error}` }
    }
    accessToken = refreshed.access_token!
    // Update stored token
    await supabase
      .from('google_calendar_tokens')
      .update({
        access_token: accessToken,
        expires_at: refreshed.expires_at,
      })
      .eq('user_id', token.user_id)
  }

  // Fetch events: today through next 7 days
  const timeMin = new Date()
  timeMin.setHours(0, 0, 0, 0)
  const timeMax = new Date(timeMin)
  timeMax.setDate(timeMax.getDate() + 7)

  const eventsUrl = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events')
  eventsUrl.searchParams.set('timeMin', timeMin.toISOString())
  eventsUrl.searchParams.set('timeMax', timeMax.toISOString())
  eventsUrl.searchParams.set('singleEvents', 'true')
  eventsUrl.searchParams.set('orderBy', 'startTime')
  eventsUrl.searchParams.set('maxResults', '50')

  const eventsRes = await fetch(eventsUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!eventsRes.ok) {
    const errText = await eventsRes.text()
    console.error(`Events fetch failed for user ${token.user_id}:`, errText)
    return { tasksCreated: 0, error: `Events fetch failed: ${eventsRes.status}` }
  }

  const eventsData = await eventsRes.json()
  const events: GoogleEvent[] = eventsData.items ?? []

  // Filter to only events with the important color
  const importantEvents = events.filter(
    e => e.colorId && parseInt(e.colorId, 10) === importantColorId
  )

  if (importantEvents.length === 0) return { tasksCreated: 0 }

  // Get already-synced event IDs for this user
  const eventIds = importantEvents.map(e => e.id)
  const { data: alreadySynced } = await supabase
    .from('google_calendar_synced_events')
    .select('google_event_id')
    .eq('user_id', token.user_id)
    .in('google_event_id', eventIds)

  const syncedIds = new Set((alreadySynced ?? []).map((r: { google_event_id: string }) => r.google_event_id))

  // Create tasks for new important events
  let tasksCreated = 0
  for (const event of importantEvents) {
    if (syncedIds.has(event.id)) continue

    const title = event.summary || '(untitled event)'
    const startDate = event.start.date || event.start.dateTime?.split('T')[0]
    const colorName = GOOGLE_COLOR_NAMES[importantColorId] ?? 'Important'

    // Insert the task
    const { data: task, error: taskError } = await supabase
      .from('todos')
      .insert({
        user_id: token.user_id,
        title: `[${colorName}] ${title}`,
        completed: false,
        due_date: startDate || null,
        priority: 'high',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (taskError) {
      console.error(`Failed to create task for event ${event.id}:`, taskError.message)
      continue
    }

    // Record the sync
    await supabase
      .from('google_calendar_synced_events')
      .insert({
        user_id: token.user_id,
        google_event_id: event.id,
        todo_id: task.id,
        event_start: startDate || new Date().toISOString().split('T')[0],
      })

    tasksCreated++
  }

  return { tasksCreated }
}

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token?: string; expires_at?: string; error?: string }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    return { error: await res.text() }
  }

  const data = await res.json()
  return {
    access_token: data.access_token,
    expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
