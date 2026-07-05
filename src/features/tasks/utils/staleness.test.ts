import { describe, it, expect } from 'vitest';
import { isSnooze, isStale, nextSnoozeCount, STALE_SNOOZE_COUNT } from './staleness';
import type { Task } from '../types';

const NOW = new Date(2026, 6, 4, 12, 0); // 2026-07-04 local
const TODAY = '2026-07-04';

function task(p: Partial<Task> & { id: string }): Task {
    return {
        title: p.id,
        completed: false,
        createdAt: '2026-07-03T00:00:00.000Z',
        subtasks: [],
        recurrence: 'none',
        ...p,
    };
}

describe('isSnooze', () => {
    it('counts pushing a due/overdue task later', () => {
        expect(isSnooze(TODAY, '2026-07-05', TODAY)).toBe(true);
        expect(isSnooze('2026-07-01', '2026-07-08', TODAY)).toBe(true);
    });

    it('ignores planning moves', () => {
        expect(isSnooze(undefined, TODAY, TODAY)).toBe(false); // dating an undated task
        expect(isSnooze('2026-07-10', '2026-07-05', TODAY)).toBe(false); // pulling closer
        expect(isSnooze('2026-07-10', '2026-07-12', TODAY)).toBe(false); // both in future
        expect(isSnooze(TODAY, undefined, TODAY)).toBe(false); // clearing the date
    });
});

describe('nextSnoozeCount', () => {
    it('increments when the move is a snooze', () => {
        expect(nextSnoozeCount({ dueDate: TODAY, snoozeCount: 1 }, '2026-07-06', TODAY)).toBe(2);
    });

    it('keeps the count for planning moves', () => {
        expect(nextSnoozeCount({ dueDate: '2026-07-10', snoozeCount: 1 }, TODAY, TODAY)).toBe(1);
        expect(nextSnoozeCount({ dueDate: undefined, snoozeCount: 1 }, TODAY, TODAY)).toBe(1);
    });

    it('treats a missing previous task as zero', () => {
        expect(nextSnoozeCount(undefined, '2026-07-06', TODAY)).toBe(0);
    });
});

describe('isStale', () => {
    it('flags a task snoozed repeatedly', () => {
        expect(isStale(task({ id: 'a', snoozeCount: STALE_SNOOZE_COUNT }), NOW)).toBe(true);
        expect(isStale(task({ id: 'a', snoozeCount: 1 }), NOW)).toBe(false);
    });

    it('flags a due task untouched for 2+ days', () => {
        const stale = task({
            id: 'a',
            dueDate: TODAY,
            lastTouchedAt: '2026-07-01T09:00:00.000Z',
        });
        expect(isStale(stale, NOW)).toBe(true);

        const fresh = task({
            id: 'b',
            dueDate: TODAY,
            lastTouchedAt: '2026-07-03T09:00:00.000Z',
        });
        expect(isStale(fresh, NOW)).toBe(false);
    });

    it('falls back to createdAt when never touched', () => {
        expect(
            isStale(task({ id: 'a', dueDate: '2026-07-01', createdAt: '2026-06-25T00:00:00.000Z' }), NOW),
        ).toBe(true);
    });

    it('ignores future-dated, completed, and progressing tasks', () => {
        expect(isStale(task({ id: 'a', dueDate: '2026-07-10', snoozeCount: 0, createdAt: '2026-06-01T00:00:00.000Z' }), NOW)).toBe(false);
        expect(isStale(task({ id: 'b', completed: true, snoozeCount: 5 }), NOW)).toBe(false);
        expect(
            isStale(
                task({
                    id: 'c',
                    snoozeCount: 5,
                    subtasks: [
                        { id: 's1', title: 'done', completed: true },
                        { id: 's2', title: 'open', completed: false },
                    ],
                }),
                NOW,
            ),
        ).toBe(false);
    });

    it('does not flag undated tasks on touch age alone', () => {
        expect(isStale(task({ id: 'a', createdAt: '2026-01-01T00:00:00.000Z' }), NOW)).toBe(false);
    });
});
