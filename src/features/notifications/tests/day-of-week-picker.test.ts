import { describe, it, expect } from 'vitest';
import { describeDays } from '../components/DayOfWeekPicker';

describe('describeDays', () => {
    it('labels all seven days as every day', () => {
        expect(describeDays([0, 1, 2, 3, 4, 5, 6])).toBe('Every day');
    });

    it('labels Monday-Friday as weekdays', () => {
        expect(describeDays([1, 2, 3, 4, 5])).toBe('Weekdays');
    });

    it('labels Saturday and Sunday as weekends', () => {
        expect(describeDays([0, 6])).toBe('Weekends');
    });

    it('labels an empty selection as never', () => {
        expect(describeDays([])).toBe('Never');
    });

    it('lists custom selections in Monday-first order', () => {
        expect(describeDays([0, 1, 3])).toBe('Mon, Wed, Sun');
    });
});
