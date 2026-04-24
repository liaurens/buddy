/**
 * Notifications Schedule Service
 *
 * Converts the user's notifications settings into concrete rows in
 * `scheduled_notifications`. Cancels stale rows for each tool category
 * before rescheduling so the table always reflects current preferences.
 */

import { getCategorySettings, type NotificationsSettings } from '../../../services/settings';
import { cancelToolNotifications } from '../../../services/notifications/notification.service';
import { scheduleDailyNotification } from '../../../services/notifications/scheduler.service';
import type { ToolCategory } from '../../../services/notifications/notification.types';

const ROUTINE_CATEGORIES: ToolCategory[] = ['routine_morning', 'routine_midday', 'routine_night'];

/**
 * Cancel all pending routine reminders and reschedule from current settings.
 * Call after the user saves Notifications settings.
 */
export async function reapplyNotificationSchedule(userId: string, settings?: NotificationsSettings): Promise<void> {
    const s = settings ?? (await getCategorySettings(userId, 'notifications'));

    // Cancel existing pending routine reminders
    await Promise.all(ROUTINE_CATEGORIES.map(cat => cancelToolNotifications(userId, cat)));

    // Re-schedule each enabled routine for its next occurrence
    if (s.morningEnabled) {
        await scheduleDailyNotification(
            userId,
            'routine_morning',
            'routine_reminder',
            s.morningTime,
            'Morning routine',
            'Start your day — comms, log yesterday, plan today.',
            { route: 'today', step: 'morning' },
        );
    }

    if (s.middayEnabled) {
        await scheduleDailyNotification(
            userId,
            'routine_midday',
            'routine_reminder',
            s.middayTime,
            'Midday replan',
            'Check in and adjust your afternoon blocks.',
            { route: 'today', step: 'midday' },
        );
    }

    if (s.nightEnabled) {
        await scheduleDailyNotification(
            userId,
            'routine_night',
            'routine_reminder',
            s.nightTime,
            'Night reflection',
            "Wrap the day — wins, blocker, tomorrow's priority.",
            { route: 'reflection', step: 'night' },
        );
    }
}
