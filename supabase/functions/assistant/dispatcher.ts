import type { DetectedIntent, ToolResult, AgentContext } from './types.ts'
import { createNote } from './tools/notes.tool.ts'
import { createTask, listTasks, completeTask } from './tools/tasks.tool.ts'
import { logCheckin, queryTracker, parseCheckinValues } from './tools/tracker.tool.ts'
import { getTodayEvents } from './tools/calendar.tool.ts'
import { getHabitsStatus } from './tools/habits.tool.ts'
import { scheduleNotification } from './tools/notifications.tool.ts'

/**
 * Routes a detected intent to the correct tool and executes it.
 */
export async function dispatch(
  detected: DetectedIntent,
  context: AgentContext
): Promise<ToolResult> {
  const { userId, supabase } = context
  const { intent, params } = detected
  const content = (params.content as string) || ''

  switch (intent) {
    case 'note.create.shopping':
      return createNote(content, userId, supabase, 'shop')

    case 'note.create':
      return createNote(content, userId, supabase)

    case 'task.create':
    case 'task.create.reminder':
      return createTask(content, userId, supabase, {
        isReminder: intent === 'task.create.reminder',
      })

    case 'task.list':
      return listTasks(userId, supabase)

    case 'task.list.today':
      return listTasks(userId, supabase, { todayOnly: true })

    case 'task.complete': {
      const target = (params.target as string) || content
      return completeTask(target, userId, supabase)
    }

    case 'tracker.checkin': {
      const values = parseCheckinValues(content)
      return logCheckin(values, userId, supabase)
    }

    case 'tracker.query': {
      const days = (params.days as number) || 7
      return queryTracker(userId, supabase, days)
    }

    case 'calendar.today':
      return getTodayEvents(userId, supabase)

    case 'habits.status':
      return getHabitsStatus(userId, supabase)

    case 'notification.schedule':
      return scheduleNotification(content, userId, supabase)

    case 'general.question':
    case 'unknown':
    default:
      // Fall back to note creation for unrecognized input
      return createNote(content || 'New note', userId, supabase)
  }
}
