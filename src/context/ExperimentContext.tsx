// Backward compatibility wrapper - delegates to useExperiments hook
import React, { createContext, useContext } from 'react';
import type { Experiment } from '../types';
import { useExperiments } from '../features/health-tracking/hooks/useExperiments';

interface ExperimentContextType {
    experiments: Experiment[];
    addExperiment: (experiment: Omit<Experiment, 'id' | 'active'>) => Promise<string>;
    updateExperiment: (experiment: Experiment) => Promise<void>;
    deleteExperiment: (id: string) => Promise<void>;
    getActiveExperiments: () => Experiment[];
}

const ExperimentContext = createContext<ExperimentContextType | undefined>(undefined);

export const ExperimentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const experimentState = useExperiments();
    return (
        <ExperimentContext.Provider value={experimentState}>
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
