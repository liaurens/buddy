// Backward compatibility wrapper - delegates to useProtocols hook
import React, { createContext, useContext } from 'react';
import type { Protocol, Cycle, Dose } from '../types';
import { useProtocols } from '../features/health-tracking/hooks/useProtocols';

interface ProtocolContextType {
    protocols: Protocol[];
    cycles: Cycle[];
    doses: Dose[];

    // Protocol CRUD
    addProtocol: (protocol: Omit<Protocol, 'id' | 'createdAt'>) => Promise<string>;
    updateProtocol: (protocol: Protocol) => Promise<void>;
    deleteProtocol: (id: string) => Promise<void>;

    // Cycle management
    startCycle: (protocolId: string, plannedEndDate?: string, offCycleDays?: number) => Promise<string>;
    completeCycle: (cycleId: string) => Promise<void>;
    abortCycle: (cycleId: string, notes?: string) => Promise<void>;

    // Dose logging
    logDose: (protocolId: string, cycleId?: string, actualAmount?: number) => Promise<void>;
    skipDose: (protocolId: string, cycleId?: string, reason?: string) => Promise<void>;
    deleteDose: (doseId: string) => Promise<void>;

    // Helpers
    getActiveProtocols: () => Protocol[];
    getActiveCycle: (protocolId: string) => Cycle | undefined;
    getRecentDoses: (protocolId: string, days?: number) => Dose[];
}

const ProtocolContext = createContext<ProtocolContextType | undefined>(undefined);

export const ProtocolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const protocolState = useProtocols();
    return (
        <ProtocolContext.Provider value={protocolState}>
            {children}
        </ProtocolContext.Provider>
    );
};

export const useProtocol = () => {
    const context = useContext(ProtocolContext);
    if (context === undefined) {
        throw new Error('useProtocol must be used within a ProtocolProvider');
    }
    return context;
};
