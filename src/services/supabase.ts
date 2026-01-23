import { createClient } from '@supabase/supabase-js';
import type { TrackerDefinition, Entry, Protocol, Cycle, Dose, Experiment, CorrelationResult, Strategy, Task, NoteCategory, SmartNote } from '../types';

// Supabase client initialization
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('Supabase URL configured:', !!supabaseUrl);
console.log('Supabase Key configured:', !!supabaseAnonKey);

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

// Database types matching Supabase schema (snake_case)
export interface DbTracker {
    id: string;
    user_id: string;
    name: string;
    emoji: string | null;
    type: string;
    unit: string | null;
    group: string | null;
    goal: { target: number; condition: 'gt' | 'lt' | 'eq' } | null;
    checkin_config: { isRequired: boolean; inCheckin: boolean } | null;
    created_at: string;
}

export interface DbEntry {
    id: string;
    user_id: string;
    tracker_id: string;
    value: number | null;
    text_value: string | null;
    timestamp: string;
    notes: string | null;
    metadata: Record<string, unknown> | null;
}

export interface DbProtocol {
    id: string;
    user_id: string;
    name: string;
    category: string | null;
    dose_amount: number | null;
    dose_unit: string | null;
    frequency: string | null;
    route: string | null;
    timing_notes: string | null;
    half_life_hours: number | null;
    active: boolean;
    expected_outcomes: Array<{
        id: string;
        outcomeType: 'primary' | 'secondary';
        description: string;
        targetMetric?: string;
        targetValue?: number;
        expectedOnset?: string;
    }> | null;
    linked_tracker_id: string | null;
    default_tracker_type: string | null;
    effect_timing: string | null;
    created_at: string;
}

export interface DbCycle {
    id: string;
    user_id: string;
    protocol_id: string;
    cycle_number: number | null;
    start_date: string;
    planned_end_date: string | null;
    actual_end_date: string | null;
    off_cycle_days: number | null;
    status: string | null;
    notes: string | null;
}

export interface DbDose {
    id: string;
    user_id: string;
    protocol_id: string;
    cycle_id: string | null;
    scheduled_at: string | null;
    taken_at: string | null;
    actual_amount: number | null;
    skipped: boolean;
    skip_reason: string | null;
}

export interface DbExperiment {
    id: string;
    user_id: string;
    name: string;
    description: string | null;

    tracker1_id: string | null; // deprecated in favor of independent_ids but keeping for backward compat
    independent_ids: string[] | null;
    tracker2_id: string | null;
    start_date: string | null;
    end_date: string | null;
    active: boolean;
    frequency: string | null;
}

export interface DbCorrelation {
    id: string;
    user_id: string;
    input_tracker_id: string | null;
    output_tracker_id: string | null;
    correlation: number | null;
    p_value: number | null;
    optimal_lag_hours: number | null;
    sample_size: number | null;
    confidence_low: number | null;
    confidence_high: number | null;
    calculated_at: string;
}

export interface DbStrategy {
    id: string;
    user_id: string;
    title: string;
    description: string | null;
    category: string | null;
    tags: string[] | null;
    content: string | null;
    findings: Array<{
        id: string;
        date: string;
        note: string;
        rating: number;
    }> | null;
    is_favorite: boolean;
}

export interface DbTodo {
    id: string;
    user_id: string;
    title: string;
    completed: boolean;
    due_date: string | null;
    created_at: string;
    priority: string | null;
    estimated_time: number | null;
    subtasks: Array<{ id: string; title: string; completed: boolean }> | null;
}

export interface DbExperimentLog {
    id: string;
    user_id: string;
    experiment_id: string;
    date: string;
    content: string;
    mood_rating: number | null;
    created_at: string;
}

export interface DbNoteCategory {
    id: string;
    user_id: string;
    name: string;
    flag: string;
    emoji: string | null;
    color: string | null;
    created_at: string;
}

export interface DbSmartNote {
    id: string;
    user_id: string;
    content: string;
    category_id: string | null;
    flag: string | null;
    processed: boolean;
    created_at: string;
    updated_at: string | null;
}

// Conversion functions: DB (snake_case) <-> App (camelCase)

export function dbToTracker(db: DbTracker): TrackerDefinition {
    return {
        id: db.id,
        name: db.name,
        emoji: db.emoji || '',
        type: db.type as TrackerDefinition['type'],
        unit: db.unit || undefined,
        group: db.group || undefined,
        goal: db.goal || undefined,
        checkinConfig: db.checkin_config || undefined,
    };
}

