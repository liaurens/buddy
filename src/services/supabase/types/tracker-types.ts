/**
 * Database types for Trackers and Entries
 */

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
