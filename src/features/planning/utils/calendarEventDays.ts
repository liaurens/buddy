import { endOfDay, format, isWithinInterval, startOfDay, subMilliseconds } from 'date-fns';

/** The slice of a calendar event these helpers need. */
export interface EventSpan {
    startTime: string;
    endTime?: string | null;
    isAllDay?: boolean;
}

/**
 * The last calendar day an event actually covers.
 *
 * All-day events carry an **exclusive** end, the iCal convention: a holiday
 * running the 6th through the 15th is stored as ending at midnight on the 16th.
 * Taking that end at face value would paint an extra day on the grid, so step
 * back a millisecond first. Timed events have an inclusive end and need no
 * adjustment.
 */
export function lastDayOf(event: EventSpan): Date {
    const start = new Date(event.startTime);
    if (!event.endTime) return start;

    const end = new Date(event.endTime);
    if (end.getTime() <= start.getTime()) return start;

    return event.isAllDay ? subMilliseconds(end, 1) : end;
}

/**
 * Does this event cover the given day?
 *
 * Previously this compared only against the start day, so every multi-day event
 * — a ten-day holiday included — appeared on the grid exactly once and vanished
 * for the rest of its run.
 */
export function eventOccursOn(event: EventSpan, day: Date): boolean {
    return isWithinInterval(day, {
        start: startOfDay(new Date(event.startTime)),
        end: endOfDay(lastDayOf(event)),
    });
}

/**
 * The time prefix for a calendar chip, or `null` when there shouldn't be one.
 *
 * An all-day event has no meaningful clock time: its stored start is midnight,
 * which rendered as a literal "00:00" in front of the title and read as an
 * event that starts at midnight rather than one that fills the day.
 */
export function eventTimeLabel(event: EventSpan): string | null {
    if (event.isAllDay) return null;
    return format(new Date(event.startTime), 'HH:mm');
}
