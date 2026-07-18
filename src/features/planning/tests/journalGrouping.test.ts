import { groupEntriesByMonth } from '../utils/journalGrouping';
import type { DailyJournalEntry } from '../../health-tracking/types';

const entry = (date: string): DailyJournalEntry => ({
    id: `id-${date}`,
    date,
    prompts: [],
    wins: [],
    createdAt: `${date}T12:00:00.000Z`,
    updatedAt: `${date}T12:00:00.000Z`,
});

describe('groupEntriesByMonth', () => {
    it('returns an empty array for no entries', () => {
        expect(groupEntriesByMonth([])).toEqual([]);
    });

    it('puts a single entry in one labelled month group', () => {
        const groups = groupEntriesByMonth([entry('2026-07-14')]);
        expect(groups).toHaveLength(1);
        expect(groups[0].label).toBe('July 2026');
        expect(groups[0].entries.map((e) => e.date)).toEqual(['2026-07-14']);
    });

    it('groups same-month entries together, newest first', () => {
        const groups = groupEntriesByMonth([
            entry('2026-07-02'),
            entry('2026-07-20'),
            entry('2026-07-11'),
        ]);
        expect(groups).toHaveLength(1);
        expect(groups[0].entries.map((e) => e.date)).toEqual([
            '2026-07-20',
            '2026-07-11',
            '2026-07-02',
        ]);
    });

    it('orders month groups newest month first regardless of input order', () => {
        const groups = groupEntriesByMonth([
            entry('2026-06-30'),
            entry('2026-08-01'),
            entry('2026-07-15'),
        ]);
        expect(groups.map((g) => g.label)).toEqual(['August 2026', 'July 2026', 'June 2026']);
    });

    it('separates the same month across different years', () => {
        const groups = groupEntriesByMonth([entry('2025-07-10'), entry('2026-07-10')]);
        expect(groups.map((g) => g.label)).toEqual(['July 2026', 'July 2025']);
    });
});
