import { parseTimeExpression } from '../date-parser.ts'
import type { ToolDefinition, ToolResult, AgentContext } from '../types.ts'

// ─── Action Handler ─────────────────────────────────────────────────────────

export async function scheduleNotification(
  input: string,
  userId: string,
  // deno-lint-ignore no-explicit-any
  supabase: any
): Promise<ToolResult> {
  const time = parseTimeExpression(input)

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

// ─── Tool Definition ────────────────────────────────────────────────────────

async function handleScheduleNotification(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const content = (params.content as string) || ''
  return scheduleNotification(content, context.userId, context.supabase)
}

export const notificationsTool: ToolDefinition = {
  id: 'notifications',
  domain: 'planning',
  description: 'Schedule reminders and notifications',

  actions: [
    { action: 'notification.schedule', description: 'Schedule a notification', handler: handleScheduleNotification },
  ],

  commands: [
    { command: '/remind', action: 'notification.schedule', description: 'Set a reminder: /remind 14:00 call dentist' },
  ],

  rules: [
    {
      pattern: /\b(?:notificatie|herinnering|reminder|notification|herinner me om)\b/i,
      action: 'notification.schedule',
      extractParams: (_m, input) => ({ content: input }),
    },
  ],
}
