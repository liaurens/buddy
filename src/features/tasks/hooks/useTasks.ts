import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../../../hooks/useAuth';
import type { Task, TaskState } from '../types';
import {
    supabase,
    dbToTodo,
    todoToDb,
    type DbTodo,
} from '../../../services/supabase';

export const useTasks = (): TaskState => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const userId = user?.id;

    // Fetch tasks (todos)
    const { data: tasks = [], isLoading } = useQuery({
        queryKey: ['todos', userId],
        queryFn: async () => {
            if (!userId) return [];
            const { data, error } = await supabase
                .from('todos')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (data as DbTodo[]).map(dbToTodo);
        },
        enabled: !!userId,
    });

    const addTask = useCallback(async (title: string, priority?: Task['priority'], estimatedTime?: number) => {
        if (!userId) return;

        const newTask: Task = {
            id: uuidv4(),
            title,
            completed: false,
            createdAt: new Date().toISOString(),
            priority: priority || 'medium',
            estimatedTime,
            subtasks: []
        };

        const dbTask = todoToDb(newTask, userId);
        const { error } = await supabase.from('todos').insert(dbTask);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['todos', userId] });
    }, [userId, queryClient]);

    const toggleTask = useCallback(async (id: string) => {
        if (!userId) return;

        const task = tasks.find(t => t.id === id);
        if (!task) return;

        const { error } = await supabase
            .from('todos')
            .update({ completed: !task.completed })
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['todos', userId] });
    }, [userId, tasks, queryClient]);

    const deleteTask = useCallback(async (id: string) => {
        if (!userId) return;

        const { error } = await supabase
            .from('todos')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['todos', userId] });
    }, [userId, queryClient]);

    const updateTask = useCallback(async (updatedTask: Task) => {
        if (!userId) return;

        const { id, ...updates } = updatedTask;
        const dbUpdates = {
            title: updates.title,
            completed: updates.completed,
            due_date: updates.dueDate || null,
            priority: updates.priority || null,
            estimated_time: updates.estimatedTime || null,
            subtasks: updates.subtasks || null,
        };

        const { error } = await supabase
            .from('todos')
            .update(dbUpdates)
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['todos', userId] });
    }, [userId, queryClient]);

    const startTask = useCallback(async (id: string) => {
        if (!userId) return;

        const { error } = await supabase
            .from('todos')
            .update({ started_at: new Date().toISOString() })
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['todos', userId] });
    }, [userId, queryClient]);

    const completeTaskWithDuration = useCallback(async (id: string, actualMinutes: number) => {
        if (!userId) return;

        const task = tasks.find(t => t.id === id);
        if (!task) return;

        // Add to historical minutes (keep last 10)
        const historicalMinutes = task.historicalMinutes || [];
        const updatedHistory = [...historicalMinutes, actualMinutes].slice(-10);

        const { error } = await supabase
            .from('todos')
            .update({
                completed: true,
                actual_minutes: actualMinutes,
                completed_at: new Date().toISOString(),
                historical_minutes: updatedHistory,
            })
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['todos', userId] });
    }, [userId, tasks, queryClient]);

    return { tasks, isLoading, addTask, toggleTask, deleteTask, updateTask, startTask, completeTaskWithDuration };
};