export function trackerToDb(tracker: TrackerDefinition, userId: string): Omit<DbTracker, 'created_at'> {
    return {
        id: tracker.id,
        user_id: userId,
        name: tracker.name,
        emoji: tracker.emoji || null,
        type: tracker.type,
        unit: tracker.unit || null,
        group: tracker.group || null,
        goal: tracker.goal || null,
        checkin_config: tracker.checkinConfig || null,
    };
}

export function dbToEntry(db: DbEntry): Entry {
    return {
        id: db.id,
        trackerId: db.tracker_id,
        value: db.value ?? 0,
        textValue: db.text_value || undefined,
        timestamp: db.timestamp,
        notes: db.notes || undefined,
        metadata: db.metadata || undefined,
    };
}

export function entryToDb(entry: Omit<Entry, 'id'> & { id?: string }, userId: string): Omit<DbEntry, 'id'> & { id?: string } {
    return {
        id: entry.id,
        user_id: userId,
        tracker_id: entry.trackerId,
        value: entry.value,
        text_value: entry.textValue || null,
        timestamp: entry.timestamp,
        notes: entry.notes || null,
        metadata: entry.metadata || null,
    };
}

export function dbToProtocol(db: DbProtocol): Protocol {
    return {
        id: db.id,
        name: db.name,
        category: (db.category as Protocol['category']) || 'other',
        doseAmount: db.dose_amount ?? undefined,
        doseUnit: db.dose_unit || undefined,
        frequency: db.frequency || '',
        route: db.route || undefined,
        timingNotes: db.timing_notes || undefined,
        halfLifeHours: db.half_life_hours || undefined,
        active: db.active,
        expectedOutcomes: db.expected_outcomes || undefined,
        linkedTrackerId: db.linked_tracker_id || undefined,
        defaultTrackerType: db.default_tracker_type as Protocol['defaultTrackerType'],
        effectTiming: db.effect_timing as Protocol['effectTiming'],
        createdAt: db.created_at,
    };
}

export function protocolToDb(protocol: Omit<Protocol, 'id' | 'createdAt'> & { id?: string }, userId: string): Omit<DbProtocol, 'id' | 'created_at'> & { id?: string } {
    return {
        id: protocol.id,
        user_id: userId,
        name: protocol.name,
        category: protocol.category,
        dose_amount: protocol.doseAmount || null,
        dose_unit: protocol.doseUnit || null,
        frequency: protocol.frequency,
        route: protocol.route || null,
        timing_notes: protocol.timingNotes || null,
        half_life_hours: protocol.halfLifeHours || null,
        active: protocol.active,
        expected_outcomes: protocol.expectedOutcomes || null,
        linked_tracker_id: protocol.linkedTrackerId || null,
        default_tracker_type: protocol.defaultTrackerType || null,
        effect_timing: protocol.effectTiming || null,
    };
}

export function dbToCycle(db: DbCycle): Cycle {
    return {
        id: db.id,
        protocolId: db.protocol_id,
        cycleNumber: db.cycle_number ?? 1,
        startDate: db.start_date,
        plannedEndDate: db.planned_end_date || undefined,
        actualEndDate: db.actual_end_date || undefined,
        offCycleDays: db.off_cycle_days || undefined,
        status: (db.status as Cycle['status']) || 'active',
        notes: db.notes || undefined,
    };
}

export function cycleToDb(cycle: Omit<Cycle, 'id'> & { id?: string }, userId: string): Omit<DbCycle, 'id'> & { id?: string } {
    return {
        id: cycle.id,
        user_id: userId,
        protocol_id: cycle.protocolId,
        cycle_number: cycle.cycleNumber,
        start_date: cycle.startDate,
        planned_end_date: cycle.plannedEndDate || null,
        actual_end_date: cycle.actualEndDate || null,
        off_cycle_days: cycle.offCycleDays || null,
        status: cycle.status,
        notes: cycle.notes || null,
    };
}

export function dbToDose(db: DbDose): Dose {
    return {
        id: db.id,
        protocolId: db.protocol_id,
        cycleId: db.cycle_id || undefined,
        scheduledAt: db.scheduled_at || undefined,
        takenAt: db.taken_at || undefined,
        actualAmount: db.actual_amount || undefined,
        skipped: db.skipped,
        skipReason: db.skip_reason || undefined,
    };
}

