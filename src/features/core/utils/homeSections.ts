/**
 * Home section visibility rules — pure, injected clock.
 *
 * The close-day CTA appears on Home from shortly before the evening anchor
 * until the day is closed, so the evening touch lands inside the short
 * eat-and-phone window without demanding anything earlier in the day.
 */

/** How long before the evening anchor the close-day CTA appears. */
export const CLOSE_DAY_LEAD_HOURS = 2;

/**
 * Whether the Home close-day CTA should show.
 *
 * @param now       Current time (injected).
 * @param nightTime Evening anchor time, HH:MM (from notifications settings).
 * @param dayClosed Whether today is already closed.
 */
export function shouldShowCloseDay(now: Date, nightTime: string, dayClosed: boolean): boolean {
    if (dayClosed) return false;

    const match = /^(\d{1,2}):(\d{2})$/.exec(nightTime);
    if (!match) return false;

    const anchorMinutes = Number(match[1]) * 60 + Number(match[2]);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return nowMinutes >= anchorMinutes - CLOSE_DAY_LEAD_HOURS * 60;
}
