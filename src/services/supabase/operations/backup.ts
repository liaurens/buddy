/**
 * Data Export & Import Operations
 */

import type {
    TrackerDefinition,
    Entry,
    Protocol,
    Cycle,
    Dose,
    Experiment,
    ExperimentLog,
} from '../../../features/health-tracking/types';
import type { Strategy } from '../../../features/toolbox/types';
import type { Task } from '../../../features/tasks/types';
import { supabase } from '../client';
import { dbToTracker, trackerToDb, dbToEntry, entryToDb } from '../converters/tracker';
import {
    dbToProtocol,
    protocolToDb,
    dbToCycle,
    cycleToDb,
    dbToDose,
    doseToDb,
} from '../converters/protocol';
import {
    dbToExperiment,
    experimentToDb,
    dbToExperimentLog,
    experimentLogToDb,
    dbToCorrelation,
} from '../converters/experiment';
import { dbToStrategy, strategyToDb } from '../converters/strategy';
import { dbToTodo, todoToDb } from '../converters/todo';
import type {
    DbTracker,
    DbEntry,
    DbProtocol,
    DbCycle,
    DbDose,
    DbExperiment,
    DbExperimentLog,
    DbCorrelation,
    DbStrategy,
    DbTodo,
} from '../types';

export async function exportAllData(userId: string): Promise<string> {
    const [
        { data: trackers },
        { data: entries },
        { data: protocols },
        { data: cycles },
        { data: doses },
        { data: experiments },
        { data: correlations },
        { data: strategies },
        { data: todos },
        { data: logs },
    ] = await Promise.all([
        supabase.from('trackers').select('*').eq('user_id', userId),
        supabase.from('entries').select('*').eq('user_id', userId),
        supabase.from('protocols').select('*').eq('user_id', userId),
        supabase.from('cycles').select('*').eq('user_id', userId),
        supabase.from('doses').select('*').eq('user_id', userId),
        supabase.from('experiments').select('*').eq('user_id', userId),
        supabase.from('correlations').select('*').eq('user_id', userId),
        supabase.from('strategies').select('*').eq('user_id', userId),
        supabase.from('todos').select('*').eq('user_id', userId),
        supabase.from('experiment_logs').select('*').eq('user_id', userId),
    ]);

    return JSON.stringify(
        {
            version: 3,
            exportedAt: new Date().toISOString(),
            trackers: (trackers as DbTracker[])?.map(dbToTracker) || [],
            entries: (entries as DbEntry[])?.map(dbToEntry) || [],
            protocols: (protocols as DbProtocol[])?.map(dbToProtocol) || [],
            cycles: (cycles as DbCycle[])?.map(dbToCycle) || [],
            doses: (doses as DbDose[])?.map(dbToDose) || [],
            experiments: (experiments as DbExperiment[])?.map(dbToExperiment) || [],
            logs: (logs as DbExperimentLog[])?.map(dbToExperimentLog) || [],
            correlations: (correlations as DbCorrelation[])?.map(dbToCorrelation) || [],
            strategies: (strategies as DbStrategy[])?.map(dbToStrategy) || [],
            todos: (todos as DbTodo[])?.map(dbToTodo) || [],
        },
        null,
        2,
    );
}

export async function importAllData(jsonData: string, userId: string): Promise<boolean> {
    try {
        const data = JSON.parse(jsonData);

        // Clear existing data first
        await Promise.all([
            supabase.from('entries').delete().eq('user_id', userId),
            supabase.from('doses').delete().eq('user_id', userId),
            supabase.from('cycles').delete().eq('user_id', userId),
            supabase.from('correlations').delete().eq('user_id', userId),
            supabase.from('experiment_logs').delete().eq('user_id', userId),
        ]);

        // Delete in order due to foreign key constraints
        await supabase.from('experiments').delete().eq('user_id', userId);
        await supabase.from('protocols').delete().eq('user_id', userId);
        await supabase.from('trackers').delete().eq('user_id', userId);
        await supabase.from('strategies').delete().eq('user_id', userId);
        await supabase.from('todos').delete().eq('user_id', userId);

        // Import new data
        if (data.trackers?.length > 0) {
            await supabase
                .from('trackers')
                .insert(data.trackers.map((t: TrackerDefinition) => trackerToDb(t, userId)));
        }
        if (data.entries?.length > 0) {
            await supabase
                .from('entries')
                .insert(data.entries.map((e: Entry) => entryToDb(e, userId)));
        }
        if (data.protocols?.length > 0) {
            await supabase
                .from('protocols')
                .insert(data.protocols.map((p: Protocol) => protocolToDb(p, userId)));
        }
        if (data.cycles?.length > 0) {
            await supabase
                .from('cycles')
                .insert(data.cycles.map((c: Cycle) => cycleToDb(c, userId)));
        }
        if (data.doses?.length > 0) {
            await supabase.from('doses').insert(data.doses.map((d: Dose) => doseToDb(d, userId)));
        }
        if (data.experiments?.length > 0) {
            await supabase
                .from('experiments')
                .insert(data.experiments.map((e: Experiment) => experimentToDb(e, userId)));
        }
        if (data.logs?.length > 0) {
            await supabase
                .from('experiment_logs')
                .insert(data.logs.map((l: ExperimentLog) => experimentLogToDb(l, userId)));
        }
        if (data.strategies?.length > 0) {
            await supabase
                .from('strategies')
                .insert(data.strategies.map((s: Strategy) => strategyToDb(s, userId)));
        }
        if (data.todos?.length > 0) {
            await supabase.from('todos').insert(data.todos.map((t: Task) => todoToDb(t, userId)));
        }

        return true;
    } catch (e) {
        console.error('Import failed:', e);
        return false;
    }
}
