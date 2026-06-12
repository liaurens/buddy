import { describe, it, expect } from 'vitest';
import { weekWindow } from '../services/closeDay.service';

describe('weekWindow', () => {
    it('returns Monday through Sunday for a midweek date', () => {
        // 2026-06-10 is a Wednesday
        expect(weekWindow(new Date('2026-06-10T12:00:00')))
            .toEqual({ start: '2026-06-08', end: '2026-06-14' });
    });

    it('treats Monday as the start of its own week', () => {
        expect(weekWindow(new Date('2026-06-08T00:30:00')))
            .toEqual({ start: '2026-06-08', end: '2026-06-14' });
    });

    it('keeps Sunday in the week that started the previous Monday', () => {
        expect(weekWindow(new Date('2026-06-14T23:00:00')))
            .toEqual({ start: '2026-06-08', end: '2026-06-14' });
    });
});
