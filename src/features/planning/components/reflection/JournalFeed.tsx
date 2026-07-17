/**
 * JournalFeed — read-only, all-time diary view.
 *
 * A chronological feed of every closed day, grouped by month. Each day shows
 * its core memory prominently, with gratitude and challenge beneath. Writing
 * happens elsewhere (the reflection form and the end-of-day review); this tab
 * is purely for reminiscing.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { useAuth } from '../../../../hooks/useAuth';
import { getJournalEntries } from '../../../../services/supabase';
import { Whale } from '../../../cove/components';
import { groupEntriesByMonth } from '../../utils/journalGrouping';
import type { DailyJournalEntry } from '../../../health-tracking/types';

/** Far-back start so the feed effectively loads the full history. */
const HISTORY_START = '2020-01-01';

const promptAnswer = (entry: DailyJournalEntry, promptId: string): string =>
    entry.prompts.find((p) => p.promptId === promptId)?.answer?.trim() ?? '';

const DayCard: React.FC<{ entry: DailyJournalEntry }> = ({ entry }) => {
    const memory = promptAnswer(entry, 'core_memory');
    const gratitude = promptAnswer(entry, 'gratitude');
    const challenge = promptAnswer(entry, 'challenge');

    return (
        <div className="app-surface p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-cove-muted">
                {format(parseISO(entry.date), 'EEEE, MMM d')}
            </p>
            {memory ? (
                <p className="mt-2 text-[15px] font-extrabold leading-snug text-cove-ink whitespace-pre-wrap">
                    {memory}
                </p>
            ) : null}
            {gratitude ? (
                <div className="mt-3">
                    <span className="text-xs font-semibold text-cove-soft">Grateful for</span>
                    <p className="text-sm font-semibold text-cove-muted whitespace-pre-wrap">
                        {gratitude}
                    </p>
                </div>
            ) : null}
            {challenge ? (
                <div className="mt-3">
                    <span className="text-xs font-semibold text-cove-soft">Challenge & growth</span>
                    <p className="text-sm font-semibold text-cove-muted whitespace-pre-wrap">
                        {challenge}
                    </p>
                </div>
            ) : null}
        </div>
    );
};

const JournalFeed: React.FC = () => {
    const { user } = useAuth();

    const {
        data: entries = [],
        isLoading,
        error,
    } = useQuery({
        queryKey: ['daily-journal-all', user?.id],
        queryFn: () =>
            getJournalEntries({
                from: HISTORY_START,
                to: format(new Date(), 'yyyy-MM-dd'),
            }),
        enabled: !!user?.id,
        staleTime: 60_000,
    });

    if (isLoading) {
        return (
            <p className="px-1 py-4 text-sm font-semibold text-cove-soft">Loading your journal…</p>
        );
    }

    if (error) {
        return (
            <p className="px-1 py-4 text-sm font-semibold text-cove-pink">
                Could not load your journal — try again in a moment.
            </p>
        );
    }

    if (entries.length === 0) {
        return (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Whale size="hero" />
                <p className="max-w-[260px] text-sm font-semibold text-cove-soft">
                    Your days will show up here as you close them.
                </p>
            </div>
        );
    }

    const groups = groupEntriesByMonth(entries);

    return (
        <div className="space-y-6">
            {groups.map((group) => (
                <section key={group.label} className="space-y-3">
                    <h2 className="px-1 text-sm font-extrabold uppercase tracking-wide text-cove-muted">
                        {group.label}
                    </h2>
                    <div className="space-y-3">
                        {group.entries.map((entry) => (
                            <DayCard key={entry.id} entry={entry} />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
};

export default JournalFeed;
