import React, { createContext, useContext, useCallback } from 'react';
import type { Experiment } from '../types';
import { db } from '../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';

interface ExperimentContextType {
    experiments: Experiment[];
    addExperiment: (experiment: Omit<Experiment, 'id' | 'active'>) => Promise<string>;
    updateExperiment: (experiment: Experiment) => Promise<void>;
    deleteExperiment: (id: string) => Promise<void>;
    getActiveExperiments: () => Experiment[];
}

const ExperimentContext = createContext<ExperimentContextType | undefined>(undefined);

export const ExperimentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

    const experiments = useLiveQuery(() => db.experiments.toArray(), [], []);

    const addExperiment = useCallback(async (experiment: Omit<Experiment, 'id' | 'active'>) => {
        const id = uuidv4();
        const newExperiment: Experiment = {
            ...experiment,
            id,
            active: true
        };
        await db.experiments.add(newExperiment);
        return id;
    }, []);

    const updateExperiment = useCallback(async (experiment: Experiment) => {
        const { id, ...updates } = experiment;
        await db.experiments.update(id, updates);
    }, []);

    const deleteExperiment = useCallback(async (id: string) => {
        await db.experiments.delete(id);
    }, []);

    const getActiveExperiments = useCallback(() => {
        return experiments?.filter(e => e.active) || [];
    }, [experiments]);

    return (
        <ExperimentContext.Provider value={{
            experiments: experiments || [],
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
