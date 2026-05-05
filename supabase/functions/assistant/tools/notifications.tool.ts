import { parseTimeExpression } from '../date-parser.ts'
import type { ToolDefinition, ToolResult, AgentContext } from '../types.ts'

const VALID_TOOL_CATEGORIES = [
  'tracker', 'protocol', 'checkin', 'experiment',
  'tasks', 'notes', 'calendar', 'planning',
  'reflection', 'pomodoro', 'toolbox',
] as const

type ToolCategory = typeof VALID_TOOL_CATEGORIES[number]

function normalizeCategory(value: unknown, fallback: ToolCategory = 'planning'): ToolCategory {
  if (typeof value === 'string' && VALID_TOOL_CATEGORIES.includes(value as ToolCategory)) {
    return value as ToolCategory
  }
  return fallback
}

// ─── Action: schedule a one-off reminder by time-of-day ─────────────────────

export async function scheduleNotification(
  message: string,
  scheduledFor: Date,
  userId: string,
  // deno-lint-ignore no-explicit-any
  supabase: any,
  options: { toolCategory?: ToolCategory; notificationType?: string } = {}
): Promise<ToolResult> {
  if (scheduledFor.getTime() <= Date.now()) {
    return {
      success: false,
      action_taken: 'Refusing to schedule a notification in the past.',
      data: { error: 'past_time', scheduled_for: scheduledFor.toISOString() },
    }
  }

  const { data: notification, error } = await supabase
    .from('scheduled_notifications')
    .insert({
      user_id: userId,
      tool_category: options.toolCategory ?? 'planning',
      notification_type: options.notificationType ?? 'reminder',
      title: message,
      body: message,
      scheduled_for: scheduledFor.toISOString(),
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    return {
      success: false,
      action_taken: 'Failed to schedule notification',
      data: { error: error.message },
    }
  }

  return {
    success: true,
    action_taken: `Reminder set for ${scheduledFor.toISOString()}: "${message}"`,
    data: {
      notification_id: notification.id,
      scheduled_for: scheduledFor.toISOString(),
      message,
    },
  }
}

// ─── Handler: legacy /remind path (regex extracts content from raw input) ───

async function handleScheduleNotification(
  params: Record<string, unknown>,
  context: AgentContext
): Promise<ToolResult> {
  // Structured-params path (agent loop)
  const messageParam = typeof params.message === 'string' ? params.message : null
  const scheduledForParam = typeof params.scheduled_for === 'string' ? params.scheduled_for : null
  if (messageParam && scheduledForParam) {
    const date = new Date(scheduledForParam)
    if (Number.isNaN(date.getTime())) {
      return { success: false, action_taken: 'Invalid scheduled_for ISO timestamp', data: {} }
    }
    return scheduleNotification(messageParam, date, context.userId, context.supabase, {
      toolCategory: normalizeCategory(params.tool_category),
    })
  }

  // Legacy raw-text path
  const input = (params.content as string) || ''
  const time = parseTimeExpression(input)
  if (!time) {
    return {
      success: false,
      action_taken: 'Could not parse a time from your input. Try "om 14:00" or "in 2 uur".',
      data: {},
    }
  }

  const cleanMessage = input
    .replace(/\b(?:notificatie|herinnering|reminder|notification)\s*/gi, '')
    .replace(/\b(?:om|at)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, '')
    .replace(/\b(?:over|in)\s+\d+\s+(?:uur|hours?|minuten|minutes?|hr|min)\b/gi, '')
    .trim()
  const message = cleanMessage || 'Reminder'

  const scheduledFor = new Date()
  scheduledFor.setHours(time.hours, time.minutes, 0, 0)
  if (scheduledFor.getTime() <= Date.now()) {
    scheduledFor.setDate(scheduledFor.getDate() + 1)
  }
  return scheduleNotification(message, scheduledFor, context.userId, context.supabase)
}

// ─── Handler: relative-to-anchor scheduling (agent-loop path) ───────────────

async function handleScheduleRelative(
  params: Record<string, unknown>,
  context: AgentContext
): Promise<ToolResult> {
  const message = typeof params.message === 'string' ? params.message : ''
  const anchor = typeof params.anchor === 'string' ? params.anchor : ''
  if (!message || !anchor) {
    return { success: false, action_taken: 'message and anchor are required', data: {} }
  }
  const anchorDate = new Date(anchor)
  if (Number.isNaN(anchorDate.getTime())) {
    return { success: false, action_taken: `Invalid anchor ISO timestamp: ${anchor}`, data: {} }
  }
  const offsetDays = Number(params.offset_days) || 0
  const offsetHours = Number(params.offset_hours) || 0
  const offsetMinutes = Number(params.offset_minutes) || 0
  const totalMs =
    offsetDays * 86_400_000 + offsetHours * 3_600_000 + offsetMinutes * 60_000
  const scheduledFor = new Date(anchorDate.getTime() - totalMs)
  return scheduleNotification(message, scheduledFor, context.userId, context.supabase, {
    toolCategory: normalizeCategory(params.tool_category),
  })
}

// ─── Tool Definition ────────────────────────────────────────────────────────

export const notificationsTool: ToolDefinition = {
  id: 'notifications',
  domain: 'planning',
  description: 'Schedule reminders and notifications',

  actions: [
    {
      action: 'notification.schedule',
      description: 'Schedule a one-off reminder at a specific timestamp.',
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'What the reminder should say' },
          scheduled_for: { type: 'string', format: 'date-time', description: 'ISO 8601 timestamp when the reminder fires' },
          tool_category: {
            type: 'string',
            enum: [...VALID_TOOL_CATEGORIES],
            description: 'Which app section this reminder relates to (default: planning)',
          },
        },
        required: ['message', 'scheduled_for'],
      },
      handler: handleScheduleNotification,
    },
    {
      action: 'notification.schedule.relative',
      description: 'Schedule a reminder relative to a future anchor time (e.g. "1 week before deadline"). scheduled_for = anchor − offsets.',
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'What the reminder should say' },
          anchor: { type: 'string', format: 'date-time', description: 'The reference timestamp the reminder is offset from' },
          offset_days: { type: 'integer', description: 'Days before anchor (e.g. 7 for "a week before")' },
          offset_hours: { type: 'integer', description: 'Hours before anchor' },
          offset_minutes: { type: 'integer', description: 'Minutes before anchor' },
          tool_category: {
            type: 'string',
            enum: [...VALID_TOOL_CATEGORIES],
            description: 'Which app section this reminder relates to (default: planning)',
          },
        },
        required: ['message', 'anchor'],
      },
      handler: handleScheduleRelative,
    },
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
