/**
 * Database types for Tasks (Todos), Task Types, and Routines
 */

export type TaskEnergy = 'low' | 'medium' | 'high';
export type TaskContext = 'computer' | 'phone' | 'home' | 'out' | 'anywhere';
export type DbTaskFlag =
    | 'urgent'
    | 'today'
    | 'deadline'
    | 'waiting'
    | 'school'
    | 'routine'
    | 'someday';

export interface DbTodo {
    id: string;
    user_id: string;
    title: string;
    completed: boolean;
    due_date: string | null;
    planned_for?: string | null;
    due_time: string | null;
    location: string | null;
    created_at: string;
    priority: string | null;
    estimated_time: number | null;
    subtasks: Array<{ id: string; title: string; completed: boolean }> | null;
    actual_minutes: number | null;
    started_at: string | null;
    completed_at: string | null;
    recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'weekdays';
    recurrence_config: { daysOfWeek?: number[]; interval?: number } | null;
    reminder_enabled?: boolean;
    reminder_offset_minutes?: number | null;
    reminder_at?: string | null;
    reminder_cadence?: 'single' | 'smart' | 'aggressive' | null;
    last_reminded_at?: string | null;
    task_type_id?: string | null;
    assignment_id?: string | null;
    energy?: TaskEnergy | null;
    context?: TaskContext | null;
    routine_id?: string | null;
    routine_order?: number | null;
    parent_todo_id?: string | null;
    notes?: string | null;
    triaged_at?: string | null;
    hardness?: 'fixed' | 'flexible' | null;
    auto_triaged?: boolean | null;
    google_event_id?: string | null;
    google_calendar_id?: string | null;
    google_synced_at?: string | null;
    snooze_count?: number | null;
    last_touched_at?: string | null;
    waiting_on?: string | null;
    start_date?: string | null;
    /** NOT NULL in the DB since the 2026-08 collapse; optional here for insert payloads. */
    flag?: DbTaskFlag;
    triage_source?: 'explicit' | 'parser' | 'ai' | 'manual' | null;
    triage_confidence?: number | null;
    triage_reason?: string | null;
}

export interface DbTaskType {
    id: string;
    user_id: string;
    name: string;
    emoji: string | null;
    color: string | null;
    sort_order: number;
    is_preset: boolean;
    created_at: string;
    home_days?: number[] | null;
}

export interface DbTaskRoutine {
    id: string;
    user_id: string;
    name: string;
    emoji: string | null;
    description: string | null;
    created_at: string;
}

export interface DbTaskRoutineItem {
    id: string;
    routine_id: string;
    title: string;
    task_type_id: string | null;
    energy: TaskEnergy | null;
    estimated_time: number | null;
    sort_order: number;
}
