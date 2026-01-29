/**
 * Notification Scheduler Service
 * Frontend logic for scheduling and managing notifications
 */

import {
  scheduleNotification,
  cancelToolNotifications,
  getPendingNotifications,
} from './notification.service';
import type {
  ScheduleNotificationRequest,
  ScheduledNotification,
  ToolCategory,
  NotificationType,
} from './notification.types';

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
 * Schedule a daily notification at a specific time
 */
export async function scheduleDailyNotification(
  userId: string,
  toolCategory: ToolCategory,
  notificationType: NotificationType,
  timeString: string, // HH:MM format (e.g., "20:00")
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<ScheduledNotification | null> {
  const scheduledFor = parseTimeToNextOccurrence(timeString);

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
 * Parse time string (HH:MM) to next occurrence as Date
 */
function parseTimeToNextOccurrence(timeString: string): Date {
  const [hours, minutes] = timeString.split(':').map(Number);

  if (isNaN(hours) || isNaN(minutes)) {
    throw new Error(`Invalid time format: ${timeString}. Expected HH:MM`);
  }

  const now = new Date();
  const scheduled = new Date();
  scheduled.setHours(hours, minutes, 0, 0);

  // If time has passed today, schedule for tomorrow
  if (scheduled <= now) {
    scheduled.setDate(scheduled.getDate() + 1);
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
 * Task-specific: Schedule task due notification
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
