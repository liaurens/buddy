import { describe, it, expect } from 'vitest';
import { partitionPicks, subtaskProgress, allSubtasksDone, tomorrowIso } from './middayReview';
import type { Task, Subtask } from '../../tasks/types';

function makeTask(over: Partial<Task>): Task {
    return {
        id: 't1',
        title: 'Task',
        completed: false,
        createdAt: '2026-06-21T00:00:00.000Z',
        ...over,
    };
}

function sub(id: string, completed: boolean): Subtask {
    return { id, title: `sub-${id}`, completed };
}

describe('partitionPicks', () => {
    it('splits open vs done by the completed flag', () => {
        const a = makeTask({ id: 'a' });
        const b = makeTask({ id: 'b', completed: true });
        const c = makeTask({ id: 'c' });
        const { open, done } = partitionPicks([a, b, c]);
        expect(open.map((t) => t.id)).toEqual(['a', 'c']);
        expect(done.map((t) => t.id)).toEqual(['b']);
    });

    it('handles an empty list', () => {
        expect(partitionPicks([])).toEqual({ open: [], done: [] });
    });
});

describe('subtaskProgress', () => {
    it('returns null when there are no subtasks', () => {
        expect(subtaskProgress(makeTask({}))).toBeNull();
        expect(subtaskProgress(makeTask({ subtasks: [] }))).toBeNull();
    });

    it('counts completed vs total', () => {
        const task = makeTask({ subtasks: [sub('1', true), sub('2', false), sub('3', true)] });
        expect(subtaskProgress(task)).toEqual({ done: 2, total: 3 });
    });
});

describe('allSubtasksDone', () => {
    it('is false without subtasks', () => {
        expect(allSubtasksDone(makeTask({}))).toBe(false);
        expect(allSubtasksDone(makeTask({ subtasks: [] }))).toBe(false);
    });

    it('is false while any subtask is open', () => {
        expect(allSubtasksDone(makeTask({ subtasks: [sub('1', true), sub('2', false)] }))).toBe(
            false,
        );
    });

    it('is true when every subtask is complete', () => {
        expect(allSubtasksDone(makeTask({ subtasks: [sub('1', true), sub('2', true)] }))).toBe(
            true,
        );
    });
});

describe('tomorrowIso', () => {
    it('returns the next day in yyyy-MM-dd', () => {
        expect(tomorrowIso(new Date('2026-06-21T09:00:00'))).toBe('2026-06-22');
    });

    it('rolls over month boundaries', () => {
        expect(tomorrowIso(new Date('2026-06-30T23:00:00'))).toBe('2026-07-01');
    });

    it('rolls over year boundaries', () => {
        expect(tomorrowIso(new Date('2026-12-31T12:00:00'))).toBe('2027-01-01');
    });
});
