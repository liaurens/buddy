/**
 * User Data Seeding - Initialize default trackers for new users
 */

import type { TrackerDefinition, TrackerScale } from '../../../types';
import { supabase } from '../client';

// Reusable 1-10 scales. lowLabel / highLabel describe the endpoints so the UI
// never leaves the user wondering "is 1 good or bad?".
const scaleHigherBetter = (low: string, high: string): TrackerScale => ({
    min: 1, max: 10, step: 1, lowLabel: low, highLabel: high, direction: 'higher_better',
});
const scaleLowerBetter = (low: string, high: string): TrackerScale => ({
    min: 1, max: 10, step: 1, lowLabel: low, highLabel: high, direction: 'lower_better',
});

const DEFAULT_TRACKERS: Omit<TrackerDefinition, 'id'>[] = [
    // ── Daily required ──────────────────────────────────────────────
    { name: 'Sleep Hours', emoji: '🌙', type: 'number', unit: 'hrs', group: 'Sleep', cadence: 'daily',
        scale: { min: 0, max: 12, step: 0.5, lowLabel: 'None', highLabel: 'Lots', direction: 'higher_better' },
        checkinConfig: { isRequired: true, inCheckin: true } },
    { name: 'Sleep Quality', emoji: '💤', type: 'rating', group: 'Sleep', cadence: 'daily',
        scale: scaleHigherBetter('Restless', 'Deep & restorative'),
        checkinConfig: { isRequired: true, inCheckin: true } },
    { name: 'Mood', emoji: '😊', type: 'rating', group: 'Mental', cadence: 'daily',
        scale: scaleHigherBetter('Low', 'Great'),
        checkinConfig: { isRequired: true, inCheckin: true } },
    { name: 'Energy', emoji: '⚡', type: 'rating', group: 'Mental', cadence: 'daily',
        scale: scaleHigherBetter('Drained', 'Energized'),
        checkinConfig: { isRequired: true, inCheckin: true } },

    // ── Daily optional ──────────────────────────────────────────────
    { name: 'Mental Clarity', emoji: '🧠', type: 'rating', group: 'Mental', cadence: 'daily',
        scale: scaleHigherBetter('Foggy', 'Sharp'),
        checkinConfig: { isRequired: false, inCheckin: true } },
    { name: 'Stress', emoji: '😰', type: 'rating', group: 'Mental', cadence: 'daily',
        scale: scaleLowerBetter('Calm', 'Overwhelmed'),
        checkinConfig: { isRequired: false, inCheckin: true } },
    { name: 'Hydration', emoji: '💧', type: 'number', unit: 'glasses', group: 'Body', cadence: 'daily',
        scale: { min: 0, max: 12, step: 1, lowLabel: 'None', highLabel: 'Lots', direction: 'higher_better' },
        checkinConfig: { isRequired: false, inCheckin: true } },
    { name: 'Exercise', emoji: '🏋️', type: 'number', unit: 'min', group: 'Body', cadence: 'daily',
        scale: { min: 0, max: 180, step: 5, lowLabel: 'None', highLabel: 'Long', direction: 'higher_better' },
        checkinConfig: { isRequired: false, inCheckin: true } },
    { name: 'Sunlight', emoji: '☀️', type: 'number', unit: 'min', group: 'Body', cadence: 'daily',
        scale: { min: 0, max: 240, step: 5, lowLabel: 'None', highLabel: 'Lots', direction: 'higher_better' },
        checkinConfig: { isRequired: false, inCheckin: true } },
    { name: 'Caffeine', emoji: '☕', type: 'number', unit: 'mg', group: 'Diet', cadence: 'daily',
        scale: { min: 0, max: 600, step: 25, lowLabel: 'None', highLabel: 'Lots', direction: 'neutral' },
        checkinConfig: { isRequired: false, inCheckin: true } },
    { name: 'Daily Notes', emoji: '📓', type: 'text', group: 'Journal', cadence: 'daily',
        checkinConfig: { isRequired: false, inCheckin: true } },

    // ── Episodic (logged only when they happen) ─────────────────────
    { name: 'Alcohol', emoji: '🍷', type: 'number', unit: 'drinks', group: 'Diet', cadence: 'episodic',
        scale: { min: 0, max: 12, step: 1, lowLabel: 'None', highLabel: 'Many', direction: 'lower_better' },
        checkinConfig: { isRequired: false, inCheckin: true } },
    { name: 'Headache', emoji: '🤕', type: 'rating', group: 'Body', cadence: 'episodic',
        scale: scaleLowerBetter('Mild', 'Severe'),
        checkinConfig: { isRequired: false, inCheckin: true } },
    { name: 'Illness Symptoms', emoji: '🤒', type: 'text', group: 'Body', cadence: 'episodic',
        checkinConfig: { isRequired: false, inCheckin: true } },
];

export async function initializeUserData(userId: string): Promise<void> {
    try {
        const { data: existingTrackers, error } = await supabase
            .from('trackers')
            .select('id')
            .eq('user_id', userId)
            .limit(1);

        if (error) {
            if (error.name === 'AbortError' || error.message?.includes('aborted')) {
                return;
            }
            console.error('Error checking for existing trackers:', error);
            return;
        }

        if (!existingTrackers || existingTrackers.length === 0) {
            const trackersToInsert = DEFAULT_TRACKERS.map(t => ({
                id: crypto.randomUUID(),
                user_id: userId,
                name: t.name,
                emoji: t.emoji,
                type: t.type,
                unit: t.unit || null,
                group: t.group || null,
                checkin_config: t.checkinConfig || null,
                cadence: t.cadence || 'daily',
                scale: t.scale || null,
                goal: null,
            }));

            const { error: insertError } = await supabase
                .from('trackers')
                .insert(trackersToInsert);

            if (insertError) {
                if (insertError.name === 'AbortError' || insertError.message?.includes('aborted')) {
                    return;
                }
                console.error('Error seeding default trackers:', insertError);
            }
        }
    } catch (err: unknown) {
        if (err instanceof Error && (err.name === 'AbortError' || err.message?.includes('aborted'))) {
            return;
        }
        console.error('Error initializing user data:', err);
    }
}
