/**
 * Close-day service.
 *
 * Closing the day is the explicit end state of the daily loop: it marks the
 * `daily_plans` row for the date as closed and feeds two continuity signals:
 * days closed this week (circle row) and the close streak (Buddy Cove chip +
 * celebration). The streak only ever celebrates — copy around it must never
 * shame a miss, and a day that isn't closed yet doesn't break it until
 * tomorrow (the count anchors on yesterday when today is still open).
 */

import { format, startOfWeek, addDays, subDays } from 'date-fns';
import { supabase } from '../../../services/supabase';
import { logAppEvent } from '../../../services/app-events';

const DATE_FORMAT = 'yyyy-MM-dd';

/** Monday-to-Sunday window containing `ref`, as yyyy-MM-dd strings. */
export function weekWindow(ref: Date): { start: string; end: string } {
    const monday = startOfWeek(ref, { weekStartsOn: 1 });
    return {
        start: format(monday, DATE_FORMAT),
        end: format(addDays(monday, 6), DATE_FORMAT),
    };
}

/** Mark a day as closed. Upserts the daily_plans row in case no plan exists. */
export async function closeDay(userId: string, date: string): Promise<void> {
    const { error } = await supabase
        .from('daily_plans')
        .upsert(
            { user_id: userId, date, closed_at: new Date().toISOString() },
            { onConflict: 'user_id,date' },
        );
    if (error) {
        throw new Error(`Failed to close day: ${error.message}`);
    }
    void logAppEvent('day_closed', { date });
}

/** Reopen a day closed by mistake. */
export async function reopenDay(userId: string, date: string): Promise<void> {
    const { error } = await supabase
        .from('daily_plans')
        .update({ closed_at: null })
        .eq('user_id', userId)
        .eq('date', date);
    if (error) {
        throw new Error(`Failed to reopen day: ${error.message}`);
    }
}

/** Whether the given date has been closed. */
export async function isDayClosed(userId: string, date: string): Promise<boolean> {
    const { data, error } = await supabase
        .from('daily_plans')
        .select('closed_at')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle();
    if (error) {
        throw new Error(`Failed to load day state: ${error.message}`);
    }
    return !!data?.closed_at;
}

/**
 * Consecutive closed days ending at `todayIso` — or at yesterday when today
 * isn't closed yet, so an open evening doesn't read as a broken streak.
 */
export function computeCloseStreak(closedDates: Iterable<string>, todayIso: string): number {
    const closed = new Set(closedDates);
    const today = new Date(`${todayIso}T12:00:00`);
    let cursor = closed.has(todayIso) ? today : subDays(today, 1);
    let streak = 0;
    while (closed.has(format(cursor, DATE_FORMAT))) {
        streak += 1;
        cursor = subDays(cursor, 1);
    }
    return streak;
}

const STREAK_LOOKBACK_DAYS = 90;

/** Current close streak, derived from `daily_plans.closed_at` (last 90 days). */
export async function getCloseStreak(userId: string, ref: Date = new Date()): Promise<number> {
    const since = format(subDays(ref, STREAK_LOOKBACK_DAYS), DATE_FORMAT);
    const { data, error } = await supabase
        .from('daily_plans')
        .select('date')
        .eq('user_id', userId)
        .gte('date', since)
        .not('closed_at', 'is', null);
    if (error) {
        throw new Error(`Failed to load close streak: ${error.message}`);
    }
    const closedDates = (data ?? []).map((row) => row.date as string);
    return computeCloseStreak(closedDates, format(ref, DATE_FORMAT));
}

/** Dates (yyyy-MM-dd) closed in the Monday-to-Sunday week containing `ref`. */
export async function getClosedDatesThisWeek(
    userId: string,
    ref: Date = new Date(),
): Promise<string[]> {
    const { start, end } = weekWindow(ref);
    const { data, error } = await supabase
        .from('daily_plans')
        .select('date')
        .eq('user_id', userId)
        .gte('date', start)
        .lte('date', end)
        .not('closed_at', 'is', null);
    if (error) {
        throw new Error(`Failed to load closed days: ${error.message}`);
    }
    return (data ?? []).map((row) => row.date as string);
}