export function doseToDb(dose: Omit<Dose, 'id'> & { id?: string }, userId: string): Omit<DbDose, 'id'> & { id?: string } {
    return {
        id: dose.id,
        user_id: userId,
        protocol_id: dose.protocolId,
        cycle_id: dose.cycleId || null,
        scheduled_at: dose.scheduledAt || null,
        taken_at: dose.takenAt || null,
        actual_amount: dose.actualAmount || null,
        skipped: dose.skipped,
        skip_reason: dose.skipReason || null,
    };
}

export function dbToExperiment(db: DbExperiment): Experiment {
    return {
        id: db.id,
        name: db.name,
        description: db.description || undefined,

        tracker1Id: db.tracker1_id || '', // Maintain for backward compat
        independentIds: db.independent_ids || (db.tracker1_id ? [db.tracker1_id] : []),
        tracker2Id: db.tracker2_id || '',
        startDate: db.start_date || '',
        endDate: db.end_date || undefined,
        active: db.active,
        frequency: db.frequency as Experiment['frequency'],
    };
}

export function experimentToDb(exp: Omit<Experiment, 'id' | 'active'> & { id?: string; active?: boolean }, userId: string): Omit<DbExperiment, 'id'> & { id?: string } {
    return {
        id: exp.id,
        user_id: userId,
        name: exp.name,
        description: exp.description || null,

        tracker1_id: null, // Stop populating to avoid FK violation (protocols have no tracker ID)
        independent_ids: exp.independentIds || (exp.tracker1Id ? [exp.tracker1Id] : null),
        tracker2_id: exp.tracker2Id || null,
        start_date: exp.startDate || null,
        end_date: exp.endDate || null,
        active: exp.active ?? true,
        frequency: exp.frequency || null,
    };
}

export function dbToExperimentLog(db: DbExperimentLog): import('../types').ExperimentLog {
    return {
        id: db.id,
        experimentId: db.experiment_id,
        date: db.date,
        content: db.content,
        moodRating: db.mood_rating || undefined,
        createdAt: db.created_at,
    };
}

export function experimentLogToDb(log: Omit<import('../types').ExperimentLog, 'id'> & { id?: string }, userId: string): Omit<DbExperimentLog, 'id'> & { id?: string } {
    return {
        id: log.id,
        user_id: userId,
        experiment_id: log.experimentId,
        date: log.date,
        content: log.content,
        mood_rating: log.moodRating || null,
        created_at: log.createdAt,
    };
}

export function dbToCorrelation(db: DbCorrelation): CorrelationResult {
    return {
        id: db.id,
        inputTrackerId: db.input_tracker_id || '',
        outputTrackerId: db.output_tracker_id || '',
        correlation: db.correlation ?? 0,
        pValue: db.p_value || undefined,
        optimalLagHours: db.optimal_lag_hours ?? 0,
        sampleSize: db.sample_size ?? 0,
        confidenceLow: db.confidence_low || undefined,
        confidenceHigh: db.confidence_high || undefined,
        calculatedAt: db.calculated_at,
    };
}

export function dbToStrategy(db: DbStrategy): Strategy {
    return {
        id: db.id,
        title: db.title,
        description: db.description || '',
        category: db.category || '',
        tags: db.tags || [],
        content: db.content || undefined,
        findings: db.findings || [],
        isFavorite: db.is_favorite,
    };
}

export function strategyToDb(strategy: Omit<Strategy, 'id'> & { id?: string }, userId: string): Omit<DbStrategy, 'id'> & { id?: string } {
    return {
        id: strategy.id,
        user_id: userId,
        title: strategy.title,
        description: strategy.description || null,
        category: strategy.category || null,
        tags: strategy.tags || null,
        content: strategy.content || null,
        findings: strategy.findings || null,
        is_favorite: strategy.isFavorite || false,
    };
}

export async function getExperimentLogs(experimentId: string): Promise<import('../types').ExperimentLog[]> {
    const { data, error } = await supabase
        .from('experiment_logs')
        .select('*')
        .eq('experiment_id', experimentId)
        .order('date', { ascending: false });

    if (error) throw error;
    return (data as DbExperimentLog[]).map(dbToExperimentLog);
}

