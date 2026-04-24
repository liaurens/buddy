import type { DbGoal, DbGoalLog } from '../types/goal-types';

export type GoalType = 'time' | 'action' | 'progress' | 'habit';

export interface Goal {
    id: string;
    userId: string;
    title: string;
    description: string | null;
    targetDate: string | null;
    status: 'active' | 'completed' | 'paused' | 'abandoned';
    progress: number;
    category: string | null;
    goalType: GoalType;
    targetMinutes: number | null;
    streakCount: number;
    lastCompletedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface GoalLog {
    id: string;
    goalId: string;
    userId: string;
    date: string;
    completed: boolean;
    minutesSpent: number | null;
    progressDelta: number | null;
    notes: string | null;
    createdAt: string;
}

export function dbToGoal(db: DbGoal): Goal {
    return {
        id: db.id,
        userId: db.user_id,
        title: db.title,
        description: db.description,
        targetDate: db.target_date,
        status: db.status as Goal['status'],
        progress: db.progress,
        category: db.category,
        goalType: (db.goal_type as GoalType) ?? 'progress',
        targetMinutes: db.target_minutes,
        streakCount: db.streak_count ?? 0,
        lastCompletedAt: db.last_completed_at,
        createdAt: db.created_at,
        updatedAt: db.updated_at,
    };
}

export function goalToDb(goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>, userId: string): Omit<DbGoal, 'id' | 'created_at' | 'updated_at'> {
    return {
        user_id: userId,
        title: goal.title,
        description: goal.description,
        target_date: goal.targetDate,
        status: goal.status,
        progress: goal.progress,
        category: goal.category,
        goal_type: goal.goalType,
        target_minutes: goal.targetMinutes,
        streak_count: goal.streakCount,
        last_completed_at: goal.lastCompletedAt,
    };
}

export function dbToGoalLog(db: DbGoalLog): GoalLog {
    return {
        id: db.id,
        goalId: db.goal_id,
        userId: db.user_id,
        date: db.date,
        completed: db.completed,
        minutesSpent: db.minutes_spent,
        progressDelta: db.progress_delta,
        notes: db.notes,
        createdAt: db.created_at,
    };
}
