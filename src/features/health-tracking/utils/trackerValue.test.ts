import { describe, it, expect } from 'vitest';
import { firstInvalidValue, validateTrackerValue } from './trackerValue';
import type { TrackerDefinition } from '../types';

const tracker = (over: Partial<TrackerDefinition>): TrackerDefinition =>
    ({
        id: 't1',
        name: 'Sleep Hours',
        emoji: '🌙',
        type: 'number',
        ...over,
    }) as TrackerDefinition;

describe('validateTrackerValue', () => {
    describe('trackers with an explicit scale', () => {
        const mood = tracker({
            name: 'Mood',
            type: 'rating',
            scale: {
                min: 1,
                max: 10,
                lowLabel: 'Low',
                highLabel: 'High',
                direction: 'higher_better',
            },
        });

        it('accepts a value inside the scale', () => {
            expect(validateTrackerValue(mood, 8).ok).toBe(true);
        });

        it('accepts the boundaries', () => {
            expect(validateTrackerValue(mood, 1).ok).toBe(true);
            expect(validateTrackerValue(mood, 10).ok).toBe(true);
        });

        it('rejects above the scale and says the range', () => {
            const check = validateTrackerValue(mood, 11);
            expect(check.ok).toBe(false);
            expect(check.message).toBe('Mood runs from 1 to 10.');
        });

        it('rejects below the scale', () => {
            expect(validateTrackerValue(mood, 0).ok).toBe(false);
        });
    });

    describe('unit ceilings when no scale is declared', () => {
        const sleep = tracker({ unit: 'hrs' });

        it('accepts a normal night', () => {
            expect(validateTrackerValue(sleep, 7.5).ok).toBe(true);
        });

        it('accepts the ceiling itself', () => {
            expect(validateTrackerValue(sleep, 24).ok).toBe(true);
        });

        it('rejects 77 hours of sleep — the regression', () => {
            const check = validateTrackerValue(sleep, 77);
            expect(check.ok).toBe(false);
            expect(check.message).toBe('Sleep Hours tops out at 24 hours.');
        });

        it('applies the steps ceiling', () => {
            const steps = tracker({ name: 'Steps', unit: 'steps' });
            expect(validateTrackerValue(steps, 12000).ok).toBe(true);
            expect(validateTrackerValue(steps, 500000).ok).toBe(false);
        });

        it('ignores an unrecognised unit', () => {
            const odd = tracker({ name: 'Widgets', unit: 'widgets' });
            expect(validateTrackerValue(odd, 5000).ok).toBe(true);
        });
    });

    describe('general guards', () => {
        it('rejects negatives', () => {
            const check = validateTrackerValue(tracker({ name: 'Steps', unit: 'steps' }), -3);
            expect(check.ok).toBe(false);
            expect(check.message).toBe("Steps can't be negative.");
        });

        it('rejects non-numeric text in a number field', () => {
            expect(validateTrackerValue(tracker({}), 'abc').ok).toBe(false);
        });

        it('rejects an absurd unit-less number', () => {
            expect(validateTrackerValue(tracker({ name: 'Count' }), 9_999_999).ok).toBe(false);
        });

        it('leaves an unfilled optional field alone', () => {
            expect(validateTrackerValue(tracker({}), '').ok).toBe(true);
            expect(validateTrackerValue(tracker({}), undefined).ok).toBe(true);
        });

        it('never blocks a text tracker', () => {
            expect(validateTrackerValue(tracker({ type: 'text' }), 'a long note').ok).toBe(true);
        });

        it('accepts a numeric string', () => {
            expect(validateTrackerValue(tracker({ unit: 'hrs' }), '7').ok).toBe(true);
        });
    });
});

describe('firstInvalidValue', () => {
    const sleep = tracker({ id: 'sleep', name: 'Sleep Hours', unit: 'hrs' });
    const steps = tracker({ id: 'steps', name: 'Steps', unit: 'steps' });

    it('returns null when every value is fine', () => {
        expect(firstInvalidValue([sleep, steps], { sleep: 8, steps: 9000 })).toBeNull();
    });

    it('reports the offending tracker', () => {
        const result = firstInvalidValue([sleep, steps], { sleep: 77, steps: 9000 });
        expect(result).toEqual({
            trackerId: 'sleep',
            message: 'Sleep Hours tops out at 24 hours.',
        });
    });

    it('reports only the first problem', () => {
        const result = firstInvalidValue([sleep, steps], { sleep: 77, steps: -1 });
        expect(result?.trackerId).toBe('sleep');
    });

    it('handles an empty draft', () => {
        expect(firstInvalidValue([sleep, steps], {})).toBeNull();
    });
});
