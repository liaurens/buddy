/**
 * Experiment, ExperimentLog, Correlation, CheckinEntry, and Journal Converters
 */

import type {
    Experiment, ExperimentLog, CorrelationResult,
    ExperimentCheckinEntry, ExperimentPhase, ExperimentMetric,
    ExperimentStatus, DailyJournalEntry, JournalPromptResponse,
} from '../../../features/health-tracking/types';
import type {
    DbExperiment, DbExperimentLog, DbCorrelation,
    DbExperimentCheckinEntry, DbDailyJournalEntry,
} from '../types';

export function dbToExperiment(db: DbExperiment): Experiment {
    const status = (db.status || (db.active ? 'active' : 'archived')) as ExperimentStatus;
    return {
        id: db.id,
        name: db.name,
        description: db.description || undefined,
        hypothesis: db.hypothesis || undefined,
        tracker1Id: db.tracker1_id || '',
        independentIds: db.independent_ids || (db.tracker1_id ? [db.tracker1_id] : []),
        tracker2Id: db.tracker2_id || '',
        startDate: db.start_date || '',
        endDate: db.end_date || undefined,
        active: status === 'active',
        status,
        phases: (db.phases || []) as ExperimentPhase[],
        customMetrics: (db.custom_metrics || []) as ExperimentMetric[],
        checkinSchedule: (db.checkin_schedule || 'daily') as Experiment['checkinSchedule'],
        tags: db.tags || [],
        frequency: db.frequency as Experiment['frequency'],
    };
}

export function experimentToDb(
    exp: Omit<Experiment, 'id' | 'active'> & { id?: string; active?: boolean },
    userId: string
): Omit<DbExperiment, 'id'> & { id?: string } {
    return {
        id: exp.id,
        user_id: userId,
        name: exp.name,
        description: exp.description || null,
        hypothesis: exp.hypothesis || null,
        tracker1_id: null,
        independent_ids: exp.independentIds || (exp.tracker1Id ? [exp.tracker1Id] : null),
        tracker2_id: exp.tracker2Id || null,
        start_date: exp.startDate || null,
        end_date: exp.endDate || null,
        active: exp.status ? exp.status === 'active' : (exp.active ?? true),
        status: exp.status || 'active',
        phases: exp.phases || [],
        custom_metrics: exp.customMetrics || [],
        checkin_schedule: exp.checkinSchedule || 'daily',
        tags: exp.tags || [],
        frequency: exp.frequency || null,
    };
}

export function dbToExperimentLog(db: DbExperimentLog): ExperimentLog {
    return {
        id: db.id,
        experimentId: db.experiment_id,
        date: db.date,
        content: db.content,
        moodRating: db.mood_rating || undefined,
        createdAt: db.created_at,
    };
}

export function experimentLogToDb(log: Omit<ExperimentLog, 'id'> & { id?: string }, userId: string): Omit<DbExperimentLog, 'id'> & { id?: string } {
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

export function dbToExperimentCheckinEntry(db: DbExperimentCheckinEntry): ExperimentCheckinEntry {
    return {
        id: db.id,
        experimentId: db.experiment_id,
        phaseId: db.phase_id || undefined,
        date: db.date,
        metricId: db.metric_id,
        value: db.value ?? undefined,
        textValue: db.text_value || undefined,
        createdAt: db.created_at,
    };
}

export function dbToDailyJournalEntry(db: DbDailyJournalEntry): DailyJournalEntry {
    return {
        id: db.id,
        date: db.date,
        prompts: (db.prompts || []) as JournalPromptResponse[],
        moodRating: db.mood_rating ?? undefined,
        energyRating: db.energy_rating ?? undefined,
        wins: (db.wins || []) as string[],
        createdAt: db.created_at,
        updatedAt: db.updated_at,
    };
}
