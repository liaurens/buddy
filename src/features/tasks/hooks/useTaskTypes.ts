import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../../../hooks/useAuth';
import type { TaskType } from '../types';
import { supabase, dbToTaskType, type DbTaskType } from '../../../services/supabase';

// Default task types seeded on first use
const DEFAULT_TASK_TYPES: Array<Omit<TaskType, 'id' | 'createdAt'>> = [
    { name: 'Email', emoji: '📧', color: 'indigo', sortOrder: 0, isPreset: true },
    { name: 'Home', emoji: '🧹', color: 'emerald', sortOrder: 1, isPreset: true },
    { name: 'Study', emoji: '📚', color: 'violet', sortOrder: 2, isPreset: true },
    { name: 'Errands', emoji: '🛒', color: 'amber', sortOrder: 3, isPreset: true },
    { name: 'Admin', emoji: '📋', color: 'slate', sortOrder: 4, isPreset: true },
    { name: 'Health', emoji: '💪', color: 'rose', sortOrder: 5, isPreset: true },
    { name: 'Work', emoji: '💼', color: 'sky', sortOrder: 6, isPreset: true },
];

export interface TaskTypesState {
    taskTypes: TaskType[];
    isLoading: boolean;
    addTaskType: (
        t: Omit<TaskType, 'id' | 'createdAt' | 'sortOrder' | 'isPreset'> & { sortOrder?: number },
    ) => Promise<TaskType>;
    updateTaskType: (t: TaskType) => Promise<void>;
    deleteTaskType: (id: string) => Promise<void>;
    reorderTaskTypes: (ordered: string[]) => Promise<void>;
}

export const useTaskTypes = (): TaskTypesState => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const userId = user?.id;

    const { data: taskTypes = [], isLoading } = useQuery({
        queryKey: ['task_types', userId],
        queryFn: async () => {
            if (!userId) return [];
            const { data, error } = await supabase
                .from('task_types')
                .select('*')
                .eq('user_id', userId)
                .order('sort_order', { ascending: true });

            if (error) throw error;

            if (data.length === 0) {
                const seedRows = DEFAULT_TASK_TYPES.map((t) => ({
                    id: uuidv4(),
                    user_id: userId,
                    name: t.name,
                    emoji: t.emoji || null,
                    color: t.color || null,
                    sort_order: t.sortOrder,
                    is_preset: t.isPreset,
                    home_days: t.homeDays || null,
                }));
                const { data: seeded, error: seedError } = await supabase
                    .from('task_types')
                    .insert(seedRows)
                    .select();
                if (seedError) {
                    console.error('Error seeding task types:', seedError);
                    return [];
                }
                return (seeded as DbTaskType[]).map(dbToTaskType);
            }

            return (data as DbTaskType[]).map(dbToTaskType);
        },
        enabled: !!userId,
    });

    const addTaskType = useCallback(
        async (
            t: Omit<TaskType, 'id' | 'createdAt' | 'sortOrder' | 'isPreset'> & {
                sortOrder?: number;
            },
        ) => {
            if (!userId) throw new Error('Not authenticated');

            const maxSort = taskTypes.reduce((m, x) => Math.max(m, x.sortOrder), -1);
            const row = {
                id: uuidv4(),
                user_id: userId,
                name: t.name,
                emoji: t.emoji || null,
                color: t.color || null,
                sort_order: t.sortOrder ?? maxSort + 1,
                is_preset: false,
                home_days: t.homeDays || null,
            };
            const { data, error } = await supabase.from('task_types').insert(row).select().single();
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['task_types', userId] });
            return dbToTaskType(data as DbTaskType);
        },
        [userId, taskTypes, queryClient],
    );

    const updateTaskType = useCallback(
        async (t: TaskType) => {
            if (!userId) throw new Error('Not authenticated');
            const { error } = await supabase
                .from('task_types')
                .update({
                    name: t.name,
                    emoji: t.emoji || null,
                    color: t.color || null,
                    sort_order: t.sortOrder,
                    home_days: t.homeDays || null,
                })
                .eq('id', t.id)
                .eq('user_id', userId);
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['task_types', userId] });
        },
        [userId, queryClient],
    );

    const deleteTaskType = useCallback(
        async (id: string) => {
            if (!userId) throw new Error('Not authenticated');
            // Tasks with this type get task_type_id = NULL via FK ON DELETE SET NULL
            const { error } = await supabase
                .from('task_types')
                .delete()
                .eq('id', id)
                .eq('user_id', userId);
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['task_types', userId] });
            queryClient.invalidateQueries({ queryKey: ['todos', userId] });
        },
        [userId, queryClient],
    );

    const reorderTaskTypes = useCallback(
        async (ordered: string[]) => {
            if (!userId) throw new Error('Not authenticated');
            const updates = ordered.map((id, idx) =>
                supabase
                    .from('task_types')
                    .update({ sort_order: idx })
                    .eq('id', id)
                    .eq('user_id', userId),
            );
            await Promise.all(updates);
            queryClient.invalidateQueries({ queryKey: ['task_types', userId] });
        },
        [userId, queryClient],
    );

    return { taskTypes, isLoading, addTaskType, updateTaskType, deleteTaskType, reorderTaskTypes };
};
