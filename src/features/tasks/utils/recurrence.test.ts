import { describe, it, expect, afterEach, vi } from 'vitest';
import { calculateNextDueDate } from './recurrence';

/**
 * Every assertion here is string-in / string-out on purpose: the whole point of
 * routing this through `parseDueDate` (local noon) and `format` is that the
 * answer must not depend on the runner's timezone or on a DST boundary.
 */
describe('calculateNextDueDate', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns null for a non-recurring task', () => {
        expect(calculateNextDueDate('2026-02-25', 'none')).toBeNull();
    });

    describe('daily', () => {
        it('advances one day', () => {
            expect(calculateNextDueDate('2026-02-25', 'daily')).toBe('2026-02-26');
        });

        it('crosses a month and a year boundary', () => {
            expect(calculateNextDueDate('2026-02-28', 'daily')).toBe('2026-03-01');
            expect(calculateNextDueDate('2026-12-31', 'daily')).toBe('2027-01-01');
        });

        it('honours an interval', () => {
            expect(calculateNextDueDate('2026-02-25', 'daily', { interval: 3 })).toBe('2026-02-28');
        });
    });

    describe('weekdays', () => {
        it('advances to the next day midweek', () => {
            // 2026-02-25 is a Wednesday.
            expect(calculateNextDueDate('2026-02-25', 'weekdays')).toBe('2026-02-26');
        });

        it('skips the weekend from Friday and from Saturday', () => {
            expect(calculateNextDueDate('2026-02-27', 'weekdays')).toBe('2026-03-02');
            expect(calculateNextDueDate('2026-02-28', 'weekdays')).toBe('2026-03-02');
            expect(calculateNextDueDate('2026-03-01', 'weekdays')).toBe('2026-03-02');
        });
    });

    describe('weekly', () => {
        it('advances one week without a day list', () => {
            expect(calculateNextDueDate('2026-02-25', 'weekly')).toBe('2026-03-04');
        });

        it('honours an interval', () => {
            expect(calculateNextDueDate('2026-02-25', 'weekly', { interval: 2 })).toBe(
                '2026-03-11',
            );
        });

        it('picks the next configured weekday after the base day', () => {
            // Wednesday, repeating Mon/Wed/Fri → Friday.
            expect(calculateNextDueDate('2026-02-25', 'weekly', { daysOfWeek: [1, 3, 5] })).toBe(
                '2026-02-27',
            );
        });

        it('wraps to the first configured weekday of the following week', () => {
            // Friday, repeating Mon/Wed/Fri → the Monday after.
            expect(calculateNextDueDate('2026-02-27', 'weekly', { daysOfWeek: [1, 3, 5] })).toBe(
                '2026-03-02',
            );
        });

        it('always moves forward when the only configured day is the base day', () => {
            // Wednesday, repeating Wednesdays → next Wednesday, never itself.
            // missedRoutineOccurrences loops on this being strictly increasing.
            expect(calculateNextDueDate('2026-02-25', 'weekly', { daysOfWeek: [3] })).toBe(
                '2026-03-04',
            );
        });

        it('does not care about the order of the day list', () => {
            expect(calculateNextDueDate('2026-02-25', 'weekly', { daysOfWeek: [5, 1, 3] })).toBe(
                '2026-02-27',
            );
        });
    });

    describe('monthly', () => {
        it('advances one month', () => {
            expect(calculateNextDueDate('2026-02-15', 'monthly')).toBe('2026-03-15');
        });

        it('clamps to the last day of a shorter month', () => {
            expect(calculateNextDueDate('2026-01-31', 'monthly')).toBe('2026-02-28');
            expect(calculateNextDueDate('2026-03-31', 'monthly')).toBe('2026-04-30');
            expect(calculateNextDueDate('2026-08-31', 'monthly')).toBe('2026-09-30');
        });

        it('honours an interval', () => {
            expect(calculateNextDueDate('2026-01-31', 'monthly', { interval: 2 })).toBe(
                '2026-03-31',
            );
        });
    });

    describe('across DST transitions', () => {
        // EU clocks move on 2026-03-29 and 2026-10-25; US clocks on 2026-03-08
        // and 2026-11-01. A date-only recurrence must not notice any of them.
        it('advances daily across the spring and autumn changes', () => {
            expect(calculateNextDueDate('2026-03-28', 'daily')).toBe('2026-03-29');
            expect(calculateNextDueDate('2026-03-29', 'daily')).toBe('2026-03-30');
            expect(calculateNextDueDate('2026-10-24', 'daily')).toBe('2026-10-25');
            expect(calculateNextDueDate('2026-10-25', 'daily')).toBe('2026-10-26');
            expect(calculateNextDueDate('2026-03-07', 'daily')).toBe('2026-03-08');
            expect(calculateNextDueDate('2026-10-31', 'daily')).toBe('2026-11-01');
        });

        it('advances weekly and monthly across the changes', () => {
            expect(calculateNextDueDate('2026-03-25', 'weekly')).toBe('2026-04-01');
            expect(calculateNextDueDate('2026-10-21', 'weekly')).toBe('2026-10-28');
            expect(calculateNextDueDate('2026-03-15', 'monthly')).toBe('2026-04-15');
            expect(calculateNextDueDate('2026-10-15', 'monthly')).toBe('2026-11-15');
        });

        it('skips the weekend correctly across the spring change', () => {
            // 2026-03-27 is a Friday; the clocks move that Sunday.
            expect(calculateNextDueDate('2026-03-27', 'weekdays')).toBe('2026-03-30');
        });
    });

    describe('with no base date', () => {
        it('falls back to today', () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-05-10T12:00:00'));
            expect(calculateNextDueDate(undefined, 'daily')).toBe('2026-05-11');
            expect(calculateNextDueDate(undefined, 'weekly')).toBe('2026-05-17');
        });

        it('falls back to today late in the evening too', () => {
            // The old implementation round-tripped through UTC, so an evening
            // "today" east of UTC rolled onto the next day before it advanced.
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-05-10T23:30:00'));
            expect(calculateNextDueDate(undefined, 'daily')).toBe('2026-05-11');
        });
    });
});
