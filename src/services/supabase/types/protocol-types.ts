/**
 * Database types for Protocols, Cycles, and Doses
 */

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
