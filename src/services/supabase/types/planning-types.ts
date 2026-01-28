/**
 * Database types for Planning System (Daily Plans, Time Blocks, Activities, Calendar Events)
 */

export interface DbDailyPlan {
    id: string;
    user_id: string;
    date: string; // DATE type from database

    // Context at plan generation
    mood_at_plan_time: number | null;
    energy_at_plan_time: number | null;
    sleep_hours_at_plan_time: number | null;

    // AI metadata
    ai_prompt_used: string | null;
    ai_model_used: string | null;
    ai_reasoning: string | null;
    ai_warnings: string[] | null;

    // Lifecycle
    status: string;
    created_at: string;
    updated_at: string | null;
}

export interface DbTimeBlock {
    id: string;
    user_id: string;
    plan_id: string;

    // References
    task_id: string | null;
    activity_template_id: string | null;
    calendar_event_id: string | null;

    // Block details
    title: string;
    description: string | null;
    start_time: string; // TIME type from database
    end_time: string; // TIME type from database

    // Time tracking
    estimated_minutes: number;
    actual_minutes: number | null;

    // Status
    status: string;
    started_at: string | null;
    completed_at: string | null;
    notes: string | null;

    // Ordering
    sort_order: number;
    created_at: string;
    updated_at: string | null;
}

export interface DbActivityTemplate {
    id: string;
    user_id: string;

    // Template details
    name: string;
    emoji: string | null;
    description: string | null;
    category: string;

    // Duration estimates
    default_minutes: number;
    historical_minutes: number[] | null;
    average_minutes: number | null;

    // Scheduling preferences
    frequency: string | null;
    preferred_time_slot: string | null;
    preferred_start_time: string | null; // TIME type from database

    // Status
    is_active: boolean;
    created_at: string;
    updated_at: string | null;
}

export interface DbCalendarEvent {
    id: string;
    user_id: string;

    // Event details
    title: string;
    description: string | null;
    location: string | null;

    // Timing
    start_time: string; // TIMESTAMPTZ from database
    end_time: string; // TIMESTAMPTZ from database
    is_all_day: boolean;

    // Travel
    travel_time_minutes: number | null;
    travel_from_location: string | null;

    // Source tracking
    source: string;
    external_id: string | null;
    calendar_name: string | null;

    // Metadata
    created_at: string;
    synced_at: string | null;
}
