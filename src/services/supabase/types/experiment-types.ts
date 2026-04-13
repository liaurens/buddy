/**
 * Database types for Experiments, Correlations, and Check-in Entries
 */

export interface DbExperiment {
    id: string;
    user_id: string;
    name: string;
    description: string | null;
    hypothesis: string | null;
    tracker1_id: string | null; // deprecated in favor of independent_ids
    independent_ids: string[] | null;
    tracker2_id: string | null;
    start_date: string | null;
    end_date: string | null;
    active: boolean;
    status: string;
    phases: unknown[]; // JSONB array of phase objects
    custom_metrics: unknown[]; // JSONB array of metric definitions
    checkin_schedule: string;
    tags: string[];
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

export interface DbExperimentCheckinEntry {
    id: string;
    user_id: string;
    experiment_id: string;
    phase_id: string | null;
    date: string;
    metric_id: string;
    value: number | null;
    text_value: string | null;
    created_at: string;
}

export interface DbDailyJournalEntry {
    id: string;
    user_id: string;
    date: string;
    prompts: unknown[]; // JSONB array of {promptId, question, answer}
    mood_rating: number | null;
    energy_rating: number | null;
    wins: unknown[]; // JSONB array of strings
    created_at: string;
    updated_at: string;
}

export interface DbExperimentAgentConversation {
    id: string;
    user_id: string;
    experiment_id: string | null;
    messages: unknown[]; // JSONB array of {role, content, timestamp}
    created_at: string;
    updated_at: string;
}
