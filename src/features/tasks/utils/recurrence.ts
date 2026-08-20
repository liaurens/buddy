/**
 * recurrence — when does a repeating task come back?
 *
 * Date-only arithmetic: a plain `yyyy-MM-dd` goes in and a plain `yyyy-MM-dd`
 * comes out, with `parseDueDate`'s local-noon anchor in between. The previous
 * version parsed with `new Date('YYYY-MM-DD')` (UTC midnight) and formatted
 * with `.toISOString().split('T')[0]` (back to UTC), which put the base an hour
 * or two after midnight local and then read the result in a different zone —
 * so around a DST change every cadence lost or gained a day, and an evening
 * "today" rolled over before it advanced.
 */

import { addDays, addWeeks, addMonths, format, nextDay, getDay } from 'date-fns';
import type { RecurrencePattern, RecurrenceConfig } from '../types';
import { parseDueDate } from './dueDates';

type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const iso = (d: Date): string => format(d, 'yyyy-MM-dd');

/**
 * The ISO date (YYYY-MM-DD) of the next occurrence after `currentDueDate`.
 * Returns null for non-recurring tasks. Falls back to today when there is no
 * base date.
 *
 * Note the parameter is named `currentDueDate` but the app's callers pass
 * `plannedFor` — the day the occurrence was *scheduled* for, which is what a
 * routine actually repeats on.
 */
export function calculateNextDueDate(
    currentDueDate: string | undefined,
    recurrence: RecurrencePattern,
    config?: RecurrenceConfig,
): string | null {
    if (recurrence === 'none') return null;

    const base = currentDueDate ? parseDueDate(currentDueDate) : new Date();

    switch (recurrence) {
        case 'daily':
            return iso(addDays(base, config?.interval ?? 1));

        case 'weekdays': {
            let next = addDays(base, 1);
            while (getDay(next) === 0 || getDay(next) === 6) {
                next = addDays(next, 1);
            }
            return iso(next);
        }

        case 'weekly': {
            if (config?.daysOfWeek && config.daysOfWeek.length > 0) {
                const sorted = [...config.daysOfWeek].sort((a, b) => a - b);
                const baseDow = getDay(base);
                // The next configured weekday strictly after the base day; if
                // there is none this week, the first one of the next. `nextDay`
                // always lands strictly ahead, so a single-day list still moves
                // forward a week rather than returning the base date — which
                // `missedRoutineOccurrences` relies on to terminate.
                const nextDow = sorted.find((d) => d > baseDow) ?? sorted[0];
                return iso(nextDay(base, nextDow as DayOfWeek));
            }
            return iso(addWeeks(base, config?.interval ?? 1));
        }

        case 'monthly':
            // addMonths clamps: 31 Jan + 1 month is 28 Feb, not 3 Mar.
            return iso(addMonths(base, config?.interval ?? 1));

        default:
            return null;
    }
}