export async function addExperimentLog(log: Omit<import('../types').ExperimentLog, 'id' | 'createdAt'>): Promise<import('../types').ExperimentLog> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const dbLog = {
        user_id: user.id,
        experiment_id: log.experimentId,
        date: log.date,
        content: log.content,
        mood_rating: log.moodRating || null,
        created_at: new Date().toISOString(), // DB default is now(), but we can send it or let DB handle. 
        // Note: DB conversion `experimentLogToDb` expects `id` and `created_at` usually. 
        // Let's rely on supabase returning the row.
    };

    const { data, error } = await supabase
        .from('experiment_logs')
        .insert(dbLog)
        .select()
        .single();

    if (error) throw error;
    return dbToExperimentLog(data as DbExperimentLog);
}

export function dbToTodo(db: DbTodo): Task {
    return {
        id: db.id,
        title: db.title,
        completed: db.completed,
        dueDate: db.due_date || undefined,
        createdAt: db.created_at,
        priority: db.priority as Task['priority'],
        estimatedTime: db.estimated_time || undefined,
        subtasks: db.subtasks || [],
    };
}

export function todoToDb(todo: Omit<Task, 'id'> & { id?: string }, userId: string): Omit<DbTodo, 'id' | 'created_at'> & { id?: string; created_at?: string } {
    return {
        id: todo.id,
        user_id: userId,
        title: todo.title,
        completed: todo.completed,
        due_date: todo.dueDate || null,
        created_at: todo.createdAt,
        priority: todo.priority || null,
        estimated_time: todo.estimatedTime || null,
        subtasks: todo.subtasks || null,
    };
}

// Smart Notes conversion functions

export function dbToNoteCategory(db: DbNoteCategory): NoteCategory {
    return {
        id: db.id,
        name: db.name,
        flag: db.flag,
        emoji: db.emoji || undefined,
        color: db.color || undefined,
        createdAt: db.created_at,
    };
}

export function dbToSmartNote(db: DbSmartNote): SmartNote {
    return {
        id: db.id,
        content: db.content,
        categoryId: db.category_id || undefined,
        flag: db.flag || undefined,
        processed: db.processed,
        createdAt: db.created_at,
        updatedAt: db.updated_at || undefined,
    };
}

export function smartNoteToDb(note: Omit<SmartNote, 'id' | 'createdAt'> & { id?: string }, userId: string): Omit<DbSmartNote, 'id' | 'created_at'> & { id?: string } {
    return {
        id: note.id,
        user_id: userId,
        content: note.content,
        category_id: note.categoryId || null,
        flag: note.flag || null,
        processed: note.processed,
        updated_at: note.updatedAt || null,
    };
}

// Default trackers to seed on first run
const DEFAULT_TRACKERS: Omit<TrackerDefinition, 'id'>[] = [
    // Health - Sleep
    { name: 'Sleep Hours', emoji: '🌙', type: 'number', unit: 'hrs', group: 'Health', checkinConfig: { isRequired: true, inCheckin: true } },
    { name: 'Sleep Quality', emoji: '💤', type: 'rating', group: 'Health', checkinConfig: { isRequired: true, inCheckin: true } },
    // Health - Physical
    { name: 'Training', emoji: '🏋️', type: 'text', group: 'Health', checkinConfig: { isRequired: false, inCheckin: true } },
    { name: 'Steps', emoji: '👟', type: 'number', unit: 'steps', group: 'Health', checkinConfig: { isRequired: false, inCheckin: true } },
    // Health - Body
    { name: 'Nose Blocked', emoji: '👃', type: 'rating', group: 'Health', checkinConfig: { isRequired: false, inCheckin: true } },
    { name: 'Asthma', emoji: '🌬️', type: 'rating', group: 'Health', checkinConfig: { isRequired: false, inCheckin: true } },
    { name: 'Hunger', emoji: '🍽️', type: 'rating', group: 'Health', checkinConfig: { isRequired: false, inCheckin: true } },
    // Mental
    { name: 'Mood', emoji: '😊', type: 'rating', group: 'Mental', checkinConfig: { isRequired: true, inCheckin: true } },
    { name: 'Energy', emoji: '⚡', type: 'rating', group: 'Mental', checkinConfig: { isRequired: true, inCheckin: true } },
    { name: 'Mental Clarity', emoji: '🧠', type: 'rating', group: 'Mental', checkinConfig: { isRequired: false, inCheckin: true } },
    { name: 'Stress', emoji: '😰', type: 'rating', group: 'Mental', checkinConfig: { isRequired: false, inCheckin: true } },
    // Diet
    { name: 'Caffeine', emoji: '☕', type: 'number', unit: 'mg', group: 'Diet', checkinConfig: { isRequired: false, inCheckin: true } },
    // Journal
    { name: 'Daily Notes', emoji: '📓', type: 'text', group: 'Journal', checkinConfig: { isRequired: false, inCheckin: true } },
];

