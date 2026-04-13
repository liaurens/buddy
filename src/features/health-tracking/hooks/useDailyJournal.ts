import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { JournalPromptResponse } from '../types';
import {
    getJournalEntry,
    saveJournalEntry,
} from '../../../services/supabase';

export const useDailyJournal = (date: string) => {
    const queryClient = useQueryClient();

    const { data: journalEntry, isLoading } = useQuery({
        queryKey: ['daily-journal', date],
        queryFn: () => getJournalEntry(date),
        enabled: !!date,
    });

    const save = useCallback(async (entry: {
        prompts: JournalPromptResponse[];
        moodRating?: number;
        energyRating?: number;
        wins: string[];
    }) => {
        await saveJournalEntry({ date, ...entry });
        queryClient.invalidateQueries({ queryKey: ['daily-journal', date] });
    }, [date, queryClient]);

    return {
        journalEntry,
        isLoading,
        save,
    };
};
