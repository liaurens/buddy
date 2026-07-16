/**
 * App usage instrumentation.
 *
 * Fire-and-forget logging into the `app_events` table so we can answer
 * "is the app being opened, and from where?" with data instead of guesses.
 * Logging must never break the UX: failures are logged to the console and
 * swallowed.
 */

import { supabase } from '../supabase';

export type AppEventType =
    | 'app_open'
    | 'route_visit'
    | 'capture_submitted'
    | 'capture_synced'
    | 'task_auto_sorted'
    | 'task_sort_corrected'
    | 'task_sort_undone'
    | 'task_scheduled'
    | 'day_closed';

/** How the user arrived at this app open. */
export type AppOpenSource = 'direct' | 'notification' | 'share';

/**
 * Log a usage event for the signed-in user. Resolves the user from the local
 * session (no network round-trip). Safe to call without awaiting.
 */
export async function logAppEvent(
    eventType: AppEventType,
    payload: Record<string, unknown> = {},
): Promise<void> {
    try {
        const {
            data: { session },
        } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) return;

        const { error } = await supabase.from('app_events').insert({
            user_id: userId,
            event_type: eventType,
            payload,
        });
        if (error) {
            console.warn('Failed to log app event:', eventType, error.message);
        }
    } catch (err) {
        console.warn('Failed to log app event:', eventType, err);
    }
}
