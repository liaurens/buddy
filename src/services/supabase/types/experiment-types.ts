/**
 * Database types for Experiments and Correlations
 */

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

export interface DbExperimentLog {
    id: string;
    user_id: string;
    experiment_id: string;
    date: string;
    content: string;
    mood_rating: number | null;
    created_at: string;
}
