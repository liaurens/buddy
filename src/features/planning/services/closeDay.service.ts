/**
 * Close-day service.
 *
 * Closing the day is the explicit end state of the daily loop: it marks the
 * `daily_plans` row for the date as closed and feeds the low-pressure
 * continuity indicator (days closed this week — deliberately not a streak
 * that punishes a miss).
 */

import { format, startOfWeek, addDays } from 'date-fns';
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

/** Dates (yyyy-MM-dd) closed in the Monday-to-Sunday week containing `ref`. */
export async function getClosedDatesThisWeek(userId: string, ref: Date = new Date()): Promise<string[]> {
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
    return (data ?? []).map(row => row.date as string);
}
