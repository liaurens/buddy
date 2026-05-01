export interface DbGoal {
    id: string;
    user_id: string;
    title: string;
    description: string | null;
    target_date: string | null;
    status: string;
    progress: number;
    category: string | null;
    goal_type: string;
    target_minutes: number | null;
    streak_count: number;
    last_completed_at: string | null;
    project_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface DbGoalLog {
    id: string;
    goal_id: string;
    user_id: string;
    date: string;
    completed: boolean;
    minutes_spent: number | null;
    progress_delta: number | null;
    notes: string | null;
    created_at: string;
}
