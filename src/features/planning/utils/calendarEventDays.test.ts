import { describe, it, expect } from 'vitest';
import { eventOccursOn, eventTimeLabel, lastDayOf } from './calendarEventDays';

/** Local-midnight helper so these cases read as calendar days, not instants. */
const day = (iso: string) => new Date(`${iso}T12:00:00`);
const at = (iso: string) => new Date(iso).toISOString();

describe('eventOccursOn', () => {
    describe('timed events', () => {
        const psyq = {
            startTime: at('2026-08-18T11:00:00Z'),
            endTime: at('2026-08-18T12:00:00Z'),
            isAllDay: false,
        };

        it('covers its own day', () => {
            expect(eventOccursOn(psyq, day('2026-08-18'))).toBe(true);
        });

        it('does not leak into neighbouring days', () => {
            expect(eventOccursOn(psyq, day('2026-08-17'))).toBe(false);
            expect(eventOccursOn(psyq, day('2026-08-19'))).toBe(false);
        });
    });

    describe('multi-day all-day events', () => {
        // A holiday the 6th through the 15th, stored with the iCal exclusive end.
        const holiday = {
            startTime: new Date('2026-08-06T00:00:00').toISOString(),
            endTime: new Date('2026-08-16T00:00:00').toISOString(),
            isAllDay: true,
        };

        it('covers the first day', () => {
            expect(eventOccursOn(holiday, day('2026-08-06'))).toBe(true);
        });

        it('covers every day in between — the regression', () => {
            for (const d of ['2026-08-07', '2026-08-10', '2026-08-14']) {
                expect(eventOccursOn(holiday, day(d))).toBe(true);
            }
        });

        it('covers the last day', () => {
            expect(eventOccursOn(holiday, day('2026-08-15'))).toBe(true);
        });

        it('stops before the exclusive end date', () => {
            expect(eventOccursOn(holiday, day('2026-08-16'))).toBe(false);
        });

        it('does not start early', () => {
            expect(eventOccursOn(holiday, day('2026-08-05'))).toBe(false);
        });
    });

    describe('single all-day events', () => {
        const oneDay = {
            startTime: new Date('2026-08-08T00:00:00').toISOString(),
            endTime: new Date('2026-08-09T00:00:00').toISOString(),
            isAllDay: true,
        };

        it('covers exactly one day', () => {
            expect(eventOccursOn(oneDay, day('2026-08-08'))).toBe(true);
            expect(eventOccursOn(oneDay, day('2026-08-09'))).toBe(false);
        });
    });

    describe('events with no end', () => {
        const open = { startTime: at('2026-08-18T11:00:00Z') };

        it('covers only the start day', () => {
            expect(eventOccursOn(open, day('2026-08-18'))).toBe(true);
            expect(eventOccursOn(open, day('2026-08-19'))).toBe(false);
        });
    });

    it('tolerates an end before the start', () => {
        const broken = {
            startTime: at('2026-08-18T11:00:00Z'),
            endTime: at('2026-08-01T11:00:00Z'),
        };
        expect(lastDayOf(broken)).toEqual(new Date(broken.startTime));
        expect(eventOccursOn(broken, day('2026-08-18'))).toBe(true);
    });
});

describe('eventTimeLabel', () => {
    it('gives all-day events no time at all', () => {
        expect(
            eventTimeLabel({
                startTime: new Date('2026-08-06T00:00:00').toISOString(),
                isAllDay: true,
            }),
        ).toBeNull();
    });

    it('formats a timed event in local time', () => {
        const label = eventTimeLabel({
            startTime: new Date('2026-08-18T13:00:00').toISOString(),
            isAllDay: false,
        });
        expect(label).toBe('13:00');
    });

    it('treats a missing flag as timed', () => {
        expect(eventTimeLabel({ startTime: new Date('2026-08-18T09:30:00').toISOString() })).toBe(
            '09:30',
        );
    });
});
