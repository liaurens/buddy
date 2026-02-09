/**
 * User Data Seeding - Initialize default trackers for new users
 */

import type { TrackerDefinition } from '../../../types';
import { supabase } from '../client';

const DEFAULT_TRACKERS: Omit<TrackerDefinition, 'id'>[] = [
    // Health - Sleep
    { name: 'Sleep Hours', emoji: '🌙', type: 'number', unit: 'hrs', group: 'Health', checkinConfig: { isRequired: true, inCheckin: true } },
    { name: 'Sleep Quality', emoji: '💤', type: 'rating', group: 'Health', checkinConfig: { isRequired: true, inCheckin: true } },
    // Health - Physical
    { name: 'Training', emoji: '🏋️', type: 'text', group: 'Health', checkinConfig: { isRequired: false, inCheckin: true } },
    { name: 'Steps', emoji: '👟', type: 'number', unit: 'steps', group: 'Health', checkinConfig: { isRequired: false, inCheckin: true } },
    // Health - Body
    { name: 'Nose Blocked', emoji: '👃', type: 'rating', group: 'Health', checkinConfig: { isRequired: false, inCheckin: true } },
    { name: 'Asthma', emoji: '🌬️', type: 'rating', group: 'Health', checkinConfig: { isRequired: false, inCheckin: true } },
    { name: 'Hunger', emoji: '🍽️', type: 'rating', group: 'Health', checkinConfig: { isRequired: false, inCheckin: true } },
    // Mental
    { name: 'Mood', emoji: '😊', type: 'rating', group: 'Mental', checkinConfig: { isRequired: true, inCheckin: true } },
    { name: 'Energy', emoji: '⚡', type: 'rating', group: 'Mental', checkinConfig: { isRequired: true, inCheckin: true } },
    { name: 'Mental Clarity', emoji: '🧠', type: 'rating', group: 'Mental', checkinConfig: { isRequired: false, inCheckin: true } },
    { name: 'Stress', emoji: '😰', type: 'rating', group: 'Mental', checkinConfig: { isRequired: false, inCheckin: true } },
    // Diet
    { name: 'Caffeine', emoji: '☕', type: 'number', unit: 'mg', group: 'Diet', checkinConfig: { isRequired: false, inCheckin: true } },
    // Journal
    { name: 'Daily Notes', emoji: '📓', type: 'text', group: 'Journal', checkinConfig: { isRequired: false, inCheckin: true } },
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
