/**
 * Experiment Log Operations
 */

import type { ExperimentLog } from '../../../features/health-tracking/types';
import type { DbExperimentLog } from '../types';
import { supabase } from '../client';
import { dbToExperimentLog } from '../converters/experiment';

export async function getExperimentLogs(experimentId: string): Promise<ExperimentLog[]> {
    const { data, error } = await supabase
        .from('experiment_logs')
        .select('*')
        .eq('experiment_id', experimentId)
        .order('date', { ascending: false });

    if (error) throw error;
    return (data as DbExperimentLog[]).map(dbToExperimentLog);
}

export async function addExperimentLog(
    log: Omit<ExperimentLog, 'id' | 'createdAt'>,
): Promise<ExperimentLog> {
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const dbLog = {
        user_id: user.id,
        experiment_id: log.experimentId,
        date: log.date,
        content: log.content,
        mood_rating: log.moodRating || null,
        created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('experiment_logs').insert(dbLog).select().single();

    if (error) throw error;
    return dbToExperimentLog(data as DbExperimentLog);
}
