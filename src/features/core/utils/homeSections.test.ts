import { describe, it, expect } from 'vitest';
import { shouldShowCloseDay } from './homeSections';

function at(hours: number, minutes = 0): Date {
    return new Date(2026, 6, 4, hours, minutes);
}

describe('shouldShowCloseDay', () => {
    it('hides before the lead window', () => {
        expect(shouldShowCloseDay(at(18, 59), '21:00', false)).toBe(false);
    });

    it('shows from 2h before the evening anchor', () => {
        expect(shouldShowCloseDay(at(19, 0), '21:00', false)).toBe(true);
        expect(shouldShowCloseDay(at(20, 30), '21:00', false)).toBe(true);
        expect(shouldShowCloseDay(at(23, 45), '21:00', false)).toBe(true);
    });

    it('hides once the day is closed', () => {
        expect(shouldShowCloseDay(at(21, 30), '21:00', true)).toBe(false);
    });

    it('handles early anchors without going negative', () => {
        expect(shouldShowCloseDay(at(0, 0), '01:00', false)).toBe(true);
    });

    it('hides on malformed anchor times', () => {
        expect(shouldShowCloseDay(at(22, 0), 'oops', false)).toBe(false);
    });
});
