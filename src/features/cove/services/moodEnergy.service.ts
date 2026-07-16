/**
 * Quick mood/energy log — the writer for `daily_plans.mood_at_plan_time` /
 * `energy_at_plan_time` (these columns existed but had no active writer
 * before Buddy Cove). The gate's "Yesterday" step writes yesterday's row;
 * the close-day reflection writes today's. MoodEnergySparkline reads them
 * back via fetchMoodEnergyHistory.
 */

import { supabase } from '../../../services/supabase';

export interface MoodEnergyPatch {
    /** 1–10 (use moodToScale — never a raw tap index). */
    mood?: number;
    /** 1–10 (use energyToScale). */
    energy?: number;
}

export async function saveMoodEnergy(
    userId: string,
    date: string,
    patch: MoodEnergyPatch,
): Promise<void> {
    if (patch.mood === undefined && patch.energy === undefined) return;
    const { error } = await supabase.from('daily_plans').upsert(
        {
            user_id: userId,
            date,
            ...(patch.mood !== undefined ? { mood_at_plan_time: patch.mood } : {}),
            ...(patch.energy !== undefined ? { energy_at_plan_time: patch.energy } : {}),
        },
        { onConflict: 'user_id,date' },
    );
    if (error) {
        throw new Error(`Failed to save mood/energy: ${error.message}`);
    }
}
