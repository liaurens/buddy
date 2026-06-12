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

const ANCHOR_REAPPLY_KEY = 'notifications.anchorsAppliedAt';
const ANCHOR_REAPPLY_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12h

/**
 * Self-healing for the daily anchor notifications: re-applies the routine
 * schedule at most once per 12 hours on app open, so the morning/evening
 * nudges survive even if the server-side re-enqueue chain ever breaks.
 */
export async function ensureAnchorSchedule(userId: string): Promise<void> {
    try {
        const last = Number(localStorage.getItem(ANCHOR_REAPPLY_KEY) ?? 0);
        if (Date.now() - last < ANCHOR_REAPPLY_INTERVAL_MS) return;
        await reapplyNotificationSchedule(userId);
        localStorage.setItem(ANCHOR_REAPPLY_KEY, String(Date.now()));
    } catch (err) {
        console.warn('Failed to reapply anchor notification schedule:', err);
    }
}

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
            // Body is replaced with live counts (due/overdue/school) at send time.
            'Plan today — open to see what\'s due.',
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
            "Close the day — 90 seconds: wins, blocker, tomorrow's one thing.",
            { route: 'reflection', step: 'night' },
        );
    }
}
