/**
 * Database types for Tasks (Todos)
 */

export interface DbTodo {
    id: string;
    user_id: string;
    title: string;
    completed: boolean;
    due_date: string | null;
    created_at: string;
    priority: string | null;
    estimated_time: number | null;
    subtasks: Array<{ id: string; title: string; completed: boolean }> | null;
    // Time tracking (Phase 1)
    actual_minutes: number | null;
    started_at: string | null;
    completed_at: string | null;
    historical_minutes: number[] | null;
}
