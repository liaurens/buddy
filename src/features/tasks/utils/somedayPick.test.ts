import { describe, it, expect } from 'vitest';
import { pickSomeday } from './somedayPick';
import type { Task } from '../types';

function task(p: Partial<Task> & { id: string }): Task {
    return {
        title: p.id,
        completed: false,
        createdAt: '2026-06-01T00:00:00.000Z',
        subtasks: [],
        recurrence: 'none',
        kind: 'backlog',
        ...p,
    };
}

describe('pickSomeday', () => {
    it('returns null when there are no backlog tasks', () => {
        expect(
            pickSomeday([task({ id: 'a', kind: 'standard', dueDate: '2026-06-22' })]),
        ).toBeNull();
    });

    it('picks the longest-waiting backlog task', () => {
        const out = pickSomeday([
            task({ id: 'new', createdAt: '2026-06-10T00:00:00.000Z' }),
            task({ id: 'old', createdAt: '2026-06-01T00:00:00.000Z' }),
        ]);
        expect(out?.id).toBe('old');
    });

    it('excludes skipped ids', () => {
        const out = pickSomeday(
            [
                task({ id: 'old', createdAt: '2026-06-01T00:00:00.000Z' }),
                task({ id: 'next', createdAt: '2026-06-05T00:00:00.000Z' }),
            ],
            { skip: ['old'] },
        );
        expect(out?.id).toBe('next');
    });

    it('ignores completed tasks', () => {
        expect(pickSomeday([task({ id: 'a', completed: true })])).toBeNull();
    });
});
