import { parseTimeExpression } from '../date-parser.ts'
import type { ToolResult } from '../types.ts'

export async function scheduleNotification(
  input: string,
  userId: string,
  // deno-lint-ignore no-explicit-any
  supabase: any
): Promise<ToolResult> {
  const time = parseTimeExpression(input)

  // Extract the notification message (everything that isn't a time expression)
  const cleanMessage = input
    .replace(/\b(?:notificatie|herinnering|reminder|notification)\s*/gi, '')
    .replace(/\b(?:om|at)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, '')
    .replace(/\b(?:over|in)\s+\d+\s+(?:uur|hours?|minuten|minutes?|hr|min)\b/gi, '')
    .trim()

  const message = cleanMessage || 'Reminder'

  if (!time) {
    return {
      success: false,
      action_taken: 'Could not parse a time from your input. Try "om 14:00" or "in 2 uur".',
      data: {},
    }
  }

  const now = new Date()
  const scheduledFor = new Date(now)
  scheduledFor.setHours(time.hours, time.minutes, 0, 0)
  if (scheduledFor <= now) {
    scheduledFor.setDate(scheduledFor.getDate() + 1)
  }

  const { data: notification, error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      title: message,
      body: message,
      scheduled_for: scheduledFor.toISOString(),
      sent: false,
    })
    .select()
    .single()

  if (error) {
    return { success: false, action_taken: 'Failed to schedule notification', data: { error: error.message } }
  }

  const timeStr = `${String(time.hours).padStart(2, '0')}:${String(time.minutes).padStart(2, '0')}`
  return {
    success: true,
    action_taken: `Reminder set for ${timeStr}: "${message}"`,
    data: { notification_id: notification.id, scheduled_for: scheduledFor.toISOString(), message },
  }
}
