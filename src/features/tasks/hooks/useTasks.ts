import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../../../hooks/useAuth';
import type { Task, TaskState, RecurrencePattern, RecurrenceConfig } from '../types';
import { calculateNextDueDate } from '../utils/recurrence';
import {
    supabase,
    dbToTodo,
    todoToDb,
    type DbTodo,
} from '../../../services/supabase';
import {
    scheduleTaskReminders,
    cancelTaskReminders,
} from '../../../services/notifications/scheduler.service';
import { getCategorySettings } from '../../../services/settings';

/** Build the absolute due moment from dueDate (YYYY-MM-DD) + optional dueTime (HH:MM). */
function resolveDueAt(dueDate?: string, dueTime?: string): Date | undefined {
    if (!dueDate) return undefined;
    const time = dueTime || '09:00';
    const dt = new Date(`${dueDate}T${time}:00`);
    return isNaN(dt.getTime()) ? undefined : dt;
}

/** Push a task's reminder configuration to scheduled_notifications. */
async function syncTaskReminders(userId: string, task: Task): Promise<void> {
    try {
        if (task.completed) {
            await cancelTaskReminders(userId, task.id);
            return;
        }
        if (!task.reminderEnabled) {
            await cancelTaskReminders(userId, task.id);
            return;
        }
        const absoluteAt = task.reminderAt ? new Date(task.reminderAt) : undefined;
        const dueAt = resolveDueAt(task.dueDate, task.dueTime);
        if (!absoluteAt && !dueAt) {
            await cancelTaskReminders(userId, task.id);
            return;
        }
        // Per-task cadence wins; otherwise the user's default from
        // notification settings (cached in memory after the first read).
        const defaultCadence = task.reminderCadence
            ? undefined
            : (await getCategorySettings(userId, 'notifications')).taskReminderCadence;
        await scheduleTaskReminders({
            userId,
            taskId: task.id,
            taskTitle: task.title,
            dueAt,
            absoluteAt,
            offsetMinutes: task.reminderOffsetMinutes,
            cadence: task.reminderCadence || defaultCadence || 'smart',
            priority: task.priority,
        });
    } catch (e) {
        console.error('Failed to sync task reminders:', e);
    }
}

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
                .is('assignment_id', null)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (data as DbTodo[]).map(dbToTodo);
        },
        enabled: !!userId,
    });

    const addTask = useCallback(async (title: string, priority?: Task['priority'], estimatedTime?: number, dueDate?: string, recurrence?: RecurrencePattern, recurrenceConfig?: RecurrenceConfig, dueTime?: string) => {
        if (!userId) throw new Error('Not authenticated');

        const newTask: Task = {
            id: uuidv4(),
            title,
            completed: false,
            createdAt: new Date().toISOString(),
            priority: priority || 'medium',
            estimatedTime,
            dueDate,
            dueTime,
            subtasks: [],
            recurrence: recurrence || 'none',
            recurrenceConfig,
        };

        const dbTask = todoToDb(newTask, userId);
        const { error } = await supabase.from('todos').insert(dbTask);

        if (error) throw error;
        await syncTaskReminders(userId, newTask);
        queryClient.invalidateQueries({ queryKey: ['todos', userId] });
        return newTask.id;
    }, [userId, queryClient]);

    const addTaskFull = useCallback(async (partial: Partial<Task> & { title: string }) => {
        if (!userId) throw new Error('Not authenticated');

        const newTask: Task = {
            id: uuidv4(),
            completed: false,
            createdAt: new Date().toISOString(),
            priority: 'medium',
            subtasks: [],
            recurrence: 'none',
            ...partial,
        };

        const dbTask = todoToDb(newTask, userId);
        const { error } = await supabase.from('todos').insert(dbTask);

        if (error) throw error;
        await syncTaskReminders(userId, newTask);
        queryClient.invalidateQueries({ queryKey: ['todos', userId] });
        return newTask.id;
    }, [userId, queryClient]);

    const toggleTask = useCallback(async (id: string) => {
        if (!userId) throw new Error('Not authenticated');

        const task = tasks.find(t => t.id === id);
        if (!task) return;

        const nowCompleting = !task.completed;
        const { error } = await supabase
            .from('todos')
            .update({
                completed: nowCompleting,
                completed_at: nowCompleting ? new Date().toISOString() : null,
            })
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;

        // Cancel reminders when completing; nothing to do when uncompleting (caller can resave to reschedule).
        if (nowCompleting) {
            await cancelTaskReminders(userId, id);
        }

        // Spawn next occurrence for recurring tasks
        if (nowCompleting && task.recurrence && task.recurrence !== 'none') {
            const nextDue = calculateNextDueDate(task.dueDate, task.recurrence, task.recurrenceConfig);
            const nextTask = todoToDb({
                ...task,
                id: uuidv4(),
                completed: false,
                createdAt: new Date().toISOString(),
                dueDate: nextDue || undefined,
                completedAt: undefined,
                startedAt: undefined,
                actualMinutes: undefined,
            }, userId);
            const { error: insertError } = await supabase.from('todos').insert({
                ...nextTask,
                created_at: new Date().toISOString(),
            });
            if (insertError) console.error('Failed to create next recurrence:', insertError);
        }

        queryClient.invalidateQueries({ queryKey: ['todos', userId] });
    }, [userId, tasks, queryClient]);

    const deleteTask = useCallback(async (id: string) => {
        if (!userId) throw new Error('Not authenticated');

        const { error } = await supabase
            .from('todos')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;
        await cancelTaskReminders(userId, id);
        queryClient.invalidateQueries({ queryKey: ['todos', userId] });
    }, [userId, queryClient]);

    const updateTask = useCallback(async (updatedTask: Task) => {
        if (!userId) throw new Error('Not authenticated');

        const { id, ...updates } = updatedTask;
        const dbUpdates = {
            title: updates.title,
            completed: updates.completed,
            due_date: updates.dueDate || null,
            due_time: updates.dueTime || null,
            location: updates.location || null,
            labels: updates.labels || null,
            priority: updates.priority || null,
            estimated_time: updates.estimatedTime || null,
            subtasks: updates.subtasks || null,
            recurrence: updates.recurrence || 'none',
            recurrence_config: updates.recurrenceConfig || null,
            reminder_enabled: updates.reminderEnabled || false,
            reminder_offset_minutes: updates.reminderOffsetMinutes ?? null,
            reminder_at: updates.reminderAt || null,
            reminder_cadence: updates.reminderCadence || null,
            task_type_id: updates.taskTypeId || null,
            energy: updates.energy || null,
            context: updates.context || null,
            routine_id: updates.routineId || null,
            routine_order: updates.routineOrder ?? null,
        };

        const { error } = await supabase
            .from('todos')
            .update(dbUpdates)
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;
        await syncTaskReminders(userId, updatedTask);
        queryClient.invalidateQueries({ queryKey: ['todos', userId] });
    }, [userId, queryClient]);

    const startTask = useCallback(async (id: string) => {
        if (!userId) throw new Error('Not authenticated');

        const { error } = await supabase
            .from('todos')
            .update({ started_at: new Date().toISOString() })
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['todos', userId] });
    }, [userId, queryClient]);

    const completeTaskWithDuration = useCallback(async (id: string, actualMinutes: number) => {
        if (!userId) throw new Error('Not authenticated');

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

    const rescheduleMany = useCallback(async (ids: string[], isoDate: string) => {
        if (!userId || ids.length === 0) return;
        const { error } = await supabase
            .from('todos')
            .update({ due_date: isoDate })
            .in('id', ids)
            .eq('user_id', userId);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['todos', userId] });
    }, [userId, queryClient]);

    const completeMany = useCallback(async (ids: string[]) => {
        if (!userId || ids.length === 0) return;
        const nowIso = new Date().toISOString();
        const { error } = await supabase
            .from('todos')
            .update({ completed: true, completed_at: nowIso })
            .in('id', ids)
            .eq('user_id', userId);
        if (error) throw error;
        await Promise.all(ids.map(id => cancelTaskReminders(userId, id)));

        // Spawn next occurrence for any recurring tasks we just completed
        const completed = tasks.filter(t => ids.includes(t.id) && t.recurrence && t.recurrence !== 'none');
        if (completed.length > 0) {
            const rows = completed.map(task => ({
                ...todoToDb({
                    ...task,
                    id: uuidv4(),
                    completed: false,
                    createdAt: new Date().toISOString(),
                    dueDate: calculateNextDueDate(task.dueDate, task.recurrence!, task.recurrenceConfig) || undefined,
                    completedAt: undefined,
                    startedAt: undefined,
                    actualMinutes: undefined,
                }, userId),
                created_at: new Date().toISOString(),
            }));
            const { error: insertError } = await supabase.from('todos').insert(rows);
            if (insertError) console.error('Failed to create next recurrences:', insertError);
        }

        queryClient.invalidateQueries({ queryKey: ['todos', userId] });
    }, [userId, tasks, queryClient]);

    const deleteMany = useCallback(async (ids: string[]) => {
        if (!userId || ids.length === 0) return;
        const { error } = await supabase
            .from('todos')
            .delete()
            .in('id', ids)
            .eq('user_id', userId);
        if (error) throw error;
        await Promise.all(ids.map(id => cancelTaskReminders(userId, id)));
        queryClient.invalidateQueries({ queryKey: ['todos', userId] });
    }, [userId, queryClient]);

    return { tasks, isLoading, addTask, addTaskFull, toggleTask, deleteTask, updateTask, startTask, completeTaskWithDuration, rescheduleMany, completeMany, deleteMany };
};
