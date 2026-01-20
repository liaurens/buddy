import React, { createContext, useContext, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Experiment } from '../types';
import { useAuth } from '../hooks/useAuth';
import { v4 as uuidv4 } from 'uuid';
import {
    supabase,
    dbToExperiment,
    experimentToDb,
    type DbExperiment,
} from '../services/supabase';

interface ExperimentContextType {
    experiments: Experiment[];
    addExperiment: (experiment: Omit<Experiment, 'id' | 'active'>) => Promise<string>;
    updateExperiment: (experiment: Experiment) => Promise<void>;
    deleteExperiment: (id: string) => Promise<void>;
    getActiveExperiments: () => Experiment[];
}

const ExperimentContext = createContext<ExperimentContextType | undefined>(undefined);

export const ExperimentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const userId = user?.id;

    // Fetch experiments
    const { data: experiments = [] } = useQuery({
        queryKey: ['experiments', userId],
        queryFn: async () => {
            if (!userId) return [];
            const { data, error } = await supabase
                .from('experiments')
                .select('*')
                .eq('user_id', userId);

            if (error) throw error;
            return (data as DbExperiment[]).map(dbToExperiment);
        },
        enabled: !!userId,
    });

    // Realtime subscriptions disabled temporarily for debugging

    const addExperiment = useCallback(async (experiment: Omit<Experiment, 'id' | 'active'>) => {
        if (!userId) throw new Error('Not authenticated');

        const id = uuidv4();
        const newExperiment = {
            ...experiment,
            id,
            active: true,
        };

        const dbExperiment = experimentToDb(newExperiment, userId);
        const { error } = await supabase.from('experiments').insert(dbExperiment);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['experiments', userId] });
        return id;
    }, [userId, queryClient]);

    const updateExperiment = useCallback(async (experiment: Experiment) => {
        if (!userId) return;

        const { id, ...updates } = experiment;
        const dbUpdates = {
            name: updates.name,
            description: updates.description || null,
            tracker1_id: updates.tracker1Id || null,
            tracker2_id: updates.tracker2Id || null,
            start_date: updates.startDate || null,
            end_date: updates.endDate || null,
            active: updates.active,
            frequency: updates.frequency || null,
        };

        const { error } = await supabase
            .from('experiments')
            .update(dbUpdates)
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['experiments', userId] });
    }, [userId, queryClient]);

    const deleteExperiment = useCallback(async (id: string) => {
        if (!userId) return;

        const { error } = await supabase
            .from('experiments')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['experiments', userId] });
    }, [userId, queryClient]);

    const getActiveExperiments = useCallback(() => {
        return experiments.filter(e => e.active);
    }, [experiments]);

    return (
        <ExperimentContext.Provider value={{
            experiments,
            addExperiment,
            updateExperiment,
            deleteExperiment,
            getActiveExperiments
        }}>
            {children}
        </ExperimentContext.Provider>
    );
};

export const useExperiment = () => {
    const context = useContext(ExperimentContext);
    if (context === undefined) {
        throw new Error('useExperiment must be used within a ExperimentProvider');
    }
    return context;
};
