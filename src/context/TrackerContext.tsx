import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Entry, TrackerState, TrackerDefinition } from '../types';
import { db, initializeDatabase, exportAllData, importAllData } from '../services/db';
import { useLiveQuery } from 'dexie-react-hooks';

const TrackerContext = createContext<TrackerState | undefined>(undefined);

export const TrackerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isInitialized, setIsInitialized] = useState(false);

    // Initialize database on mount
    useEffect(() => {
        const init = async () => {
            try {
                await initializeDatabase();
            } catch (error) {
                console.error('Database initialization failed:', error);
            } finally {
                setIsInitialized(true);
            }
        };
        init();
    }, []);
    const entries = useLiveQuery(
        () => db.entries.orderBy('timestamp').reverse().toArray(),
        [],
        []
    );

    const trackers = useLiveQuery(
        () => db.trackers.toArray(),
        [],
        []
    );

    const addEntry = useCallback(async (entry: Omit<Entry, 'id'>) => {
        const newEntry: Entry = {
            ...entry,
            id: uuidv4(),
            timestamp: entry.timestamp || new Date().toISOString(),
        };
        await db.entries.add(newEntry);
    }, []);

    const updateEntry = useCallback(async (updatedEntry: Entry) => {
        const { id, ...updates } = updatedEntry;
        await db.entries.update(id, updates);
    }, []);

    const deleteEntry = useCallback(async (id: string) => {
        await db.entries.delete(id);
    }, []);

    const addTracker = useCallback(async (tracker: TrackerDefinition) => {
        await db.trackers.add(tracker);
    }, []);

    const updateTracker = useCallback(async (tracker: TrackerDefinition) => {
        const { id, ...updates } = tracker;
        await db.trackers.update(id, updates);
    }, []);

    const deleteTracker = useCallback(async (id: string) => {
        await db.trackers.delete(id);
        // Also delete related entries
        await db.entries.where('trackerId').equals(id).delete();
    }, []);

    const exportData = useCallback(async () => {
        return await exportAllData();
    }, []);

    const importData = useCallback(async (jsonData: string): Promise<boolean> => {
        const success = await importAllData(jsonData);
        return success;
    }, []);

    // Show loading state while initializing
    if (!isInitialized) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-900">
                <div className="text-white text-lg">Loading...</div>
            </div>
        );
    }

    return (
        <TrackerContext.Provider value={{
            entries: entries || [],
            trackers: trackers || [],
            addEntry,
            updateEntry,
            deleteEntry,
            addTracker,
            updateTracker,
            deleteTracker,
            exportData,
            importData,
        }}>
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

// Re-export for convenience
export { exportAllData, importAllData };
