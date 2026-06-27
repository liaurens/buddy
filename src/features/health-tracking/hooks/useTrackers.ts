import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import type { Entry, TrackerState, TrackerDefinition } from '../types';
import { useAuth } from '../../../hooks/useAuth';
import {
    supabase,
    dbToTracker,
    trackerToDb,
    dbToEntry,
    entryToDb,
    exportAllData,
    importAllData,
    type DbTracker,
    type DbEntry,
} from '../../../services/supabase';

const EMPTY_ARRAY: never[] = [];

export const useTrackers = (): TrackerState => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const userId = user?.id;

    // Fetch entries
    const { data: entries = EMPTY_ARRAY as Entry[] } = useQuery({
        queryKey: ['entries', userId],
        queryFn: async () => {
            if (!userId) return [];
            const { data, error } = await supabase
                .from('entries')
                .select('*')
                .eq('user_id', userId)
                .order('timestamp', { ascending: false });

            if (error) throw error;
            return (data as DbEntry[]).map(dbToEntry);
        },
        enabled: !!userId,
    });

    // Fetch trackers
    const { data: trackers = EMPTY_ARRAY as TrackerDefinition[] } = useQuery({
        queryKey: ['trackers', userId],
        queryFn: async () => {
            if (!userId) return [];
            const { data, error } = await supabase
                .from('trackers')
                .select('*')
                .eq('user_id', userId);

            if (error) throw error;
            return (data as DbTracker[]).map(dbToTracker);
        },
        enabled: !!userId,
    });

    const addEntry = useCallback(async (entry: Omit<Entry, 'id'>) => {
        if (!userId) throw new Error('Not authenticated');

        const newEntry: Entry = {
            ...entry,
            id: uuidv4(),
            timestamp: entry.timestamp || new Date().toISOString(),
        };

        const dbEntry = entryToDb(newEntry, userId);
        const { error } = await supabase.from('entries').insert(dbEntry);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['entries', userId] });
    }, [userId, queryClient]);

    const updateEntry = useCallback(async (updatedEntry: Entry) => {
        if (!userId) throw new Error('Not authenticated');

        const { id, ...updates } = updatedEntry;
        const dbUpdates = {
            tracker_id: updates.trackerId,
            value: updates.value,
            text_value: updates.textValue || null,
            timestamp: updates.timestamp,
            notes: updates.notes || null,
            metadata: updates.metadata || null,
        };

        const { error } = await supabase
            .from('entries')
            .update(dbUpdates)
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['entries', userId] });
    }, [userId, queryClient]);

    const deleteEntry = useCallback(async (id: string) => {
        if (!userId) throw new Error('Not authenticated');

        const { error } = await supabase
            .from('entries')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['entries', userId] });
    }, [userId, queryClient]);

    const addTracker = useCallback(async (tracker: TrackerDefinition) => {
        if (!userId) throw new Error('Not authenticated');

        const dbTracker = trackerToDb(tracker, userId);
        const { error } = await supabase.from('trackers').insert(dbTracker);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['trackers', userId] });
    }, [userId, queryClient]);

    const updateTracker = useCallback(async (tracker: TrackerDefinition) => {
        if (!userId) throw new Error('Not authenticated');

        const { id, ...updates } = tracker;
        const dbUpdates = {
            name: updates.name,
            emoji: updates.emoji || null,
            type: updates.type,
            unit: updates.unit || null,
            group: updates.group || null,
            goal: updates.goal || null,
            checkin_config: updates.checkinConfig || null,
        };

        const { error } = await supabase
            .from('trackers')
            .update(dbUpdates)
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['trackers', userId] });
    }, [userId, queryClient]);

    const deleteTracker = useCallback(async (id: string) => {
        if (!userId) throw new Error('Not authenticated');

        // Delete related entries first
        await supabase
            .from('entries')
            .delete()
            .eq('tracker_id', id)
            .eq('user_id', userId);

        // Delete the tracker
        const { error } = await supabase
            .from('trackers')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['trackers', userId] });
        queryClient.invalidateQueries({ queryKey: ['entries', userId] });
    }, [userId, queryClient]);

    const exportData = useCallback(async () => {
        if (!userId) throw new Error('Not authenticated');
        return await exportAllData(userId);
    }, [userId]);

    const importData = useCallback(async (jsonData: string): Promise<boolean> => {
        if (!userId) throw new Error('Not authenticated');
        const success = await importAllData(jsonData, userId);
        if (success) {
            queryClient.invalidateQueries({ queryKey: ['trackers', userId] });
            queryClient.invalidateQueries({ queryKey: ['entries', userId] });
        }
        return success;
    }, [userId, queryClient]);

    return {
        entries,
        trackers,
        addEntry,
        updateEntry,
        deleteEntry,
        addTracker,
        updateTracker,
        deleteTracker,
        exportData,
        importData,
    };
};
