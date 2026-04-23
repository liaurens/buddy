import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import type { Protocol, Cycle, Dose } from '../types';
import { useAuth } from '../../../hooks/useAuth';
import {
    supabase,
    dbToProtocol,
    protocolToDb,
    dbToCycle,
    cycleToDb,
    dbToDose,
    doseToDb,
    entryToDb,
    type DbProtocol,
    type DbCycle,
    type DbDose,
} from '../../../services/supabase';

const EMPTY_ARRAY: any[] = [];

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

export function useProtocols(): ProtocolContextType {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const userId = user?.id;

    // Fetch protocols
    const { data: protocols = EMPTY_ARRAY as Protocol[] } = useQuery({
        queryKey: ['protocols', userId],
        queryFn: async () => {
            if (!userId) return [];
            const { data, error } = await supabase
                .from('protocols')
                .select('*')
                .eq('user_id', userId);

            if (error) throw error;
            return (data as DbProtocol[]).map(dbToProtocol);
        },
        enabled: !!userId,
    });

    // Fetch cycles
    const { data: cycles = EMPTY_ARRAY as Cycle[] } = useQuery({
        queryKey: ['cycles', userId],
        queryFn: async () => {
            if (!userId) return [];
            const { data, error } = await supabase
                .from('cycles')
                .select('*')
                .eq('user_id', userId)
                .order('start_date', { ascending: false });

            if (error) throw error;
            return (data as DbCycle[]).map(dbToCycle);
        },
        enabled: !!userId,
    });

    // Fetch doses
    const { data: doses = EMPTY_ARRAY as Dose[] } = useQuery({
        queryKey: ['doses', userId],
        queryFn: async () => {
            if (!userId) return [];
            const { data, error } = await supabase
                .from('doses')
                .select('*')
                .eq('user_id', userId)
                .order('taken_at', { ascending: false });

            if (error) throw error;
            return (data as DbDose[]).map(dbToDose);
        },
        enabled: !!userId,
    });

    // Protocol CRUD
    const addProtocol = useCallback(async (protocol: Omit<Protocol, 'id' | 'createdAt'>): Promise<string> => {
        if (!userId) throw new Error('Not authenticated');

        const id = uuidv4();
        const newProtocol = {
            ...protocol,
            id,
        };

        const dbProtocol = protocolToDb(newProtocol, userId);
        const { error } = await supabase.from('protocols').insert(dbProtocol);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['protocols', userId] });
        return id;
    }, [userId, queryClient]);

    const updateProtocol = useCallback(async (protocol: Protocol) => {
        if (!userId) throw new Error('Not authenticated');

        const { id, createdAt: _createdAt, ...updates } = protocol;
        const dbUpdates = {
            name: updates.name,
            category: updates.category,
            dose_amount: updates.doseAmount || null,
            dose_unit: updates.doseUnit || null,
            frequency: updates.frequency,
            route: updates.route || null,
            timing_notes: updates.timingNotes || null,
            half_life_hours: updates.halfLifeHours || null,
            active: updates.active,
            expected_outcomes: updates.expectedOutcomes || null,
            linked_tracker_id: updates.linkedTrackerId || null,
            default_tracker_type: updates.defaultTrackerType || null,
            effect_timing: updates.effectTiming || null,
        };

        const { error } = await supabase
            .from('protocols')
            .update(dbUpdates)
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['protocols', userId] });
    }, [userId, queryClient]);

    const deleteProtocol = useCallback(async (id: string) => {
        if (!userId) throw new Error('Not authenticated');

        // Delete related doses first
        await supabase.from('doses').delete().eq('protocol_id', id).eq('user_id', userId);

        // Delete related cycles
        await supabase.from('cycles').delete().eq('protocol_id', id).eq('user_id', userId);

        // Delete the protocol
        const { error } = await supabase
            .from('protocols')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['protocols', userId] });
        queryClient.invalidateQueries({ queryKey: ['cycles', userId] });
        queryClient.invalidateQueries({ queryKey: ['doses', userId] });
    }, [userId, queryClient]);

    // Cycle management
    const startCycle = useCallback(async (
        protocolId: string,
        plannedEndDate?: string,
        offCycleDays?: number
    ): Promise<string> => {
        if (!userId) throw new Error('Not authenticated');

        // Get existing cycles to determine cycle number
        const existingCycles = cycles.filter(c => c.protocolId === protocolId);
        const cycleNumber = existingCycles.length + 1;
        const id = uuidv4();

        const newCycle: Omit<Cycle, 'id'> & { id: string } = {
            id,
            protocolId,
            cycleNumber,
            startDate: new Date().toISOString().split('T')[0],
            plannedEndDate,
            offCycleDays,
            status: 'active',
        };

        const dbCycle = cycleToDb(newCycle, userId);
        const { error } = await supabase.from('cycles').insert(dbCycle);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['cycles', userId] });
        return id;
    }, [userId, cycles, queryClient]);

    const completeCycle = useCallback(async (cycleId: string) => {
        if (!userId) throw new Error('Not authenticated');

        const { error } = await supabase
            .from('cycles')
            .update({
                status: 'completed',
                actual_end_date: new Date().toISOString().split('T')[0],
            })
            .eq('id', cycleId)
            .eq('user_id', userId);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['cycles', userId] });
    }, [userId, queryClient]);

    const abortCycle = useCallback(async (cycleId: string, notes?: string) => {
        if (!userId) throw new Error('Not authenticated');

        const { error } = await supabase
            .from('cycles')
            .update({
                status: 'aborted',
                actual_end_date: new Date().toISOString().split('T')[0],
                notes,
            })
            .eq('id', cycleId)
            .eq('user_id', userId);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['cycles', userId] });
    }, [userId, queryClient]);

    // Dose logging
    const logDose = useCallback(async (
        protocolId: string,
        cycleId?: string,
        actualAmount?: number
    ) => {
        if (!userId) throw new Error('Not authenticated');

        const timestamp = new Date().toISOString();
        const newDose: Omit<Dose, 'id'> & { id: string } = {
            id: uuidv4(),
            protocolId,
            cycleId,
            takenAt: timestamp,
            actualAmount,
            skipped: false,
        };

        const dbDose = doseToDb(newDose, userId);
        const { error } = await supabase.from('doses').insert(dbDose);

        if (error) throw error;

        // Check for linked tracker
        const protocol = protocols.find(p => p.id === protocolId);
        if (protocol && protocol.linkedTrackerId) {
            let value = 1;
            if (actualAmount !== undefined) {
                value = actualAmount;
            } else if (protocol.doseAmount) {
                value = protocol.doseAmount;
            }

            const entryData = entryToDb({
                id: uuidv4(),
                trackerId: protocol.linkedTrackerId,
                value: value,
                timestamp: timestamp,
                notes: `Protocol dose: ${protocol.name}`,
            }, userId);

            await supabase.from('entries').insert(entryData);
            queryClient.invalidateQueries({ queryKey: ['entries', userId] });
        }

        queryClient.invalidateQueries({ queryKey: ['doses', userId] });
    }, [userId, protocols, queryClient]);

    const skipDose = useCallback(async (
        protocolId: string,
        cycleId?: string,
        reason?: string
    ) => {
        if (!userId) throw new Error('Not authenticated');

        const newDose: Omit<Dose, 'id'> & { id: string } = {
            id: uuidv4(),
            protocolId,
            cycleId,
            scheduledAt: new Date().toISOString(),
            skipped: true,
            skipReason: reason,
        };

        const dbDose = doseToDb(newDose, userId);
        const { error } = await supabase.from('doses').insert(dbDose);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['doses', userId] });
    }, [userId, queryClient]);

    const deleteDose = useCallback(async (doseId: string) => {
        if (!userId) throw new Error('Not authenticated');

        const { error } = await supabase
            .from('doses')
            .delete()
            .eq('id', doseId)
            .eq('user_id', userId);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['doses', userId] });
    }, [userId, queryClient]);

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

    return {
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
    };
}
