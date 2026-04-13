/**
 * Daily Journal Entry Operations
 */

import type { DailyJournalEntry, JournalPromptResponse } from '../../../types';
import type { DbDailyJournalEntry } from '../types';
import { supabase } from '../client';
import { dbToDailyJournalEntry } from '../converters/experiment';

export async function getJournalEntry(date: string): Promise<DailyJournalEntry | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
        .from('daily_journal_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', date)
        .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return dbToDailyJournalEntry(data as DbDailyJournalEntry);
}

export async function saveJournalEntry(entry: {
    date: string;
    prompts: JournalPromptResponse[];
    moodRating?: number;
    energyRating?: number;
    wins: string[];
}): Promise<DailyJournalEntry> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const row = {
        user_id: user.id,
        date: entry.date,
        prompts: entry.prompts,
        mood_rating: entry.moodRating ?? null,
        energy_rating: entry.energyRating ?? null,
        wins: entry.wins,
        updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
        .from('daily_journal_entries')
        .upsert(row, { onConflict: 'user_id,date' })
        .select()
        .single();

    if (error) throw error;
    return dbToDailyJournalEntry(data as DbDailyJournalEntry);
}

export async function getJournalEntries(dateRange: { from: string; to: string }): Promise<DailyJournalEntry[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
        .from('daily_journal_entries')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', dateRange.from)
        .lte('date', dateRange.to)
        .order('date', { ascending: false });

    if (error) throw error;
    return (data as DbDailyJournalEntry[]).map(dbToDailyJournalEntry);
}
