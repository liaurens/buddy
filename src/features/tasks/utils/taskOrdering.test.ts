import { describe, it, expect } from 'vitest';
import { sortTasksCanonical, isQuickWin } from './taskOrdering';
import { getRankedTasks } from './taskRecommender';
import type { Task } from '../types';

const TODAY = new Date(2026, 6, 4, 9, 0); // 2026-07-04 local

function task(p: Partial<Task> & { id: string }): Task {
    return {
        title: p.id,
        completed: false,
        createdAt: '2026-07-01T00:00:00.000Z',
        subtasks: [],
        recurrence: 'none',
        priority: 'medium',
        ...p,
    };
}

function order(tasks: Task[]): string[] {
    const scoreById = new Map(getRankedTasks(tasks, TODAY).map((r) => [r.task.id, r.score]));
    return sortTasksCanonical(tasks, scoreById).map((t) => t.id);
}

describe('canonical ordering', () => {
    it('a dateless urgent task beats a medium task due today', () => {
        expect(
            order([
                task({ id: 'due-today', dueDate: '2026-07-04' }),
                task({ id: 'urgent', priority: 'urgent' }),
            ]),
        ).toEqual(['urgent', 'due-today']);
    });

    it('an overdue task still beats a dateless urgent one', () => {
        expect(
            order([
                task({ id: 'urgent', priority: 'urgent' }),
                task({ id: 'overdue', dueDate: '2026-07-01' }),
            ]),
        ).toEqual(['overdue', 'urgent']);
    });

    it('a stale task outranks its identical non-stale twin', () => {
        expect(
            order([
                task({
                    id: 'fresh',
                    dueDate: '2026-07-04',
                    lastTouchedAt: '2026-07-04T08:00:00.000Z',
                }),
                task({
                    id: 'stale',
                    dueDate: '2026-07-04',
                    lastTouchedAt: '2026-07-01T08:00:00.000Z',
                }),
            ]),
        ).toEqual(['stale', 'fresh']);
    });

    it('an aged backlog task beats a fresh one', () => {
        expect(
            order([
                task({ id: 'fresh', createdAt: '2026-07-03T00:00:00.000Z' }),
                task({ id: 'aged', createdAt: '2026-05-01T00:00:00.000Z' }),
            ]),
        ).toEqual(['aged', 'fresh']);
    });

    it('is shuffle-invariant for equal scores (stable tie-breaks)', () => {
        const tasks = [
            task({ id: 'c', createdAt: '2026-07-01T00:00:00.000Z' }),
            task({ id: 'a', createdAt: '2026-07-01T00:00:00.000Z' }),
            task({ id: 'b', createdAt: '2026-06-30T00:00:00.000Z' }),
        ];
        const expected = order(tasks);
        expect(order([...tasks].reverse())).toEqual(expected);
        expect(expected).toEqual(['b', 'a', 'c']);
    });

    it('dated tasks with equal scores sort by due date, undated last', () => {
        // Give both the same score by using far-future dates outside the 7-day window.
        const tasks = [
            task({ id: 'later', dueDate: '2026-09-01' }),
            task({ id: 'sooner', dueDate: '2026-08-01' }),
        ];
        expect(order(tasks)).toEqual(['sooner', 'later']);
    });

    it('keeps planned workdays ahead of otherwise-equal unplanned tasks', () => {
        const scoreById = new Map([
            ['planned', 20],
            ['unplanned', 20],
        ]);
        expect(
            sortTasksCanonical(
                [task({ id: 'unplanned' }), task({ id: 'planned', plannedFor: '2026-07-04' })],
                scoreById,
            ).map((t) => t.id),
        ).toEqual(['planned', 'unplanned']);
    });
});

describe('isQuickWin', () => {
    it('flags small-estimate open tasks only', () => {
        expect(isQuickWin(task({ id: 'a', estimatedTime: 10 }))).toBe(true);
        expect(isQuickWin(task({ id: 'b', estimatedTime: 30 }))).toBe(false);
        expect(isQuickWin(task({ id: 'c' }))).toBe(false);
        expect(isQuickWin(task({ id: 'd', estimatedTime: 10, completed: true }))).toBe(false);
    });
});
