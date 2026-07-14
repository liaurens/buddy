import { describe, it, expect } from 'vitest';
import {
    rankMorningCandidates,
    suggestMorningPicks,
    nextSwapCandidate,
    SMALL_TASK_MINUTES,
} from './morningPick';
import type { Task } from '../../tasks/types';

const TODAY = '2026-07-04';

function task(p: Partial<Task> & { id: string }): Task {
    return {
        title: p.id,
        completed: false,
        createdAt: '2026-06-01T00:00:00.000Z',
        subtasks: [],
        recurrence: 'none',
        ...p,
    };
}

function rank(tasks: Task[]) {
    return rankMorningCandidates(tasks, { today: TODAY });
}

describe('rankMorningCandidates', () => {
    it('prefers a small task over an equal-priority big task', () => {
        const ranked = rank([
            task({ id: 'big', priority: 'medium', estimatedTime: 120 }),
            task({ id: 'small', priority: 'medium', estimatedTime: 20 }),
        ]);
        expect(ranked[0].task.id).toBe('small');
    });

    it('gives an extra bump to tiny tasks (≤15 min)', () => {
        const ranked = rank([
            task({ id: 'small', priority: 'medium', estimatedTime: SMALL_TASK_MINUTES }),
            task({ id: 'tiny', priority: 'medium', estimatedTime: 10 }),
        ]);
        expect(ranked[0].task.id).toBe('tiny');
    });

    it('still lets an overdue task beat a small fresh task', () => {
        const ranked = rank([
            task({ id: 'small', priority: 'medium', estimatedTime: 15 }),
            task({ id: 'overdue', priority: 'medium', dueDate: '2026-07-01' }),
        ]);
        expect(ranked[0].task.id).toBe('overdue');
    });

    it('penalizes tasks with no estimate and no subtasks (vague)', () => {
        const ranked = rank([
            task({ id: 'vague', priority: 'medium' }),
            task({
                id: 'shaped',
                priority: 'medium',
                subtasks: [{ id: 's1', title: 'step', completed: false }],
            }),
        ]);
        expect(ranked[0].task.id).toBe('shaped');
    });

    it('excludes completed tasks, routines, and tasks already due today', () => {
        const ranked = rank([
            task({ id: 'done', completed: true }),
            task({ id: 'routine', recurrence: 'daily' }),
            task({ id: 'routine-kind', kind: 'routine' }),
            task({ id: 'today', dueDate: TODAY }),
            task({ id: 'ok' }),
        ]);
        expect(ranked.map((c) => c.task.id)).toEqual(['ok']);
    });

    it('excludes locked tasks (fixed hardness with a date) — accept would no-op', () => {
        const ranked = rank([
            task({ id: 'locked', hardness: 'fixed', dueDate: '2026-07-10' }),
            task({ id: 'flexible', hardness: 'flexible', dueDate: '2026-07-10' }),
        ]);
        expect(ranked.map((c) => c.task.id)).toEqual(['flexible']);
    });

    it('breaks ties deterministically by createdAt then id', () => {
        const ranked = rank([
            task({ id: 'b', createdAt: '2026-06-02T00:00:00.000Z' }),
            task({ id: 'c', createdAt: '2026-06-01T00:00:00.000Z' }),
            task({ id: 'a', createdAt: '2026-06-02T00:00:00.000Z' }),
        ]);
        expect(ranked.map((c) => c.task.id)).toEqual(['c', 'a', 'b']);
    });
});

describe('suggestMorningPicks', () => {
    it('returns at most `slots` picks', () => {
        const ranked = rank([
            task({ id: 'a' }),
            task({ id: 'b' }),
            task({ id: 'c' }),
            task({ id: 'd' }),
        ]);
        expect(suggestMorningPicks(ranked, 3)).toHaveLength(3);
        expect(suggestMorningPicks(ranked, 1)).toHaveLength(1);
    });

    it('caps school candidates at 2 for diversity', () => {
        const ranked = rank([
            task({ id: 's1', assignmentId: 'x', priority: 'urgent' }),
            task({ id: 's2', triageDestination: 'school', priority: 'urgent' }),
            task({ id: 's3', assignmentId: 'y', priority: 'urgent' }),
            task({ id: 'other', priority: 'low' }),
        ]);
        const picks = suggestMorningPicks(ranked, 3).map((c) => c.task.id);
        expect(picks).toEqual(['s1', 's2', 'other']);
    });

    it('fills all slots with school tasks only when nothing else exists', () => {
        const ranked = rank([
            task({ id: 's1', assignmentId: 'x' }),
            task({ id: 's2', assignmentId: 'y' }),
            task({ id: 's3', assignmentId: 'z' }),
        ]);
        expect(suggestMorningPicks(ranked, 3)).toHaveLength(3);
    });
});

describe('nextSwapCandidate', () => {
    it('returns the highest-ranked candidate not excluded', () => {
        const ranked = rank([
            task({ id: 'a', priority: 'urgent' }),
            task({ id: 'b', priority: 'high' }),
            task({ id: 'c', priority: 'low' }),
        ]);
        expect(nextSwapCandidate(ranked, new Set(['a', 'b']))?.task.id).toBe('c');
    });

    it('returns null when everything is excluded', () => {
        const ranked = rank([task({ id: 'a' })]);
        expect(nextSwapCandidate(ranked, new Set(['a']))).toBeNull();
    });
});
