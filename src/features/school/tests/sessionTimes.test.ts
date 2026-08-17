/**
 * Tests for the course importer's class-session time repair.
 *
 * Source: supabase/functions/school-import/sessionTimes.ts
 *
 * Regression context: Advanced Algorithms was imported as 01:30–04:00 and sat
 * that way in `class_sessions` for weeks. The real class is 13:30–16:00 — the
 * PDF used a 12-hour timetable and the extractor dropped the PM. `01:30` is a
 * valid HH:mm string, so nothing downstream objected.
 */
import { describe, it, expect } from 'vitest';
import {
    formatHHMM,
    parseHHMM,
    repairSessionTimes,
} from '../../../../supabase/functions/school-import/sessionTimes.ts';

describe('parseHHMM', () => {
    it('reads a valid 24-hour time', () => {
        expect(parseHHMM('13:30')).toBe(810);
        expect(parseHHMM('00:00')).toBe(0);
        expect(parseHHMM('23:59')).toBe(1439);
    });

    it('rejects anything that is not HH:mm', () => {
        for (const bad of ['24:00', '1:30', '13:60', '', 'noon', '13.30']) {
            expect(parseHHMM(bad)).toBeNull();
        }
    });
});

describe('formatHHMM', () => {
    it('zero-pads both halves', () => {
        expect(formatHHMM(810)).toBe('13:30');
        expect(formatHHMM(0)).toBe('00:00');
        expect(formatHHMM(9 * 60 + 5)).toBe('09:05');
    });
});

describe('repairSessionTimes', () => {
    describe('times that are already sensible', () => {
        it('leaves an afternoon class untouched', () => {
            expect(repairSessionTimes('13:30', '16:00')).toEqual({
                startTime: '13:30',
                endTime: '16:00',
                repaired: false,
            });
        });

        it('leaves an early-morning-but-plausible class untouched', () => {
            expect(repairSessionTimes('08:00', '09:30')).toEqual({
                startTime: '08:00',
                endTime: '09:30',
                repaired: false,
            });
        });

        it('leaves a late evening class untouched', () => {
            expect(repairSessionTimes('20:00', '22:00')).toEqual({
                startTime: '20:00',
                endTime: '22:00',
                repaired: false,
            });
        });

        it('accepts a session starting exactly at the 06:00 boundary', () => {
            expect(repairSessionTimes('06:00', '07:00')?.repaired).toBe(false);
        });
    });

    describe('the dropped-PM regression', () => {
        it('repairs 01:30-04:00 to 13:30-16:00', () => {
            expect(repairSessionTimes('01:30', '04:00')).toEqual({
                startTime: '13:30',
                endTime: '16:00',
                repaired: true,
            });
        });

        it('repairs a whole session read as AM', () => {
            expect(repairSessionTimes('02:00', '03:00')).toEqual({
                startTime: '14:00',
                endTime: '15:00',
                repaired: true,
            });
        });

        it('repairs an end that alone lost its PM', () => {
            // "11:00 – 1:00" — the end reads as earlier than the start.
            expect(repairSessionTimes('11:00', '01:00')).toEqual({
                startTime: '11:00',
                endTime: '13:00',
                repaired: true,
            });
        });

        it('flags the repair so the preview can show it', () => {
            expect(repairSessionTimes('01:30', '04:00')?.repaired).toBe(true);
        });
    });

    describe('pairs it refuses to guess at', () => {
        it('rejects a malformed time', () => {
            expect(repairSessionTimes('1:30', '04:00')).toBeNull();
            expect(repairSessionTimes('13:30', 'noon')).toBeNull();
        });

        it('rejects a zero-length session', () => {
            expect(repairSessionTimes('13:30', '13:30')).toBeNull();
        });

        it('rejects a session that would still be implausible after shifting', () => {
            // 00:30-23:00 shifts to 12:30-35:00, which is not a time.
            expect(repairSessionTimes('00:30', '23:00')).toBeNull();
        });

        it('rejects an absurdly long session', () => {
            expect(repairSessionTimes('07:00', '23:30')).toBeNull();
        });

        it('rejects an evening start with a morning end it cannot fix', () => {
            // 22:00-09:00 — shifting the end gives 21:00, still before the start.
            expect(repairSessionTimes('22:00', '09:00')).toBeNull();
        });
    });
});
