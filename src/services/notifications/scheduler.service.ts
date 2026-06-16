/**
 * Notification Scheduler Service
 * Frontend logic for scheduling and managing notifications
 */

import {
  scheduleNotification,
  cancelToolNotifications,
  cancelNotificationsBySource,
  getPendingNotifications,
} from './notification.service';
import type {
  ScheduleNotificationRequest,
  ScheduledNotification,
  ToolCategory,
  NotificationType,
} from './notification.types';

export type ReminderCadence = 'single' | 'smart' | 'aggressive';

export interface TaskReminderInput {
  userId: string;
  taskId: string;
  taskTitle: string;
  dueAt?: Date;                     // resolved due date+time
  offsetMinutes?: number;           // minutes before dueAt
  absoluteAt?: Date;                // overrides offset
  cadence?: ReminderCadence;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

/**
 * Schedule a notification for a specific time
 */
export async function scheduleNotificationAt(
  userId: string,
  toolCategory: ToolCategory,
  notificationType: NotificationType,
  scheduledFor: Date,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<ScheduledNotification | null> {
  const request: ScheduleNotificationRequest = {
    userId,
    toolCategory,
    notificationType,
    scheduledFor,
    title,
    body,
    data,
  };

  return scheduleNotification(request);
}

/**
 * Schedule a notification with source tracking (for cancellation/dedup).
 */
export async function scheduleNotificationWithSource(
  userId: string,
  toolCategory: ToolCategory,
  notificationType: NotificationType,
  scheduledFor: Date,
  title: string,
  body: string,
  options: {
    data?: Record<string, any>;
    sourceType?: string;
    sourceId?: string;
    dedupKey?: string;
  } = {}
): Promise<ScheduledNotification | null> {
  if (scheduledFor.getTime() <= Date.now()) return null;
  return scheduleNotification({
    userId,
    toolCategory,
    notificationType,
    scheduledFor,
    title,
    body,
    data: options.data,
    sourceType: options.sourceType,
    sourceId: options.sourceId,
    dedupKey: options.dedupKey,
  });
}

/**
 * Schedule a daily notification at a specific time.
 * Pass `daysOfWeek` (0=Sun … 6=Sat) to restrict which days it may fire on;
 * the next occurrence lands on the first allowed day.
 */
export async function scheduleDailyNotification(
  userId: string,
  toolCategory: ToolCategory,
  notificationType: NotificationType,
  timeString: string, // HH:MM format (e.g., "20:00")
  title: string,
  body: string,
  data?: Record<string, any>,
  daysOfWeek?: number[]
): Promise<ScheduledNotification | null> {
  const scheduledFor = parseTimeToNextOccurrence(timeString, daysOfWeek);
  if (!scheduledFor) return null; // no allowed days → nothing to schedule

  return scheduleNotificationAt(
    userId,
    toolCategory,
    notificationType,
    scheduledFor,
    title,
    body,
    data
  );
}

/**
 * Schedule a notification relative to now (e.g., 15 minutes from now)
 */
export async function scheduleNotificationIn(
  userId: string,
  toolCategory: ToolCategory,
  notificationType: NotificationType,
  minutes: number,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<ScheduledNotification | null> {
  const scheduledFor = new Date(Date.now() + minutes * 60 * 1000);

  return scheduleNotificationAt(
    userId,
    toolCategory,
    notificationType,
    scheduledFor,
    title,
    body,
    data
  );
}

/**
 * Cancel all pending notifications for a tool
 */
export async function cancelNotifications(
  userId: string,
  toolCategory: ToolCategory
): Promise<boolean> {
  return cancelToolNotifications(userId, toolCategory);
}

/**
 * Get all pending notifications for user
 */
export async function getUpcomingNotifications(
  userId: string
): Promise<ScheduledNotification[]> {
  return getPendingNotifications(userId);
}

/**
 * Get pending notifications for a specific tool
 */
export async function getToolNotifications(
  userId: string,
  toolCategory: ToolCategory
): Promise<ScheduledNotification[]> {
  const allPending = await getPendingNotifications(userId);
  return allPending.filter((n) => n.toolCategory === toolCategory);
}

/**
 * Parse time string (HH:MM) to next occurrence as Date.
 * With `daysOfWeek` (0=Sun … 6=Sat), advances to the first allowed weekday.
 * Returns null when daysOfWeek is an empty list (nothing allowed).
 */
function parseTimeToNextOccurrence(timeString: string, daysOfWeek?: number[]): Date | null {
  const [hours, minutes] = timeString.split(':').map(Number);

  if (isNaN(hours) || isNaN(minutes)) {
    throw new Error(`Invalid time format: ${timeString}. Expected HH:MM`);
  }

  const allowed = daysOfWeek && daysOfWeek.length < 7 ? new Set(daysOfWeek) : null;
  if (daysOfWeek && daysOfWeek.length === 0) return null;

  const now = new Date();
  const scheduled = new Date();
  scheduled.setHours(hours, minutes, 0, 0);

  // If time has passed today, schedule for tomorrow
  if (scheduled <= now) {
    scheduled.setDate(scheduled.getDate() + 1);
  }

  if (allowed) {
    // Advance to the first allowed weekday (at most 6 extra days).
    for (let i = 0; i < 7 && !allowed.has(scheduled.getDay()); i++) {
      scheduled.setDate(scheduled.getDate() + 1);
    }
  }

  return scheduled;
}

/**
 * Reschedule a recurring notification (e.g., daily tracker reminder)
 */
export async function rescheduleRecurringNotification(
  userId: string,
  toolCategory: ToolCategory,
  notificationType: NotificationType,
  timeString: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<ScheduledNotification | null> {
  // Cancel existing notifications for this tool
  await cancelToolNotifications(userId, toolCategory);

  // Schedule new notification
  return scheduleDailyNotification(
    userId,
    toolCategory,
    notificationType,
    timeString,
    title,
    body,
    data
  );
}

/**
 * Tracker-specific: Schedule daily tracker reminder
 */
export async function scheduleTrackerReminder(
  userId: string,
  reminderTime: string,
  trackerNames: string[]
): Promise<ScheduledNotification | null> {
  const title = 'Daily Tracker Reminder';
  const body =
    trackerNames.length > 0
      ? `Time to log: ${trackerNames.join(', ')}`
      : 'Time to complete your daily check-in';

  return scheduleDailyNotification(
    userId,
    'tracker',
    'tracker_reminder',
    reminderTime,
    title,
    body,
    { trackerNames }
  );
}

/**
 * Protocol-specific: Schedule dose reminder
 */
export async function scheduleProtocolDose(
  userId: string,
  protocolName: string,
  doseTime: string,
  advanceMinutes: number = 0
): Promise<ScheduledNotification | null> {
  const title = 'Protocol Reminder';
  const body = `Time to take: ${protocolName}`;

  const scheduledFor = parseTimeToNextOccurrence(doseTime);
  if (!scheduledFor) return null;

  // Adjust for advance notification
  if (advanceMinutes > 0) {
    scheduledFor.setMinutes(scheduledFor.getMinutes() - advanceMinutes);
  }

  return scheduleNotificationAt(
    userId,
    'protocol',
    'protocol_dose',
    scheduledFor,
    title,
    body,
    { protocolName, doseTime }
  );
}

/**
 * CheckIn-specific: Schedule daily check-in reminder
 */
export async function scheduleCheckInReminder(
  userId: string,
  reminderTime: string
): Promise<ScheduledNotification | null> {
  const title = 'Daily Check-In';
  const body = "Don't forget to complete your daily check-in!";

  return scheduleDailyNotification(
    userId,
    'checkin',
    'checkin_daily',
    reminderTime,
    title,
    body
  );
}

/**
 * Task-specific: Schedule task due notification (legacy, single-shot).
 */
export async function scheduleTaskDue(
  userId: string,
  taskTitle: string,
  dueDate: Date,
  advanceMinutes: number = 15
): Promise<ScheduledNotification | null> {
  const title = 'Task Due Soon';
  const body = `"${taskTitle}" is due soon`;

  const scheduledFor = new Date(dueDate.getTime() - advanceMinutes * 60 * 1000);

  return scheduleNotificationAt(
    userId,
    'tasks',
    'task_due',
    scheduledFor,
    title,
    body,
    { taskTitle, dueDate: dueDate.toISOString() }
  );
}

/**
 * Cancel all pending reminders for a task.
 */
export async function cancelTaskReminders(userId: string, taskId: string): Promise<boolean> {
  return cancelNotificationsBySource(userId, 'task', taskId);
}

/**
 * Compute the firing times for a task reminder based on cadence + due/absolute.
 */
export function computeTaskReminderFireTimes(input: TaskReminderInput): Array<{ at: Date; type: 'pre' | 'at' | 'late'; lateMinutes?: number }> {
  const cadence = input.cadence || 'smart';
  const fires: Array<{ at: Date; type: 'pre' | 'at' | 'late'; lateMinutes?: number }> = [];

  // Absolute mode: a single explicit datetime, no escalation.
  if (input.absoluteAt) {
    fires.push({ at: input.absoluteAt, type: 'at' });
    return fires;
  }

  if (!input.dueAt) return fires;

  const offset = input.offsetMinutes ?? 15;
  const preTime = new Date(input.dueAt.getTime() - offset * 60_000);

  if (cadence === 'single') {
    fires.push({ at: preTime, type: 'pre' });
    return fires;
  }

  // smart + aggressive both include pre + at
  fires.push({ at: preTime, type: 'pre' });
  fires.push({ at: input.dueAt, type: 'at' });

  if (cadence === 'smart') {
    fires.push({ at: new Date(input.dueAt.getTime() + 15 * 60_000), type: 'late', lateMinutes: 15 });
    fires.push({ at: new Date(input.dueAt.getTime() + 60 * 60_000), type: 'late', lateMinutes: 60 });
  } else {
    // aggressive
    fires.push({ at: new Date(input.dueAt.getTime() + 15 * 60_000), type: 'late', lateMinutes: 15 });
    fires.push({ at: new Date(input.dueAt.getTime() + 30 * 60_000), type: 'late', lateMinutes: 30 });
    fires.push({ at: new Date(input.dueAt.getTime() + 60 * 60_000), type: 'late', lateMinutes: 60 });
    fires.push({ at: new Date(input.dueAt.getTime() + 120 * 60_000), type: 'late', lateMinutes: 120 });
  }

  return fires;
}

/**
 * Schedule per-task reminders with cadence.
 * Cancels any existing pending reminders for this task, then enqueues fresh rows.
 */
export async function scheduleTaskReminders(input: TaskReminderInput): Promise<ScheduledNotification[]> {
  // Always cancel existing first so updates don't pile up.
  await cancelTaskReminders(input.userId, input.taskId);

  const fires = computeTaskReminderFireTimes(input);
  if (fires.length === 0) return [];

  const results: ScheduledNotification[] = [];
  for (const fire of fires) {
    let title: string;
    let body: string;
    if (fire.type === 'pre') {
      title = 'Task coming up';
      body = `"${input.taskTitle}" is due soon`;
    } else if (fire.type === 'at') {
      title = 'Task due now';
      body = `Time to do: "${input.taskTitle}"`;
    } else {
      title = 'Still need to do this';
      body = `"${input.taskTitle}" is ${fire.lateMinutes} min overdue`;
    }

    const result = await scheduleNotificationWithSource(
      input.userId,
      'tasks',
      'task_reminder',
      fire.at,
      title,
      body,
      {
        data: {
          taskId: input.taskId,
          taskTitle: input.taskTitle,
          fireType: fire.type,
          route: 'tasks',
          sourceType: 'task',
          actions: [
            { action: 'done', title: 'Mark done' },
            { action: 'snooze', title: 'Snooze 15m' },
          ],
        },
        sourceType: 'task',
        sourceId: input.taskId,
      }
    );
    if (result) results.push(result);
  }
  return results;
}

/**
 * Pomodoro-specific: Schedule pomodoro completion notification
 */
export async function schedulePomodoroComplete(
  userId: string,
  minutes: number,
  sessionType: 'work' | 'break'
): Promise<ScheduledNotification | null> {
  const title =
    sessionType === 'work' ? 'Work Session Complete' : 'Break Time Over';
  const body =
    sessionType === 'work'
      ? 'Great focus! Time for a break.'
      : 'Break is over. Ready to focus?';

  return scheduleNotificationIn(
    userId,
    'pomodoro',
    'pomodoro_complete',
    minutes,
    title,
    body,
    { sessionType }
  );
}

/**
 * Calendar-specific: Schedule calendar event reminder
 */
export async function scheduleCalendarEvent(
  userId: string,
  eventTitle: string,
  eventStart: Date,
  advanceMinutes: number = 15
): Promise<ScheduledNotification | null> {
  const title = 'Upcoming Event';
  const body = `"${eventTitle}" starts in ${advanceMinutes} minutes`;

  const scheduledFor = new Date(
    eventStart.getTime() - advanceMinutes * 60 * 1000
  );

  return scheduleNotificationAt(
    userId,
    'calendar',
    'calendar_event',
    scheduledFor,
    title,
    body,
    { eventTitle, eventStart: eventStart.toISOString() }
  );
}
