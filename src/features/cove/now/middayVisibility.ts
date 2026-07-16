/**
 * Midday reset card visibility + copy (Now screen, 12:00–18:00 window).
 * Dismissal persists per calendar day (localStorage, per-device).
 */

const MIDDAY_START_HOUR = 12;
const MIDDAY_END_HOUR = 18;

export interface MiddayState {
    donePicks: number;
    totalPicks: number;
    dismissed: boolean;
}

export function shouldShowMidday(hour: number, state: MiddayState): boolean {
    if (hour < MIDDAY_START_HOUR || hour >= MIDDAY_END_HOUR) return false;
    if (state.dismissed) return false;
    // "All done" (or nothing planned at all) needs no reset nudge.
    if (state.donePicks >= state.totalPicks) return false;
    return true;
}

export function middayLine(donePicks: number, totalPicks: number): string {
    if (donePicks > 0) {
        return `${donePicks} of ${totalPicks} done so far — nice pace.`;
    }
    return 'Nothing ticked yet — that’s okay.';
}

const dismissedKey = (dateKey: string) => `cove_midday_dismissed_${dateKey}`;

export function isMiddayDismissed(dateKey: string): boolean {
    try {
        return localStorage.getItem(dismissedKey(dateKey)) === '1';
    } catch {
        return false;
    }
}

export function dismissMidday(dateKey: string): void {
    try {
        localStorage.setItem(dismissedKey(dateKey), '1');
    } catch {
        /* storage unavailable — the card just reappears next load */
    }
}
