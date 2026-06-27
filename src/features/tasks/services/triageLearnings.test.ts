import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the settings key/value store the learnings doc lives in.
const store = new Map<string, string>();
vi.mock('../../../services/supabase', () => ({
    getSetting: vi.fn(async (_userId: string, key: string) => store.get(key) ?? null),
    setSetting: vi.fn(async (_userId: string, key: string, value: string) => {
        store.set(key, value);
    }),
}));

import { loadTriageLearnings, recordTriageCorrections } from './triageLearnings';
import type { TriageCorrection } from './triageLearnings';

const USER = 'user-1';
const NOW = '2026-06-21T10:00:00.000Z';

function correction(title: string): TriageCorrection {
    return { title, aiDestination: 'today', correctDestination: 'someday' };
}

describe('triageLearnings', () => {
    beforeEach(() => {
        store.clear();
        vi.clearAllMocks();
    });

    it('returns an empty string when the user has no doc yet', async () => {
        expect(await loadTriageLearnings(USER)).toBe('');
    });

    it('appends a formatted correction line with the date and destinations', async () => {
        await recordTriageCorrections(USER, [correction('Email prof')], NOW);
        const doc = await loadTriageLearnings(USER);
        expect(doc).toBe('- 2026-06-21: "Email prof" → someday (you changed it from today)');
    });

    it('appends to existing corrections rather than overwriting', async () => {
        await recordTriageCorrections(USER, [correction('first')], NOW);
        await recordTriageCorrections(USER, [correction('second')], NOW);
        const lines = (await loadTriageLearnings(USER)).split('\n');
        expect(lines).toHaveLength(2);
        expect(lines[0]).toContain('first');
        expect(lines[1]).toContain('second');
    });

    it('is a no-op when given no corrections', async () => {
        const { setSetting } = await import('../../../services/supabase');
        await recordTriageCorrections(USER, [], NOW);
        expect(setSetting).not.toHaveBeenCalled();
        expect(await loadTriageLearnings(USER)).toBe('');
    });

    it('caps the doc at the 40 most recent corrections', async () => {
        const many = Array.from({ length: 45 }, (_, i) => correction(`task-${i}`));
        await recordTriageCorrections(USER, many, NOW);
        const lines = (await loadTriageLearnings(USER)).split('\n');
        expect(lines).toHaveLength(40);
        // Oldest five (task-0 … task-4) are dropped; task-5 is now the first.
        expect(lines[0]).toContain('task-5');
        expect(lines[39]).toContain('task-44');
    });

    it('swallows store failures without throwing', async () => {
        const { setSetting } = await import('../../../services/supabase');
        vi.mocked(setSetting).mockRejectedValueOnce(new Error('network down'));
        await expect(
            recordTriageCorrections(USER, [correction('boom')], NOW),
        ).resolves.toBeUndefined();
    });
});
