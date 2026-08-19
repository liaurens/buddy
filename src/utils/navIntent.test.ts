import { describe, it, expect } from 'vitest';
import { parseNavIntent } from './navIntent';

describe('parseNavIntent', () => {
    it('parses complete and snooze with a task id', () => {
        expect(parseNavIntent({ intent: 'complete', taskId: 'abc' })).toEqual({
            kind: 'complete',
            taskId: 'abc',
        });
        expect(parseNavIntent({ intent: 'snooze', taskId: 'abc' })).toEqual({
            kind: 'snooze',
            taskId: 'abc',
        });
    });

    it('parses closeday without a task id', () => {
        expect(parseNavIntent({ intent: 'closeday' })).toEqual({ kind: 'closeday' });
        expect(parseNavIntent({ intent: 'closeday', step: 'night' })).toEqual({
            kind: 'closeday',
        });
    });

    it('rejects task intents without a task id', () => {
        expect(parseNavIntent({ intent: 'complete' })).toBeNull();
        expect(parseNavIntent({ intent: 'snooze', taskId: '' })).toBeNull();
    });

    it('ignores garbage and unrelated params', () => {
        expect(parseNavIntent(null)).toBeNull();
        expect(parseNavIntent(undefined)).toBeNull();
        expect(parseNavIntent({})).toBeNull();
        expect(parseNavIntent({ intent: 'explode', taskId: 'abc' })).toBeNull();
        expect(parseNavIntent({ intent: 42, taskId: 'abc' })).toBeNull();
        expect(parseNavIntent({ step: 'morning' })).toBeNull();
        // TrackerPage's own params must never read as an intent.
        expect(parseNavIntent({ xId: 'a', yId: 'b' })).toBeNull();
    });
});
