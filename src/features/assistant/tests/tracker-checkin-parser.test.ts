/**
 * Tests for the free-text check-in parser used by the assistant's
 * `tracker.checkin` tool.
 *
 * Source: supabase/functions/assistant/tools/checkin-parser.ts
 *
 * Regression context: "log 7 hours of sleep for today" parsed to `{}`, because
 * only the metric-first order ("sleep 7") was matched. The empty parse returned
 * "No valid metrics found in check-in", which turned the whole assistant reply
 * red even after the retry stored the entry.
 */
import { describe, it, expect } from 'vitest';
import {
    coerceMetrics,
    parseCheckinValues,
} from '../../../../supabase/functions/assistant/tools/checkin-parser.ts';

describe('parseCheckinValues', () => {
    describe('metric-first phrasing', () => {
        it('reads "sleep 7"', () => {
            expect(parseCheckinValues('sleep 7')).toEqual({ sleep: 7 });
        });

        it('reads separators like "mood: 8" and "energy=4"', () => {
            expect(parseCheckinValues('mood: 8, energy=4')).toEqual({ mood: 8, energy: 4 });
        });

        it('reads decimals', () => {
            expect(parseCheckinValues('sleep 7.5')).toEqual({ sleep: 7.5 });
        });
    });

    describe('number-first phrasing (the regression)', () => {
        it('reads "log 7 hours of sleep for today"', () => {
            expect(parseCheckinValues('log 7 hours of sleep for today')).toEqual({ sleep: 7 });
        });

        it('reads "8 glasses of water"', () => {
            expect(parseCheckinValues('8 glasses of water')).toEqual({ water: 8 });
        });

        it('reads a number sitting directly against its metric', () => {
            expect(parseCheckinValues('10000 steps')).toEqual({ steps: 10000 });
        });

        it('reads Dutch phrasing', () => {
            expect(parseCheckinValues('7 uur slaap')).toEqual({ sleep: 7 });
        });
    });

    describe('aliases', () => {
        it('maps Dutch metric names onto canonical keys', () => {
            expect(parseCheckinValues('stemming 8, energie 5')).toEqual({ mood: 8, energy: 5 });
        });

        it('maps koffie onto caffeine', () => {
            expect(parseCheckinValues('koffie 2')).toEqual({ caffeine: 2 });
        });
    });

    describe('mixed and empty input', () => {
        it('reads several metrics from one sentence', () => {
            expect(parseCheckinValues('mood 8 and 7 hours of sleep')).toEqual({
                mood: 8,
                sleep: 7,
            });
        });

        it('ignores numbers that belong to no known metric', () => {
            expect(parseCheckinValues('log 7 things for today')).toEqual({});
        });

        it('returns an empty object for text with no numbers', () => {
            expect(parseCheckinValues('how did I sleep')).toEqual({});
        });

        it('does not treat a bare verb as a metric', () => {
            expect(parseCheckinValues('log 5')).toEqual({});
        });
    });
});

describe('coerceMetrics', () => {
    it('takes clean numbers', () => {
        expect(coerceMetrics({ sleep: 7.5, energy: 4 })).toEqual({ sleep: 7.5, energy: 4 });
    });

    it('reads a number out of a unit string — the retry cause', () => {
        expect(coerceMetrics({ sleep: '7 hours' })).toEqual({ sleep: 7 });
        expect(coerceMetrics({ caffeine: '80 mg' })).toEqual({ caffeine: 80 });
    });

    it('accepts comma decimals and stray prefixes', () => {
        expect(coerceMetrics({ sleep: '7,5' })).toEqual({ sleep: 7.5 });
        expect(coerceMetrics({ sleep: '~8' })).toEqual({ sleep: 8 });
    });

    it('normalises compound and cased keys', () => {
        expect(coerceMetrics({ sleep_hours: 7 })).toEqual({ sleep: 7 });
        expect(coerceMetrics({ 'Sleep Hours': 7 })).toEqual({ sleep: 7 });
    });

    it('maps Dutch keys onto canonical names', () => {
        expect(coerceMetrics({ slaap: 7, energie: 3 })).toEqual({ sleep: 7, energy: 3 });
    });

    it('keeps unknown metric names rather than dropping them', () => {
        expect(coerceMetrics({ 'nose blocked': 4 })).toEqual({ 'nose blocked': 4 });
    });

    it('drops values with no number in them', () => {
        expect(coerceMetrics({ sleep: 'good', energy: null })).toEqual({});
    });

    it('handles an empty object', () => {
        expect(coerceMetrics({})).toEqual({});
    });
});
