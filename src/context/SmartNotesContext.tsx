// Backward compatibility wrapper - delegates to useNotes hook
import React, { createContext, useContext } from 'react';
import type { SmartNotesState } from '../types';
import { useNotes } from '../features/tasks/hooks/useNotes';

const SmartNotesContext = createContext<SmartNotesState | undefined>(undefined);

export const SmartNotesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const notesState = useNotes();
    return (
        <SmartNotesContext.Provider value={notesState}>
            {children}
        </SmartNotesContext.Provider>
    );
};

export const useSmartNotes = () => {
    const context = useContext(SmartNotesContext);
    if (context === undefined) {
        throw new Error('useSmartNotes must be used within a SmartNotesProvider');
    }
    return context;
};
