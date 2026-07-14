import { subDays, format } from 'date-fns';
import { supabase } from '../../../services/supabase';

export interface MoodEnergyPoint {
    date: string;
    mood: number | null;
    energy: number | null;
}

export async function fetchMoodEnergyHistory(
    userId: string,
    days = 14,
): Promise<MoodEnergyPoint[]> {
    const since = format(subDays(new Date(), days - 1), 'yyyy-MM-dd');
    const { data, error } = await supabase
        .from('daily_plans')
        .select('date, mood_at_plan_time, energy_at_plan_time')
        .eq('user_id', userId)
        .gte('date', since)
        .order('date', { ascending: true });

    if (error) {
        console.error('mood history fetch failed', error);
        return [];
    }

    // Backfill empty days so the sparkline has consistent spacing.
    const byDate = new Map<string, MoodEnergyPoint>();
    for (const row of data ?? []) {
        byDate.set(row.date, {
            date: row.date,
            mood: row.mood_at_plan_time ?? null,
            energy: row.energy_at_plan_time ?? null,
        });
    }
    const out: MoodEnergyPoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
        out.push(byDate.get(d) ?? { date: d, mood: null, energy: null });
    }
    return out;
}
