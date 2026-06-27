import { describe, it, expect } from 'vitest';
import { isInInbox, countInbox } from './inbox';
import type { Task } from '../types';

function makeTask(over: Partial<Task>): Task {
    return {
        id: 't1',
        title: 'Task',
        completed: false,
        createdAt: '2026-06-21T00:00:00.000Z',
        ...over,
    };
}

describe('isInInbox', () => {
    it('true for an active, untriaged task', () => {
        expect(isInInbox(makeTask({}))).toBe(true);
    });
    it('false once completed', () => {
        expect(isInInbox(makeTask({ completed: true }))).toBe(false);
    });
    it('false once triaged', () => {
        expect(isInInbox(makeTask({ triagedAt: '2026-06-21T08:00:00.000Z' }))).toBe(false);
    });
});

describe('countInbox', () => {
    it('counts only active, untriaged tasks', () => {
        const tasks = [
            makeTask({ id: 'a' }),
            makeTask({ id: 'b', completed: true }),
            makeTask({ id: 'c', triagedAt: '2026-06-21T08:00:00.000Z' }),
            makeTask({ id: 'd' }),
        ];
        expect(countInbox(tasks)).toBe(2);
    });
    it('returns 0 for an empty list', () => {
        expect(countInbox([])).toBe(0);
    });
});
