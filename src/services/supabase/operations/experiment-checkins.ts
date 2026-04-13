/**
 * Experiment Check-in Entry Operations
 */

import type { ExperimentCheckinEntry } from '../../../types';
import type { DbExperimentCheckinEntry } from '../types';
import { supabase } from '../client';
import { dbToExperimentCheckinEntry } from '../converters/experiment';

export async function getExperimentCheckins(
    experimentId: string,
    dateRange?: { from: string; to: string }
): Promise<ExperimentCheckinEntry[]> {
    let query = supabase
        .from('experiment_checkin_entries')
        .select('*')
        .eq('experiment_id', experimentId)
        .order('date', { ascending: false });

    if (dateRange) {
        query = query.gte('date', dateRange.from).lte('date', dateRange.to);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data as DbExperimentCheckinEntry[]).map(dbToExperimentCheckinEntry);
}

export async function saveExperimentCheckin(
    experimentId: string,
    date: string,
    entries: { metricId: string; value?: number; textValue?: string; phaseId?: string }[]
): Promise<ExperimentCheckinEntry[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const rows = entries.map(e => ({
        user_id: user.id,
        experiment_id: experimentId,
        phase_id: e.phaseId || null,
        date,
        metric_id: e.metricId,
        value: e.value ?? null,
        text_value: e.textValue || null,
    }));

    const { data, error } = await supabase
        .from('experiment_checkin_entries')
        .upsert(rows, { onConflict: 'experiment_id,date,metric_id' })
        .select();

    if (error) throw error;
    return (data as DbExperimentCheckinEntry[]).map(dbToExperimentCheckinEntry);
}

export async function deleteExperimentCheckin(id: string): Promise<void> {
    const { error } = await supabase
        .from('experiment_checkin_entries')
        .delete()
        .eq('id', id);

    if (error) throw error;
}
