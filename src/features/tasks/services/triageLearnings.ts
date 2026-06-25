/**
 * Triage learning doc — the "extra doc the AI uses" to keep improving.
 *
 * Every time the user overrides the AI's chosen destination during triage, we
 * append a one-line correction. The doc is fed back into the next triage prompt
 * as worked examples, so the model gradually matches the user's own judgement.
 *
 * Stored as a single growing text doc in the per-user key/value `settings` store
 * (no dedicated table). Capped so the prompt stays small.
 */

import { getSetting, setSetting } from '../../../services/supabase';

const LEARNINGS_KEY = 'triage_learnings';
/** Keep only the most recent corrections so the prompt stays cheap. */
const MAX_ENTRIES = 40;

export interface TriageCorrection {
    title: string;
    aiDestination: string;
    correctDestination: string;
    /** True when the AI had auto-applied this (high confidence) and the user corrected it. */
    wasAuto?: boolean;
}

/** Load the raw correction doc (empty string if the user has none yet). */
export async function loadTriageLearnings(userId: string): Promise<string> {
    try {
        return (await getSetting(userId, LEARNINGS_KEY)) ?? '';
    } catch (e) {
        console.warn('Failed to load triage learnings:', e);
        return '';
    }
}

function formatEntry(c: TriageCorrection, nowIso: string): string {
    const day = nowIso.slice(0, 10);
    const confidence = c.wasAuto
        ? ' [you had auto-applied this confidently — be more careful]'
        : '';
    return `- ${day}: "${c.title}" → ${c.correctDestination} (you changed it from ${c.aiDestination})${confidence}`;
}

/**
 * Append corrections to the doc, keeping only the most recent MAX_ENTRIES.
 * Non-fatal: a failure here must never block the triage writes themselves.
 */
export async function recordTriageCorrections(
    userId: string,
    corrections: TriageCorrection[],
    nowIso: string,
): Promise<void> {
    if (corrections.length === 0) return;
    try {
        const existing = await loadTriageLearnings(userId);
        const lines = existing ? existing.split('\n').filter(Boolean) : [];
        for (const c of corrections) lines.push(formatEntry(c, nowIso));
        await setSetting(userId, LEARNINGS_KEY, lines.slice(-MAX_ENTRIES).join('\n'));
    } catch (e) {
        console.warn('Failed to record triage corrections:', e);
    }
}
