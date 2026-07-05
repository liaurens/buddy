import { describe, it, expect } from 'vitest';
import { parseDueDate, daysUntilDue, isDueToday, isOverdue } from './dueDates';

describe('parseDueDate', () => {
    it('anchors the date at local noon (no UTC-midnight day drift)', () => {
        const d = parseDueDate('2026-07-04');
        expect(d.getFullYear()).toBe(2026);
        expect(d.getMonth()).toBe(6);
        expect(d.getDate()).toBe(4);
        expect(d.getHours()).toBe(12);
    });

    it('passes datetime strings through unchanged', () => {
        const d = parseDueDate('2026-07-04T10:30:00');
        expect(d.getHours()).toBe(10);
        expect(d.getDate()).toBe(4);
    });
});

describe('daysUntilDue', () => {
    it('is 0 for today even late at night', () => {
        expect(daysUntilDue('2026-07-04', new Date(2026, 6, 4, 23, 30))).toBe(0);
    });

    it('is 1 for tomorrow even just after midnight', () => {
        expect(daysUntilDue('2026-07-05', new Date(2026, 6, 4, 0, 30))).toBe(1);
    });

    it('is negative for overdue', () => {
        expect(daysUntilDue('2026-07-03', new Date(2026, 6, 4, 8, 0))).toBe(-1);
    });
});

describe('isDueToday / isOverdue', () => {
    const now = new Date(2026, 6, 4, 23, 45);

    it('due today stays "today" until midnight', () => {
        expect(isDueToday('2026-07-04', now)).toBe(true);
        expect(isOverdue('2026-07-04', now)).toBe(false);
    });

    it('yesterday is overdue, tomorrow is neither', () => {
        expect(isOverdue('2026-07-03', now)).toBe(true);
        expect(isDueToday('2026-07-05', now)).toBe(false);
        expect(isOverdue('2026-07-05', now)).toBe(false);
    });
});
