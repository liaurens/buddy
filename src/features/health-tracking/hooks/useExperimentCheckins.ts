import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ExperimentCheckinEntry } from '../types';
import {
    getExperimentCheckins,
    saveExperimentCheckin,
    deleteExperimentCheckin,
    deleteExperimentCheckinByDate,
} from '../../../services/supabase';

export const useExperimentCheckins = (experimentId: string) => {
    const queryClient = useQueryClient();

    const { data: checkins = [], isLoading } = useQuery({
        queryKey: ['experiment-checkins', experimentId],
        queryFn: () => getExperimentCheckins(experimentId),
        enabled: !!experimentId,
    });

    const saveCheckin = useCallback(
        async (
            date: string,
            entries: { metricId: string; value?: number; textValue?: string; phaseId?: string }[],
        ) => {
            await saveExperimentCheckin(experimentId, date, entries);
            queryClient.invalidateQueries({ queryKey: ['experiment-checkins', experimentId] });
        },
        [experimentId, queryClient],
    );

    const removeCheckin = useCallback(
        async (id: string) => {
            await deleteExperimentCheckin(id);
            queryClient.invalidateQueries({ queryKey: ['experiment-checkins', experimentId] });
        },
        [experimentId, queryClient],
    );

    const removeCheckinForDate = useCallback(
        async (date: string) => {
            await deleteExperimentCheckinByDate(experimentId, date);
            queryClient.invalidateQueries({ queryKey: ['experiment-checkins', experimentId] });
        },
        [experimentId, queryClient],
    );

    // Group checkins by date
    const checkinsByDate = checkins.reduce<Record<string, ExperimentCheckinEntry[]>>(
        (acc, entry) => {
            if (!acc[entry.date]) acc[entry.date] = [];
            acc[entry.date].push(entry);
            return acc;
        },
        {},
    );

    return {
        checkins,
        checkinsByDate,
        isLoading,
        saveCheckin,
        removeCheckin,
        removeCheckinForDate,
    };
};
