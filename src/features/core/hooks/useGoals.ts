import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useAuth } from '../../../hooks/useAuth';
import { supabase } from '../../../services/supabase';
import { dbToGoal, dbToGoalLog, type Goal, type GoalType, type GoalLog } from '../../../services/supabase/converters/goal';
import type { DbGoal, DbGoalLog } from '../../../services/supabase/types/goal-types';

const EMPTY_ARRAY: any[] = [];

export function useGoals(statusFilter: Goal['status'] | 'all' = 'active', targetDate?: string) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const userId = user?.id;
    const today = targetDate || format(new Date(), 'yyyy-MM-dd');

    const { data: goals = EMPTY_ARRAY as Goal[], isLoading } = useQuery({
        queryKey: ['goals', userId, statusFilter],
        queryFn: async () => {
            if (!userId) return [];
            let q = supabase.from('goals').select('*').eq('user_id', userId).order('created_at', { ascending: false });
            if (statusFilter !== 'all') q = q.eq('status', statusFilter);
            const { data, error } = await q;
            if (error) throw error;
            return (data as DbGoal[]).map(dbToGoal);
        },
        enabled: !!userId,
    });

    const { data: todayLogs = EMPTY_ARRAY as GoalLog[] } = useQuery({
        queryKey: ['goal_logs', userId, today],
        queryFn: async () => {
            if (!userId) return [];
            const { data, error } = await supabase
                .from('goal_logs')
                .select('*')
                .eq('user_id', userId)
                .eq('date', today);
            if (error) throw error;
            return (data as DbGoalLog[]).map(dbToGoalLog);
        },
        enabled: !!userId,
    });

    const addGoal = useCallback(async (params: {
        title: string;
        goalType: GoalType;
        category?: string;
        description?: string;
        targetDate?: string;
        targetMinutes?: number;
        projectId?: string | null;
    }) => {
        if (!userId) throw new Error('Not authenticated');
        const { error } = await supabase.from('goals').insert({
            user_id: userId,
            title: params.title,
            description: params.description ?? null,
            target_date: params.targetDate ?? null,
            status: 'active',
            progress: 0,
            category: params.category ?? null,
            goal_type: params.goalType,
            target_minutes: params.targetMinutes ?? null,
            streak_count: 0,
            last_completed_at: null,
            project_id: params.projectId ?? null,
        });
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['goals', userId] });
    }, [userId, queryClient]);

    const updateGoalProject = useCallback(async (id: string, projectId: string | null) => {
        if (!userId) throw new Error('Not authenticated');
        const { error } = await supabase
            .from('goals')
            .update({ project_id: projectId, updated_at: new Date().toISOString() })
            .eq('id', id).eq('user_id', userId);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['goals', userId] });
    }, [userId, queryClient]);

    const updateGoalProgress = useCallback(async (id: string, progress: number) => {
        if (!userId) throw new Error('Not authenticated');
        const { error } = await supabase
            .from('goals')
            .update({ progress, updated_at: new Date().toISOString() })
            .eq('id', id).eq('user_id', userId);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['goals', userId] });
    }, [userId, queryClient]);

    const updateGoalStatus = useCallback(async (id: string, status: Goal['status']) => {
        if (!userId) throw new Error('Not authenticated');
        const { error } = await supabase
            .from('goals')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', id).eq('user_id', userId);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['goals', userId] });
    }, [userId, queryClient]);

    const logGoalToday = useCallback(async (goalId: string, entry: {
        completed?: boolean;
        minutesSpent?: number;
        progressDelta?: number;
        notes?: string;
    }) => {
        if (!userId) throw new Error('Not authenticated');
        const { error } = await supabase.from('goal_logs').upsert({
            goal_id: goalId,
            user_id: userId,
            date: today,
            completed: entry.completed ?? false,
            minutes_spent: entry.minutesSpent ?? null,
            progress_delta: entry.progressDelta ?? null,
            notes: entry.notes ?? null,
        }, { onConflict: 'goal_id,date' });
        if (error) throw error;

        // For habit goals: update streak + last_completed_at
        const goal = goals.find(g => g.id === goalId);
        if (goal?.goalType === 'habit' && entry.completed) {
            const newStreak = (goal.streakCount ?? 0) + 1;
            await supabase.from('goals').update({
                streak_count: newStreak,
                last_completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }).eq('id', goalId).eq('user_id', userId);
        }

        // For progress goals: bump overall progress
        if (goal?.goalType === 'progress' && entry.progressDelta) {
            const newProgress = Math.min(100, (goal.progress ?? 0) + entry.progressDelta);
            await supabase.from('goals').update({
                progress: newProgress,
                updated_at: new Date().toISOString(),
            }).eq('id', goalId).eq('user_id', userId);
        }

        queryClient.invalidateQueries({ queryKey: ['goal_logs', userId, today] });
        queryClient.invalidateQueries({ queryKey: ['goals', userId] });
    }, [userId, today, goals, queryClient]);

    const deleteGoal = useCallback(async (id: string) => {
        if (!userId) throw new Error('Not authenticated');
        const { error } = await supabase.from('goals').delete().eq('id', id).eq('user_id', userId);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['goals', userId] });
    }, [userId, queryClient]);

    return { goals, todayLogs, isLoading, addGoal, updateGoalProgress, updateGoalStatus, updateGoalProject, logGoalToday, deleteGoal };
}

export type { Goal, GoalLog, GoalType };
