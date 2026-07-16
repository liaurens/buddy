import { describe, it, expect } from 'vitest';
import { computeCloseStreak, weekWindow } from '../services/closeDay.service';

describe('weekWindow', () => {
    it('returns Monday through Sunday for a midweek date', () => {
        // 2026-06-10 is a Wednesday
        expect(weekWindow(new Date('2026-06-10T12:00:00'))).toEqual({
            start: '2026-06-08',
            end: '2026-06-14',
        });
    });

    it('treats Monday as the start of its own week', () => {
        expect(weekWindow(new Date('2026-06-08T00:30:00'))).toEqual({
            start: '2026-06-08',
            end: '2026-06-14',
        });
    });

    it('keeps Sunday in the week that started the previous Monday', () => {
        expect(weekWindow(new Date('2026-06-14T23:00:00'))).toEqual({
            start: '2026-06-08',
            end: '2026-06-14',
        });
    });
});

describe('computeCloseStreak', () => {
    it('is zero with no closed days', () => {
        expect(computeCloseStreak([], '2026-07-16')).toBe(0);
    });

    it('counts a run ending today', () => {
        expect(computeCloseStreak(['2026-07-14', '2026-07-15', '2026-07-16'], '2026-07-16')).toBe(
            3,
        );
    });

    it('anchors on yesterday while today is still open', () => {
        expect(computeCloseStreak(['2026-07-14', '2026-07-15'], '2026-07-16')).toBe(2);
    });

    it('breaks on a gap', () => {
        expect(
            computeCloseStreak(
                ['2026-07-12', '2026-07-13', '2026-07-15', '2026-07-16'],
                '2026-07-16',
            ),
        ).toBe(2);
    });

    it('is zero when the last close was two days ago', () => {
        expect(computeCloseStreak(['2026-07-13', '2026-07-14'], '2026-07-16')).toBe(0);
    });

    it('ignores unrelated older closes', () => {
        expect(computeCloseStreak(['2026-05-01', '2026-07-16'], '2026-07-16')).toBe(1);
    });

    it('crosses month boundaries', () => {
        expect(computeCloseStreak(['2026-06-29', '2026-06-30', '2026-07-01'], '2026-07-01')).toBe(
            3,
        );
    });
});
