/**
 * Database types for Tasks (Todos), Task Types, and Routines
 */

export type TaskEnergy = 'low' | 'medium' | 'high';
export type TaskContext = 'computer' | 'phone' | 'home' | 'out' | 'anywhere';

export interface DbTodo {
    id: string;
    user_id: string;
    title: string;
    completed: boolean;
    due_date: string | null;
    due_time: string | null;
    location: string | null;
    labels: string[] | null;
    created_at: string;
    priority: string | null;
    estimated_time: number | null;
    subtasks: Array<{ id: string; title: string; completed: boolean }> | null;
    actual_minutes: number | null;
    started_at: string | null;
    completed_at: string | null;
    historical_minutes: number[] | null;
    recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'weekdays';
    recurrence_config: { daysOfWeek?: number[]; interval?: number } | null;
    reminder_enabled?: boolean;
    reminder_offset_minutes?: number | null;
    reminder_at?: string | null;
    reminder_cadence?: 'single' | 'smart' | 'aggressive' | null;
    last_reminded_at?: string | null;
    task_type_id?: string | null;
    energy?: TaskEnergy | null;
    context?: TaskContext | null;
    routine_id?: string | null;
    routine_order?: number | null;
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
