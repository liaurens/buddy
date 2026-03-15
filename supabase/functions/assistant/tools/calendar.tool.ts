import type { ToolResult } from '../types.ts'

interface CalendarEvent {
  title: string
  start: string
  end: string
  location?: string
}

/**
 * Parses an iCal feed and returns today's events.
 * Basic VEVENT parser — handles SUMMARY, DTSTART, DTEND, LOCATION.
 */
function parseIcal(ical: string, targetDate: string): CalendarEvent[] {
  const events: CalendarEvent[] = []
  const eventBlocks = ical.split('BEGIN:VEVENT')

  for (let i = 1; i < eventBlocks.length; i++) {
    const block = eventBlocks[i]
    const summary = block.match(/SUMMARY[^:]*:(.+)/)?.[1]?.trim() ?? '(no title)'
    const dtstart = block.match(/DTSTART[^:]*:(\d+)/)?.[1] ?? ''
    const dtend = block.match(/DTEND[^:]*:(\d+)/)?.[1] ?? ''
    const location = block.match(/LOCATION[^:]*:(.+)/)?.[1]?.trim()

    if (!dtstart) continue

    // Check if this event is on the target date
    const eventDate = dtstart.substring(0, 8)
    if (eventDate !== targetDate.replace(/-/g, '')) continue

    const formatTime = (dt: string) => {
      if (dt.length < 12) return ''
      const h = dt.substring(8, 10)
      const m = dt.substring(10, 12)
      return `${h}:${m}`
    }

    events.push({
      title: summary,
      start: formatTime(dtstart),
      end: formatTime(dtend),
      location,
    })
  }

  return events.sort((a, b) => a.start.localeCompare(b.start))
}

export async function getTodayEvents(
  userId: string,
  // deno-lint-ignore no-explicit-any
  supabase: any
): Promise<ToolResult> {
  // Get calendar URL from settings
  const { data: setting } = await supabase
    .from('settings')
    .select('value')
    .eq('user_id', userId)
    .eq('key', 'calendar_url')
    .single()

  if (!setting?.value) {
    return {
      success: false,
      action_taken: 'No calendar URL configured in settings',
      data: {},
    }
  }

  try {
    const response = await fetch(setting.value)
    if (!response.ok) {
      return {
        success: false,
        action_taken: 'Could not fetch calendar',
        data: { status: response.status },
      }
    }

    const ical = await response.text()
    const today = new Date().toISOString().split('T')[0]
    const events = parseIcal(ical, today)

    if (events.length === 0) {
      return {
        success: true,
        action_taken: 'No events today',
        data: { events: [], date: today },
      }
    }

    const summary = events
      .map(e => `${e.start} ${e.title}${e.location ? ` @ ${e.location}` : ''}`)
      .join('; ')

    return {
      success: true,
      action_taken: `Today: ${summary}`,
      data: { events, date: today },
    }
  } catch (err) {
    return {
      success: false,
      action_taken: 'Failed to load calendar',
      data: { error: String(err) },
    }
  }
}
