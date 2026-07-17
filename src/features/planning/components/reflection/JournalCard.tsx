/**
 * JournalCard — read-back view of the daily journal.
 *
 * The reflection capture form writes a composed entry into
 * `daily_journal_entries` (core memory, gratitude, challenge). This card shows
 * the last days of those entries so the reflection page doubles as a journal.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, subDays } from 'date-fns';
import { BookOpen, ChevronDown, ChevronRight } from 'lucide-react';
import { getJournalEntries } from '../../../../services/supabase';

const HISTORY_DAYS = 14;

interface JournalCardProps {
    /** Changes whenever a reflection is saved, so the list refetches. */
    refreshToken: string | null;
}

const JournalCard: React.FC<JournalCardProps> = ({ refreshToken }) => {
    const [open, setOpen] = useState(false);

    const {
        data: entries = [],
        isLoading,
        error,
    } = useQuery({
        queryKey: ['daily-journal-history', refreshToken],
        queryFn: () =>
            getJournalEntries({
                from: format(subDays(new Date(), HISTORY_DAYS), 'yyyy-MM-dd'),
                to: format(new Date(), 'yyyy-MM-dd'),
            }),
        staleTime: 60_000,
    });

    return (
        <div className="bg-white rounded-[18px] shadow-cove">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#eef6fa] transition-colors rounded-[18px]"
            >
                <span className="flex items-center gap-2 text-sm font-extrabold text-cove-muted uppercase tracking-wide">
                    <BookOpen size={16} className="text-cove-streak" /> Journal — last{' '}
                    {HISTORY_DAYS} days
                </span>
                {open ? (
                    <ChevronDown size={18} className="text-cove-soft" />
                ) : (
                    <ChevronRight size={18} className="text-cove-soft" />
                )}
            </button>

            {open && (
                <div className="px-5 pb-5">
                    {isLoading ? (
                        <p className="text-sm font-semibold text-cove-soft py-2">Loading…</p>
                    ) : error ? (
                        <p className="text-sm font-semibold text-cove-pink py-2">
                            Could not load journal entries.
                        </p>
                    ) : entries.length === 0 ? (
                        <p className="text-sm font-semibold text-cove-soft py-2 italic">
                            No journal entries yet. Save a reflection above and it lands here.
                        </p>
                    ) : (
                        <ul className="space-y-4">
                            {entries.map((entry) => (
                                <li
                                    key={entry.id}
                                    className="border-l-2 border-cove-streak/40 pl-3"
                                >
                                    <p className="text-xs font-bold text-cove-muted">
                                        {format(parseISO(entry.date), 'EEEE, MMM d')}
                                    </p>
                                    <div className="mt-1 space-y-1.5">
                                        {entry.prompts
                                            .filter((p) => p.answer)
                                            .map((p) => (
                                                <div key={p.promptId}>
                                                    <span className="text-xs font-semibold text-cove-soft">
                                                        {p.question}
                                                    </span>
                                                    <p className="text-sm font-semibold text-cove-ink whitespace-pre-wrap">
                                                        {p.answer}
                                                    </p>
                                                </div>
                                            ))}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
};

export default JournalCard;
