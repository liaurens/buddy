/**
 * Database types for Planning System (Activity Templates, Calendar Events).
 * The AI planner tables (daily_plans, time_blocks) are no longer accessed
 * from the frontend.
 */

export interface DbActivityTemplate {
    id: string;
    user_id: string;

    name: string;
    emoji: string | null;
    description: string | null;
    category: string;

    default_minutes: number;
    historical_minutes: number[] | null;
    average_minutes: number | null;

    frequency: string | null;
    preferred_time_slot: string | null;
    preferred_start_time: string | null;

    is_active: boolean;
    created_at: string;
    updated_at: string | null;
}

export interface DbCalendarEvent {
    id: string;
    user_id: string;

    title: string;
    description: string | null;
    location: string | null;

    start_time: string;
    end_time: string;
    is_all_day: boolean;

    travel_time_minutes: number | null;
    travel_from_location: string | null;

    source: string;
    external_id: string | null;
    calendar_name: string | null;

    created_at: string;
    synced_at: string | null;
}
