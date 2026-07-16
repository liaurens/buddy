import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../../../hooks/useAuth';
import type { Routine, RoutineItem, Task } from '../types';
import {
    supabase,
    dbToRoutine,
    todoToDb,
    type DbTaskRoutine,
    type DbTaskRoutineItem,
} from '../../../services/supabase';

export interface RoutinesState {
    routines: Routine[];
    isLoading: boolean;
    addRoutine: (r: Omit<Routine, 'id' | 'createdAt' | 'items'>) => Promise<Routine>;
    updateRoutine: (r: Omit<Routine, 'items'>) => Promise<void>;
    deleteRoutine: (id: string) => Promise<void>;
    setRoutineItems: (
        routineId: string,
        items: Array<Omit<RoutineItem, 'id' | 'routineId'>>,
    ) => Promise<void>;
    runRoutine: (routineId: string, dueDate?: string) => Promise<number>;
}

export const useRoutines = (): RoutinesState => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const userId = user?.id;

    const { data: routines = [], isLoading } = useQuery({
        queryKey: ['task_routines', userId],
        queryFn: async () => {
            if (!userId) return [];
            const [{ data: rRows, error: rErr }, { data: iRows, error: iErr }] = await Promise.all([
                supabase
                    .from('task_routines')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: true }),
                supabase
                    .from('task_routine_items')
                    .select('*, task_routines!inner(user_id)')
                    .eq('task_routines.user_id', userId)
                    .order('sort_order', { ascending: true }),
            ]);
            if (rErr) throw rErr;
            if (iErr) throw iErr;
            const itemsByRoutine = new Map<string, DbTaskRoutineItem[]>();
            for (const item of (iRows || []) as DbTaskRoutineItem[]) {
                const arr = itemsByRoutine.get(item.routine_id) || [];
                arr.push(item);
                itemsByRoutine.set(item.routine_id, arr);
            }
            return (rRows as DbTaskRoutine[]).map((r) =>
                dbToRoutine(r, itemsByRoutine.get(r.id) || []),
            );
        },
        enabled: !!userId,
    });

    const addRoutine = useCallback(
        async (r: Omit<Routine, 'id' | 'createdAt' | 'items'>) => {
            if (!userId) throw new Error('Not authenticated');
            const row = {
                id: uuidv4(),
                user_id: userId,
                name: r.name,
                emoji: r.emoji || null,
                description: r.description || null,
            };
            const { data, error } = await supabase
                .from('task_routines')
                .insert(row)
                .select()
                .single();
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['task_routines', userId] });
            return dbToRoutine(data as DbTaskRoutine, []);
        },
        [userId, queryClient],
    );

    const updateRoutine = useCallback(
        async (r: Omit<Routine, 'items'>) => {
            if (!userId) throw new Error('Not authenticated');
            const { error } = await supabase
                .from('task_routines')
                .update({
                    name: r.name,
                    emoji: r.emoji || null,
                    description: r.description || null,
                })
                .eq('id', r.id)
                .eq('user_id', userId);
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['task_routines', userId] });
        },
        [userId, queryClient],
    );

    const deleteRoutine = useCallback(
        async (id: string) => {
            if (!userId) throw new Error('Not authenticated');
            const { error } = await supabase
                .from('task_routines')
                .delete()
                .eq('id', id)
                .eq('user_id', userId);
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['task_routines', userId] });
        },
        [userId, queryClient],
    );

    const setRoutineItems = useCallback(
        async (routineId: string, items: Array<Omit<RoutineItem, 'id' | 'routineId'>>) => {
            if (!userId) throw new Error('Not authenticated');
            // Replace-all strategy: delete then insert
            await supabase.from('task_routine_items').delete().eq('routine_id', routineId);
            if (items.length > 0) {
                const rows = items.map((item, idx) => ({
                    id: uuidv4(),
                    routine_id: routineId,
                    title: item.title,
                    task_type_id: item.taskTypeId || null,
                    energy: item.energy || null,
                    estimated_time: item.estimatedTime ?? null,
                    sort_order: item.sortOrder ?? idx,
                }));
                const { error } = await supabase.from('task_routine_items').insert(rows);
                if (error) throw error;
            }
            queryClient.invalidateQueries({ queryKey: ['task_routines', userId] });
        },
        [userId, queryClient],
    );

    const runRoutine = useCallback(
        async (routineId: string, dueDate?: string) => {
            if (!userId) throw new Error('Not authenticated');
            const routine = routines.find((r) => r.id === routineId);
            if (!routine || routine.items.length === 0) return 0;

            const targetDate = dueDate || new Date().toISOString().slice(0, 10);
            const rows = routine.items
                .slice()
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((item, idx) => {
                    const task: Task = {
                        id: uuidv4(),
                        title: item.title,
                        completed: false,
                        createdAt: new Date().toISOString(),
                        priority: 'medium',
                        subtasks: [],
                        recurrence: 'none',
                        plannedFor: targetDate,
                        flag: 'today',
                        estimatedTime: item.estimatedTime,
                        taskTypeId: item.taskTypeId,
                        energy: item.energy,
                        routineId: routine.id,
                        routineOrder: idx,
                    };
                    return todoToDb(task, userId);
                });

            const { error } = await supabase.from('todos').insert(rows);
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['todos', userId] });
            return rows.length;
        },
        [userId, routines, queryClient],
    );

    return {
        routines,
        isLoading,
        addRoutine,
        updateRoutine,
        deleteRoutine,
        setRoutineItems,
        runRoutine,
    };
};
