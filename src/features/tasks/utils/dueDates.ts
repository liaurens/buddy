/**
 * Due-date parsing — timezone-safe helpers.
 *
 * `new Date('YYYY-MM-DD')` parses as UTC midnight, which shifts the calendar
 * day for anyone west of UTC (and breaks "due today" around midnight for
 * everyone). Anchoring at local noon keeps the date stable regardless of
 * timezone or DST. All due-date math in the tasks feature goes through here.
 */

import { differenceInCalendarDays } from 'date-fns';

const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a due date as a local-noon Date (timezone-safe). Plain yyyy-MM-dd
 * strings get the noon anchor; strings that already carry a time parse as-is.
 */
export function parseDueDate(iso: string): Date {
    return PLAIN_DATE.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
}

/** Whole calendar days from `today` to the due date (negative = overdue). */
export function daysUntilDue(iso: string, today: Date): number {
    return differenceInCalendarDays(parseDueDate(iso), today);
}

export function isDueToday(iso: string, today: Date): boolean {
    return daysUntilDue(iso, today) === 0;
}

export function isOverdue(iso: string, today: Date): boolean {
    return daysUntilDue(iso, today) < 0;
}
