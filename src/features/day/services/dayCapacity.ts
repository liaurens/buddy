/**
 * Day capacity — the single "normal day or survival day?" switch.
 *
 * Persisted on daily_plans (one row per user per date, same upsert pattern as
 * closeDay.service) so the edge functions can read it server-side to suppress
 * non-anchor notifications, and so it resets naturally with the new day.
 */

import { supabase } from '../../../services/supabase';

export type DayCapacity = 'normal' | 'survival';

export async function getDayCapacity(userId: string, date: string): Promise<DayCapacity> {
    const { data, error } = await supabase
        .from('daily_plans')
        .select('capacity')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle();
    if (error) {
        throw new Error(`Failed to load day capacity: ${error.message}`);
    }
    return data?.capacity === 'survival' ? 'survival' : 'normal';
}

export async function setDayCapacity(
    userId: string,
    date: string,
    capacity: DayCapacity,
): Promise<void> {
    const { error } = await supabase
        .from('daily_plans')
        .upsert({ user_id: userId, date, capacity }, { onConflict: 'user_id,date' });
    if (error) {
        throw new Error(`Failed to set day capacity: ${error.message}`);
    }
}