// Initialize database with default trackers if empty
export async function initializeUserData(userId: string): Promise<void> {
    try {
        const { data: existingTrackers, error } = await supabase
            .from('trackers')
            .select('id')
            .eq('user_id', userId)
            .limit(1);

        if (error) {
            // Silently ignore AbortErrors (caused by React strict mode or component unmount)
            if (error.name === 'AbortError' || error.message?.includes('aborted')) {
                return;
            }
            console.error('Error checking for existing trackers:', error);
            return;
        }

        if (!existingTrackers || existingTrackers.length === 0) {
            console.log('Seeding default trackers for new user...');
            const trackersToInsert = DEFAULT_TRACKERS.map(t => ({
                id: crypto.randomUUID(),
                user_id: userId,
                name: t.name,
                emoji: t.emoji,
                type: t.type,
                unit: t.unit || null,
                group: t.group || null,
                checkin_config: t.checkinConfig || null,
                goal: null,
            }));

            const { error: insertError } = await supabase
                .from('trackers')
                .insert(trackersToInsert);

            if (insertError) {
                // Silently ignore AbortErrors
                if (insertError.name === 'AbortError' || insertError.message?.includes('aborted')) {
                    return;
                }
                console.error('Error seeding default trackers:', insertError);
            } else {
                console.log('Default trackers seeded successfully');
            }
        }
    } catch (err: any) {
        // Silently ignore AbortErrors
        if (err?.name === 'AbortError' || err?.message?.includes('aborted')) {
            return;
        }
        console.error('Error initializing user data:', err);
    }
}

// Export all data as JSON for backup
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

    return JSON.stringify({
        version: 3,
        exportedAt: new Date().toISOString(),
        trackers: trackers?.map(dbToTracker) || [],
        entries: entries?.map(dbToEntry) || [],
        protocols: protocols?.map(dbToProtocol) || [],
        cycles: cycles?.map(dbToCycle) || [],
        doses: doses?.map(dbToDose) || [],
        experiments: experiments?.map(dbToExperiment) || [],
        logs: logs?.map(dbToExperimentLog) || [],
        correlations: correlations?.map(dbToCorrelation) || [],
        strategies: strategies?.map(dbToStrategy) || [],
        todos: todos?.map(dbToTodo) || [],
    }, null, 2);
}

// Import data from JSON backup
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
            await supabase.from('trackers').insert(
                data.trackers.map((t: TrackerDefinition) => trackerToDb(t, userId))
            );
        }
        if (data.entries?.length > 0) {
            await supabase.from('entries').insert(
                data.entries.map((e: Entry) => entryToDb(e, userId))
            );
        }
        if (data.protocols?.length > 0) {
            await supabase.from('protocols').insert(
                data.protocols.map((p: Protocol) => protocolToDb(p, userId))
            );
        }
        if (data.cycles?.length > 0) {
            await supabase.from('cycles').insert(
                data.cycles.map((c: Cycle) => cycleToDb(c, userId))
            );
        }
        if (data.doses?.length > 0) {
            await supabase.from('doses').insert(
                data.doses.map((d: Dose) => doseToDb(d, userId))
            );
        }
        if (data.experiments?.length > 0) {
            await supabase.from('experiments').insert(
                data.experiments.map((e: Experiment) => experimentToDb(e, userId))
            );
        }
        if (data.logs?.length > 0) {
            await supabase.from('experiment_logs').insert(
                data.logs.map((l: import('../types').ExperimentLog) => experimentLogToDb(l, userId))
            );
        }
        if (data.strategies?.length > 0) {
            await supabase.from('strategies').insert(
                data.strategies.map((s: Strategy) => strategyToDb(s, userId))
            );
        }
        if (data.todos?.length > 0) {
            await supabase.from('todos').insert(
                data.todos.map((t: Task) => todoToDb(t, userId))
            );
        }

        return true;
    } catch (e) {
        console.error('Import failed:', e);
        return false;
    }
}

// Settings helpers
export async function getSetting(userId: string, key: string): Promise<string | undefined> {
    const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('user_id', userId)
        .eq('key', key)
        .single();

    return data?.value;
}

export async function setSetting(userId: string, key: string, value: string): Promise<void> {
    const { error } = await supabase
        .from('settings')
        .upsert({ user_id: userId, key, value }, { onConflict: 'user_id,key' });

    if (error) {
        console.error('Error setting value:', error);
    }
}
