/**
 * Group daily journal entries into month sections for the read-only Journal
 * feed. Entries are sorted newest-first (ISO date strings sort chronologically),
 * then bucketed by calendar month with a "Month YYYY" label.
 */
import { format, parseISO } from 'date-fns';
import type { DailyJournalEntry } from '../../health-tracking/types';

export interface JournalMonthGroup {
    /** Display label, e.g. "July 2026". */
    label: string;
    /** Entries in this month, newest day first. */
    entries: DailyJournalEntry[];
}

export function groupEntriesByMonth(entries: DailyJournalEntry[]): JournalMonthGroup[] {
    const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));

    const groups: JournalMonthGroup[] = [];
    let current: JournalMonthGroup | null = null;
    let currentKey = '';

    for (const entry of sorted) {
        const parsed = parseISO(entry.date);
        const key = format(parsed, 'yyyy-MM');
        if (!current || key !== currentKey) {
            current = { label: format(parsed, 'MMMM yyyy'), entries: [] };
            currentKey = key;
            groups.push(current);
        }
        current.entries.push(entry);
    }

    return groups;
}
