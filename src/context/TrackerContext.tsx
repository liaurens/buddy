// Backward compatibility wrapper - delegates to useTrackers hook
import React, { createContext, useContext } from 'react';
import type { TrackerState } from '../types';
import { useTrackers } from '../features/health-tracking/hooks/useTrackers';

const TrackerContext = createContext<TrackerState | undefined>(undefined);

export const TrackerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const trackerState = useTrackers();
    return (
        <TrackerContext.Provider value={trackerState}>
            {children}
        </TrackerContext.Provider>
    );
};

export const useTracker = () => {
    const context = useContext(TrackerContext);
    if (context === undefined) {
        throw new Error('useTracker must be used within a TrackerProvider');
    }
    return context;
};
