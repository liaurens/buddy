import type { TrackerDefinition } from '../types';

/**
 * Boundary validation for a tracker value before it reaches the database.
 *
 * Nothing checked these: a slipped keystroke stored 77 hours of sleep, and every
 * downstream average, trend and correlation silently absorbed it. Bad numbers in
 * a health log are worse than a rejected save, because they are invisible until
 * the analysis is already wrong.
 *
 * A tracker's own `scale` is authoritative when it has one. Where it doesn't,
 * the unit implies a plausible ceiling, and everything else falls back to
 * "non-negative and not absurd".
 */

export interface ValueCheck {
    ok: boolean;
    /** User-facing reason, present only when `ok` is false. */
    message?: string;
}

const OK: ValueCheck = { ok: true };

/**
 * Ceilings implied by a unit when a tracker declares no explicit scale.
 * Deliberately generous — these catch fat-finger errors, not unusual days.
 */
const UNIT_CEILINGS: Array<{ match: RegExp; max: number; noun: string }> = [
    { match: /^(h|hr|hrs|hour|hours|uur|uren)$/i, max: 24, noun: 'hours' },
    { match: /^(min|mins|minute|minutes|minuten)$/i, max: 1440, noun: 'minutes' },
    { match: /^(glass|glasses|glazen|cup|cups|kopjes)$/i, max: 40, noun: 'glasses' },
    { match: /^(steps|stappen)$/i, max: 100000, noun: 'steps' },
    { match: /^(mg)$/i, max: 10000, noun: 'mg' },
    { match: /^(ml|l|liter|litre)$/i, max: 20000, noun: 'ml' },
];

/** Backstop for unit-less numbers — high enough to never bite a real reading. */
const ABSURD = 1_000_000;

export function validateTrackerValue(
    tracker: Pick<TrackerDefinition, 'name' | 'type' | 'unit' | 'scale'>,
    raw: number | string | null | undefined,
): ValueCheck {
    if (tracker.type === 'text') return OK;
    if (raw === '' || raw === null || raw === undefined) return OK; // optional & unfilled

    const value = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(value)) {
        return { ok: false, message: `${tracker.name} needs a number.` };
    }

    const { scale } = tracker;
    if (scale) {
        if (value < scale.min || value > scale.max) {
            return {
                ok: false,
                message: `${tracker.name} runs from ${scale.min} to ${scale.max}.`,
            };
        }
        return OK;
    }

    if (value < 0) {
        return { ok: false, message: `${tracker.name} can't be negative.` };
    }

    if (tracker.unit) {
        const ceiling = UNIT_CEILINGS.find((c) => c.match.test(tracker.unit!.trim()));
        if (ceiling && value > ceiling.max) {
            return {
                ok: false,
                message: `${tracker.name} tops out at ${ceiling.max} ${ceiling.noun}.`,
            };
        }
    }

    if (value > ABSURD) {
        return { ok: false, message: `${tracker.name} looks too large — check the number.` };
    }

    return OK;
}

/**
 * First problem across a whole check-in draft, or `null` when it's clean.
 * Returns one message at a time so the form nudges rather than scolds.
 */
export function firstInvalidValue(
    trackers: Array<Pick<TrackerDefinition, 'id' | 'name' | 'type' | 'unit' | 'scale'>>,
    values: Record<string, number | string>,
): { trackerId: string; message: string } | null {
    for (const tracker of trackers) {
        const check = validateTrackerValue(tracker, values[tracker.id]);
        if (!check.ok) {
            return { trackerId: tracker.id, message: check.message! };
        }
    }
    return null;
}
