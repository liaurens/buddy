/**
 * Maps the Cove UI's 5-mood / 3-energy taps onto the 1–10 scale stored in
 * `daily_plans.mood_at_plan_time` / `energy_at_plan_time` (SMALLINT,
 * CHECK 1–10). Never write the raw tap index.
 */

import type { EnergyIndex, MoodIndex } from '../components';

const MOOD_SCALE: Record<MoodIndex, number> = { 0: 2, 1: 4, 2: 6, 3: 8, 4: 10 };
const ENERGY_SCALE: Record<EnergyIndex, number> = { 0: 3, 1: 6, 2: 9 };

export function moodToScale(mood: MoodIndex): number {
    return MOOD_SCALE[mood];
}

export function energyToScale(energy: EnergyIndex): number {
    return ENERGY_SCALE[energy];
}

/** Nearest tap index for a stored 1–10 value (prefill when reopening). */
export function scaleToMood(value: number): MoodIndex {
    const clamped = Math.min(10, Math.max(1, value));
    return Math.min(4, Math.max(0, Math.round(clamped / 2) - 1)) as MoodIndex;
}

export function scaleToEnergy(value: number): EnergyIndex {
    const clamped = Math.min(10, Math.max(1, value));
    return Math.min(2, Math.max(0, Math.round(clamped / 3) - 1)) as EnergyIndex;
}
