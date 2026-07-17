/**
 * Morning check-in gate persistence.
 *
 * Source of truth is `daily_plans` (checked_in_at / checkin_skipped /
 * intention, one row per user per date — same upsert pattern as
 * dayCapacity). A localStorage mirror gives a flash-free first paint while
 * the query resolves. Finishing (not skipping) also marks the morning
 * routine phase done so the Daily-routine card stays truthful.
 */

import { supabase } from '../../../services/supabase';
import { markRoutineDone } from '../../day/services/routine-progress';

export type CheckinStatus = 'pending' | 'done' | 'skipped';

export interface CheckinState {
    status: CheckinStatus;
    intention: string | null;
}

const mirrorKey = (date: string) => `cove_checkin_${date}`;

function setMirror(date: string, status: CheckinStatus): void {
    try {
        localStorage.setItem(mirrorKey(date), status);
    } catch {
        /* storage unavailable — the server row still gates correctly */
    }
}

/** Synchronous first-paint hint; the server row is authoritative. */
export function getLocalCheckinStatus(date: string): CheckinStatus | null {
    try {
        const value = localStorage.getItem(mirrorKey(date));
        return value === 'done' || value === 'skipped' ? value : null;
    } catch {
        return null;
    }
}

export async function getCheckinState(userId: string, date: string): Promise<CheckinState> {
    const { data, error } = await supabase
        .from('daily_plans')
        .select('checked_in_at, checkin_skipped, intention')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle();
    if (error) {
        throw new Error(`Failed to load check-in state: ${error.message}`);
    }
    const status: CheckinStatus = data?.checked_in_at
        ? 'done'
        : data?.checkin_skipped
          ? 'skipped'
          : 'pending';
    if (status === 'pending') {
        try {
            localStorage.removeItem(mirrorKey(date));
        } catch {
            /* ignore */
        }
    } else {
        setMirror(date, status);
    }
    return { status, intention: (data?.intention as string | null) ?? null };
}

export async function markCheckinDone(
    userId: string,
    date: string,
    opts: { intention?: string } = {},
): Promise<void> {
    const intention = opts.intention?.trim();
    const { error } = await supabase.from('daily_plans').upsert(
        {
            user_id: userId,
            date,
            checked_in_at: new Date().toISOString(),
            checkin_skipped: false,
            ...(intention ? { intention } : {}),
        },
        { onConflict: 'user_id,date' },
    );
    if (error) {
        throw new Error(`Failed to save check-in: ${error.message}`);
    }
    setMirror(date, 'done');
    markRoutineDone('morning', date);
}

export async function markCheckinSkipped(userId: string, date: string): Promise<void> {
    const { error } = await supabase
        .from('daily_plans')
        .upsert({ user_id: userId, date, checkin_skipped: true }, { onConflict: 'user_id,date' });
    if (error) {
        throw new Error(`Failed to skip check-in: ${error.message}`);
    }
    setMirror(date, 'skipped');
}
