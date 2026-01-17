import React, { createContext, useContext, useCallback } from 'react';
import type { Protocol, Cycle, Dose } from '../types';
import { db } from '../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';

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
    // Live queries
    const protocols = useLiveQuery(() => db.protocols.toArray(), [], []);
    const cycles = useLiveQuery(() => db.cycles.orderBy('startDate').reverse().toArray(), [], []);
    const doses = useLiveQuery(() => db.doses.orderBy('takenAt').reverse().toArray(), [], []);

    // Protocol CRUD
    const addProtocol = useCallback(async (protocol: Omit<Protocol, 'id' | 'createdAt'>): Promise<string> => {
        const id = uuidv4();
        const newProtocol: Protocol = {
            ...protocol,
            id,
            createdAt: new Date().toISOString(),
        };
        await db.protocols.add(newProtocol);
        return id;
    }, []);

    const updateProtocol = useCallback(async (protocol: Protocol) => {
        const { id, ...updates } = protocol;
        await db.protocols.update(id, updates);
    }, []);

    const deleteProtocol = useCallback(async (id: string) => {
        // Delete protocol and related data
        await db.transaction('rw', [db.protocols, db.cycles, db.doses], async () => {
            await db.protocols.delete(id);
            const relatedCycles = await db.cycles.where('protocolId').equals(id).toArray();
            const cycleIds = relatedCycles.map(c => c.id);
            await db.cycles.where('protocolId').equals(id).delete();
            if (cycleIds.length > 0) {
                await db.doses.where('cycleId').anyOf(cycleIds).delete();
            }
            await db.doses.where('protocolId').equals(id).delete();
        });
    }, []);

    // Cycle management
    const startCycle = useCallback(async (
        protocolId: string,
        plannedEndDate?: string,
        offCycleDays?: number
    ): Promise<string> => {
        // Get existing cycles for this protocol to determine cycle number
        const existingCycles = await db.cycles
            .where('protocolId')
            .equals(protocolId)
            .toArray();

        const cycleNumber = existingCycles.length + 1;
        const id = uuidv4();

        const newCycle: Cycle = {
            id,
            protocolId,
            cycleNumber,
            startDate: new Date().toISOString().split('T')[0],
            plannedEndDate,
            offCycleDays,
            status: 'active',
        };

        await db.cycles.add(newCycle);
        return id;
    }, []);

    const completeCycle = useCallback(async (cycleId: string) => {
        await db.cycles.update(cycleId, {
            status: 'completed',
            actualEndDate: new Date().toISOString().split('T')[0],
        });
    }, []);

    const abortCycle = useCallback(async (cycleId: string, notes?: string) => {
        await db.cycles.update(cycleId, {
            status: 'aborted',
            actualEndDate: new Date().toISOString().split('T')[0],
            notes,
        });
    }, []);

    // Dose logging
    const logDose = useCallback(async (
        protocolId: string,
        cycleId?: string,
        actualAmount?: number
    ) => {
        const timestamp = new Date().toISOString();
        const newDose: Dose = {
            id: uuidv4(),
            protocolId,
            cycleId,
            takenAt: timestamp,
            actualAmount,
            skipped: false,
        };

        await db.doses.add(newDose);

        // Check for linked tracker
        const protocol = protocols.find(p => p.id === protocolId);
        if (protocol && protocol.linkedTrackerId) {
            // Determine value based on tracker type or amount
            // If actualAmount is provided, use it. active defaults for boolean can be 1.
            let value = 1;
            if (actualAmount !== undefined) {
                value = actualAmount;
            } else if (protocol.doseAmount) {
                value = protocol.doseAmount;
            }

            // Create tracker entry
            await db.entries.add({
                id: uuidv4(),
                trackerId: protocol.linkedTrackerId,
                value: value,
                timestamp: timestamp,
                notes: `Protocol dose: ${protocol.name}`,
            });
        }
    }, [protocols]);

    const skipDose = useCallback(async (
        protocolId: string,
        cycleId?: string,
        reason?: string
    ) => {
        const newDose: Dose = {
            id: uuidv4(),
            protocolId,
            cycleId,
            scheduledAt: new Date().toISOString(),
            skipped: true,
            skipReason: reason,
        };
        await db.doses.add(newDose);
    }, []);

    const deleteDose = useCallback(async (doseId: string) => {
        await db.doses.delete(doseId);
    }, []);

    // Helpers
    const getActiveProtocols = useCallback(() => {
        return protocols.filter(p => p.active);
    }, [protocols]);

    const getActiveCycle = useCallback((protocolId: string): Cycle | undefined => {
        return cycles.find(c => c.protocolId === protocolId && c.status === 'active');
    }, [cycles]);

    const getRecentDoses = useCallback((protocolId: string, days: number = 7): Dose[] => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        return doses.filter(d =>
            d.protocolId === protocolId &&
            d.takenAt &&
            new Date(d.takenAt) >= cutoff
        );
    }, [doses]);

    return (
        <ProtocolContext.Provider value={{
            protocols,
            cycles,
            doses,
            addProtocol,
            updateProtocol,
            deleteProtocol,
            startCycle,
            completeCycle,
            abortCycle,
            logDose,
            skipDose,
            deleteDose,
            getActiveProtocols,
            getActiveCycle,
            getRecentDoses,
        }}>
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
