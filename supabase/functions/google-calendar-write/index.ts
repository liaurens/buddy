// Supabase Edge Function: Google Calendar Write
// Create / update / delete a single Calendar event for a todo, with token refresh
// and idempotent (deterministic-id) creates.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  corsHeaders, json, serviceClient, getUserId, getFreshAccessToken,
  GoogleAuthError, GOOGLE_CALENDAR_API, deterministicEventId,
} from '../_shared/googleCalendar.ts'

interface EventInput {
  summary: string
  description?: string
  location?: string
  start: string      // ISO datetime, or YYYY-MM-DD for all-day
  end: string
  isAllDay: boolean
  timeZone?: string
}

interface WriteBody {
  action: 'create' | 'update' | 'delete'
  todoId: string
  googleEventId?: string
  event?: EventInput
}

function buildEventResource(event: EventInput) {
  const start = event.isAllDay
    ? { date: event.start.slice(0, 10) }
    : { dateTime: event.start, timeZone: event.timeZone || 'UTC' }
  const end = event.isAllDay
    ? { date: event.end.slice(0, 10) }
    : { dateTime: event.end, timeZone: event.timeZone || 'UTC' }
  return {
    summary: event.summary,
    description: event.description ?? undefined,
    location: event.location ?? undefined,
    start,
    end,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const userId = await getUserId(req)
    const body = await req.json() as WriteBody
    if (!body.todoId) return json({ error: 'todoId required' }, 400)

    const supabase = serviceClient()

    // Defense-in-depth: confirm the todo belongs to the caller.
    const { data: todo } = await supabase
      .from('todos')
      .select('id, user_id')
      .eq('id', body.todoId)
      .eq('user_id', userId)
      .maybeSingle()
    if (!todo) return json({ error: 'todo_not_found' }, 404)

    let accessToken: string
    let calendarId: string
    try {
      const fresh = await getFreshAccessToken(supabase, userId)
      accessToken = fresh.accessToken
      calendarId = fresh.calendarId
    } catch (e) {
      if (e instanceof GoogleAuthError) return json({ error: e.code, code: e.code }, 409)
      throw e
    }

    const eventsUrl = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`
    const authHeaders = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
    const eventId = body.googleEventId || deterministicEventId(body.todoId)

    if (body.action === 'delete') {
      const res = await fetch(`${eventsUrl}/${encodeURIComponent(eventId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      // 404/410 = already gone, treat as success.
      if (!res.ok && res.status !== 404 && res.status !== 410) {
        return json({ error: `Google delete failed: ${res.status}` }, 502)
      }
      await supabase
        .from('todos')
        .update({ google_event_id: null, google_calendar_id: null, google_synced_at: new Date().toISOString() })
        .eq('id', body.todoId)
        .eq('user_id', userId)
      return json({ success: true })
    }

    if (!body.event) return json({ error: 'event required' }, 400)
    const resource = buildEventResource(body.event)

    // create: POST with deterministic id; on 409 (exists) fall through to PUT.
    // update: PUT; on 404/410 (missing) fall through to POST.
    let res: Response
    if (body.action === 'create') {
      res = await fetch(eventsUrl, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ id: eventId, ...resource }),
      })
      if (res.status === 409) {
        res = await fetch(`${eventsUrl}/${encodeURIComponent(eventId)}`, {
          method: 'PUT', headers: authHeaders, body: JSON.stringify(resource),
        })
      }
    } else {
      res = await fetch(`${eventsUrl}/${encodeURIComponent(eventId)}`, {
        method: 'PUT', headers: authHeaders, body: JSON.stringify(resource),
      })
      if (res.status === 404 || res.status === 410) {
        res = await fetch(eventsUrl, {
          method: 'POST', headers: authHeaders, body: JSON.stringify({ id: eventId, ...resource }),
        })
      }
    }

    if (!res.ok) {
      const text = await res.text()
      console.error('Google write failed:', res.status, text)
      return json({ error: `Google write failed: ${res.status}` }, 502)
    }

    const created = await res.json() as { id: string; htmlLink?: string }
    await supabase
      .from('todos')
      .update({
        google_event_id: created.id,
        google_calendar_id: calendarId,
        google_synced_at: new Date().toISOString(),
      })
      .eq('id', body.todoId)
      .eq('user_id', userId)

    return json({ success: true, googleEventId: created.id, googleCalendarId: calendarId, htmlLink: created.htmlLink })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message === 'Authentication required' ? 401 : 500
    console.error('google-calendar-write error:', message)
    return json({ error: message }, status)
  }
})
