/**
 * Experiment, ExperimentLog, and Correlation Converters
 */

import type { Experiment, ExperimentLog, CorrelationResult } from '../../../types';
import type { DbExperiment, DbExperimentLog, DbCorrelation } from '../types';

export function dbToExperiment(db: DbExperiment): Experiment {
    return {
        id: db.id,
        name: db.name,
        description: db.description || undefined,
        tracker1Id: db.tracker1_id || '',
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
        tracker1_id: null,
        independent_ids: exp.independentIds || (exp.tracker1Id ? [exp.tracker1Id] : null),
        tracker2_id: exp.tracker2Id || null,
        start_date: exp.startDate || null,
        end_date: exp.endDate || null,
        active: exp.active ?? true,
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
