import { describe, it, expect } from 'vitest';
import { addSubtask, nextSubtask, removeSubtask, subtaskProgress, toggleSubtask } from './subtasks';
import type { Subtask } from '../types';

const list: Subtask[] = [
    { id: 'a', title: 'Open the doc', completed: true },
    { id: 'b', title: 'Write the intro', completed: false },
    { id: 'c', title: 'Send it', completed: false },
];

describe('toggleSubtask', () => {
    it('flips only the matching step', () => {
        expect(toggleSubtask(list, 'b')).toEqual([
            { id: 'a', title: 'Open the doc', completed: true },
            { id: 'b', title: 'Write the intro', completed: true },
            { id: 'c', title: 'Send it', completed: false },
        ]);
    });

    it('does not mutate the input', () => {
        const copy = structuredClone(list);
        toggleSubtask(list, 'a');
        expect(list).toEqual(copy);
    });

    it('is a no-op for an unknown id, and safe on undefined', () => {
        expect(toggleSubtask(list, 'zzz')).toEqual(list);
        expect(toggleSubtask(undefined, 'a')).toEqual([]);
    });
});

describe('addSubtask', () => {
    it('appends a trimmed, unfinished step', () => {
        expect(addSubtask(list, '  Proofread it  ', 'd')).toEqual([
            ...list,
            { id: 'd', title: 'Proofread it', completed: false },
        ]);
    });

    it('ignores blank titles', () => {
        expect(addSubtask(list, '   ', 'd')).toEqual(list);
        expect(addSubtask(undefined, '', 'd')).toEqual([]);
    });

    it('starts a list when there is none', () => {
        expect(addSubtask(undefined, 'First step', 'a')).toEqual([
            { id: 'a', title: 'First step', completed: false },
        ]);
    });
});

describe('removeSubtask', () => {
    it('drops the matching step and leaves the rest', () => {
        expect(removeSubtask(list, 'a')).toEqual(list.slice(1));
        expect(removeSubtask(undefined, 'a')).toEqual([]);
    });
});

describe('nextSubtask', () => {
    it('returns the first unfinished step', () => {
        expect(nextSubtask(list)?.id).toBe('b');
    });

    it('returns null when everything is done or there are no steps', () => {
        expect(nextSubtask(list.map((s) => ({ ...s, completed: true })))).toBeNull();
        expect(nextSubtask([])).toBeNull();
        expect(nextSubtask(undefined)).toBeNull();
    });
});

describe('subtaskProgress', () => {
    it('counts done out of total', () => {
        expect(subtaskProgress(list)).toEqual({ done: 1, total: 3 });
    });

    it('returns null when there are no steps', () => {
        expect(subtaskProgress([])).toBeNull();
        expect(subtaskProgress(undefined)).toBeNull();
    });
});
