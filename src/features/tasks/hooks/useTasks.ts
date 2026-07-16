import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { useAuth } from '../../../hooks/useAuth';
import type { Task, TaskState, RecurrencePattern, RecurrenceConfig } from '../types';
import { calculateNextDueDate } from '../utils/recurrence';
import { nextSnoozeCount } from '../utils/staleness';
import { supabase, dbToTodo, todoToDb, type DbTodo } from '../../../services/supabase';
import { cancelTaskReminders } from '../../../services/notifications/scheduler.service';
import { isLocked } from '../utils/triageRouting';
import { eagerTriageTask } from '../services/eagerTriage';
import { removeTaskFromGoogle } from '../../planning/services/google-calendar.service';
import {
    applyKindWriteThrough,
    persistTaskUpdate,
    syncTaskReminders,
    syncTaskToGoogle,
} from '../services/taskWrites';
import { logAppEvent } from '../../../services/app-events';

export const useTasks = (): TaskState => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const userId = user?.id;

    // Fetch tasks (todos)
    const { data: tasks = [], isLoading } = useQuery({
        queryKey: ['todos', userId],
        queryFn: async () => {
            if (!userId) return [];
            // Assignment-linked todos are included on purpose: a school deadline
            // belongs on the one trusted task surface, not hidden in the module.
            // Completed tasks fade from the app after 30 days (rows stay in the
            // DB — nothing is deleted, so this is reversible).
            const fadeCutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
            const { data, error } = await supabase
                .from('todos')
                .select('*')
                .eq('user_id', userId)
                .or(`completed.eq.false,completed_at.gt.${fadeCutoff}`)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (data as DbTodo[]).map(dbToTodo);
        },
        enabled: !!userId,
    });

    const addTask = useCallback(
        async (
            title: string,
            priority?: Task['priority'],
            estimatedTime?: number,
            plannedFor?: string,
            recurrence?: RecurrencePattern,
            recurrenceConfig?: RecurrenceConfig,
            dueTime?: string,
        ) => {
            if (!userId) throw new Error('Not authenticated');

            const newTask: Task = {
                id: uuidv4(),
                title,
                completed: false,
                createdAt: new Date().toISOString(),
                priority: priority || 'medium',
                estimatedTime,
                plannedFor,
                dueTime,
                subtasks: [],
                recurrence: recurrence || 'none',
                recurrenceConfig,
                flag:
                    recurrence && recurrence !== 'none'
                        ? 'routine'
                        : plannedFor
                          ? 'today'
                          : 'someday',
                // Captures land in the inbox (triagedAt unset); eager triage may sort them below.
            };

            const dbTask = todoToDb(newTask, userId);
            const { error } = await supabase.from('todos').insert(dbTask);

            if (error) throw error;
            await syncTaskReminders(userId, newTask);
            queryClient.invalidateQueries({ queryKey: ['todos', userId] });

            // Eager on-capture sort — non-fatal, skipped offline / when no AI key is set.
            if (!newTask.triagedAt) {
                void eagerTriageTask(userId, newTask).then(() =>
                    queryClient.invalidateQueries({ queryKey: ['todos', userId] }),
                );
            }
            return newTask.id;
        },
        [userId, queryClient],
    );

    const addTaskFull = useCallback(
        async (partial: Partial<Task> & { title: string }) => {
            if (!userId) throw new Error('Not authenticated');

            const newTask: Task = applyKindWriteThrough({
                id: uuidv4(),
                completed: false,
                createdAt: new Date().toISOString(),
                priority: 'medium',
                subtasks: [],
                recurrence: 'none',
                ...partial,
            });

            const dbTask = todoToDb(newTask, userId);
            const { error } = await supabase.from('todos').insert(dbTask);

            if (error) throw error;
            await syncTaskReminders(userId, newTask);
            void syncTaskToGoogle(newTask);
            queryClient.invalidateQueries({ queryKey: ['todos', userId] });

            // Eager on-capture sort for bare captures; an explicit triagedAt
            // means the user (or caller) already routed it.
            if (!newTask.triagedAt) {
                void eagerTriageTask(userId, newTask).then(() =>
                    queryClient.invalidateQueries({ queryKey: ['todos', userId] }),
                );
            }
            return newTask.id;
        },
        [userId, queryClient],
    );

    const toggleTask = useCallback(
        async (id: string) => {
            if (!userId) throw new Error('Not authenticated');

            const task = tasks.find((t) => t.id === id);
            if (!task) return;

            const nowCompleting = !task.completed;
            const { error } = await supabase
                .from('todos')
                .update({
                    completed: nowCompleting,
                    completed_at: nowCompleting ? new Date().toISOString() : null,
                    last_touched_at: new Date().toISOString(),
                })
                .eq('id', id)
                .eq('user_id', userId);

            if (error) throw error;

            // Cancel reminders when completing; nothing to do when uncompleting (caller can resave to reschedule).
            if (nowCompleting) {
                await cancelTaskReminders(userId, id);
            }
            void syncTaskToGoogle({ ...task, completed: nowCompleting });

            // Mirror completion to the linked assignment (done todo = submitted).
            // Graded assignments stay graded. Non-fatal.
            if (task.assignmentId) {
                const { error: assignmentError } = await supabase
                    .from('assignments')
                    .update({
                        status: nowCompleting ? 'submitted' : 'in_progress',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', task.assignmentId)
                    .eq('user_id', userId)
                    .neq('status', 'graded');
                if (assignmentError) {
                    console.error('Failed to sync assignment status:', assignmentError);
                }
                queryClient.invalidateQueries({ queryKey: ['assignments', userId] });
            }

            // Spawn next occurrence for recurring tasks
            if (nowCompleting && task.recurrence && task.recurrence !== 'none') {
                const nextDue = calculateNextDueDate(
                    task.plannedFor,
                    task.recurrence,
                    task.recurrenceConfig,
                );
                const nextTask = todoToDb(
                    {
                        ...task,
                        id: uuidv4(),
                        completed: false,
                        createdAt: new Date().toISOString(),
                        plannedFor: nextDue || undefined,
                        completedAt: undefined,
                        startedAt: undefined,
                        actualMinutes: undefined,
                    },
                    userId,
                );
                const { error: insertError } = await supabase.from('todos').insert({
                    ...nextTask,
                    created_at: new Date().toISOString(),
                });
                if (insertError) console.error('Failed to create next recurrence:', insertError);
            }

            queryClient.invalidateQueries({ queryKey: ['todos', userId] });
        },
        [userId, tasks, queryClient],
    );

    const deleteTask = useCallback(
        async (id: string) => {
            if (!userId) throw new Error('Not authenticated');

            const task = tasks.find((t) => t.id === id);

            const { error } = await supabase
                .from('todos')
                .delete()
                .eq('id', id)
                .eq('user_id', userId);

            if (error) throw error;
            await cancelTaskReminders(userId, id);
            if (task?.googleEventId) void removeTaskFromGoogle(task);
            queryClient.invalidateQueries({ queryKey: ['todos', userId] });
        },
        [userId, tasks, queryClient],
    );

    const updateTask = useCallback(
        async (updatedTask: Task) => {
            if (!userId) throw new Error('Not authenticated');

            // Stuck signals: every edit is a touch; pushing a due/overdue task
            // to a later date counts as a snooze. Column writes, reminder sync,
            // and the Google mirror all live in persistTaskUpdate (one write path).
            const prev = tasks.find((t) => t.id === updatedTask.id);
            const todayIso = format(new Date(), 'yyyy-MM-dd');

            await persistTaskUpdate(userId, {
                ...updatedTask,
                snoozeCount: prev
                    ? nextSnoozeCount(prev, updatedTask.plannedFor, todayIso)
                    : (updatedTask.snoozeCount ?? 0),
                lastTouchedAt: new Date().toISOString(),
            });
            queryClient.invalidateQueries({ queryKey: ['todos', userId] });
        },
        [userId, tasks, queryClient],
    );

    const startTask = useCallback(
        async (id: string) => {
            if (!userId) throw new Error('Not authenticated');

            const { error } = await supabase
                .from('todos')
                .update({
                    started_at: new Date().toISOString(),
                    last_touched_at: new Date().toISOString(),
                })
                .eq('id', id)
                .eq('user_id', userId);

            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['todos', userId] });
        },
        [userId, queryClient],
    );

    const completeTaskWithDuration = useCallback(
        async (id: string, actualMinutes: number) => {
            if (!userId) throw new Error('Not authenticated');

            const task = tasks.find((t) => t.id === id);
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
                    last_touched_at: new Date().toISOString(),
                    historical_minutes: updatedHistory,
                })
                .eq('id', id)
                .eq('user_id', userId);

            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['todos', userId] });
        },
        [userId, tasks, queryClient],
    );

    const rescheduleMany = useCallback(
        async (ids: string[], isoDate: string) => {
            if (!userId || ids.length === 0) return;
            // Fixed tasks tied to a real moment must not be auto-moved.
            const movable = ids.filter((id) => {
                const t = tasks.find((x) => x.id === id);
                return t ? !isLocked(t) : true;
            });
            if (movable.length === 0) return;
            const nowIso = new Date().toISOString();
            const todayIso = format(new Date(), 'yyyy-MM-dd');

            // Use the same canonical write path as capture, triage and editing so
            // flags, reminders and the calendar cannot drift during bulk planning.
            for (const id of movable) {
                const t = tasks.find((x) => x.id === id);
                if (!t) continue;
                await persistTaskUpdate(userId, {
                    ...t,
                    flag: t.flag === 'someday' ? 'today' : (t.flag ?? 'today'),
                    plannedFor: isoDate,
                    lastTouchedAt: nowIso,
                    snoozeCount: nextSnoozeCount(t, isoDate, todayIso),
                });
            }
            void logAppEvent('task_scheduled', { taskIds: movable, plannedFor: isoDate });
            queryClient.invalidateQueries({ queryKey: ['todos', userId] });
        },
        [userId, tasks, queryClient],
    );

    const completeMany = useCallback(
        async (ids: string[]) => {
            if (!userId || ids.length === 0) return;
            const nowIso = new Date().toISOString();
            const { error } = await supabase
                .from('todos')
                .update({ completed: true, completed_at: nowIso, last_touched_at: nowIso })
                .in('id', ids)
                .eq('user_id', userId);
            if (error) throw error;
            await Promise.all(ids.map((id) => cancelTaskReminders(userId, id)));
            tasks
                .filter((t) => ids.includes(t.id) && t.googleEventId)
                .forEach((t) => void removeTaskFromGoogle(t));

            // Mirror completion to linked assignments (graded ones stay graded).
            const assignmentIds = tasks
                .filter((t) => ids.includes(t.id) && t.assignmentId)
                .map((t) => t.assignmentId as string);
            if (assignmentIds.length > 0) {
                const { error: assignmentError } = await supabase
                    .from('assignments')
                    .update({ status: 'submitted', updated_at: nowIso })
                    .in('id', assignmentIds)
                    .eq('user_id', userId)
                    .neq('status', 'graded');
                if (assignmentError) {
                    console.error('Failed to sync assignment statuses:', assignmentError);
                }
                queryClient.invalidateQueries({ queryKey: ['assignments', userId] });
            }

            // Spawn next occurrence for any recurring tasks we just completed
            const completed = tasks.filter(
                (t) => ids.includes(t.id) && t.recurrence && t.recurrence !== 'none',
            );
            if (completed.length > 0) {
                const rows = completed.map((task) => ({
                    ...todoToDb(
                        {
                            ...task,
                            id: uuidv4(),
                            completed: false,
                            createdAt: new Date().toISOString(),
                            plannedFor:
                                calculateNextDueDate(
                                    task.plannedFor,
                                    task.recurrence!,
                                    task.recurrenceConfig,
                                ) || undefined,
                            completedAt: undefined,
                            startedAt: undefined,
                            actualMinutes: undefined,
                        },
                        userId,
                    ),
                    created_at: new Date().toISOString(),
                }));
                const { error: insertError } = await supabase.from('todos').insert(rows);
                if (insertError) console.error('Failed to create next recurrences:', insertError);
            }

            queryClient.invalidateQueries({ queryKey: ['todos', userId] });
        },
        [userId, tasks, queryClient],
    );

    const deleteMany = useCallback(
        async (ids: string[]) => {
            if (!userId || ids.length === 0) return;
            const toUnsync = tasks.filter((t) => ids.includes(t.id) && t.googleEventId);
            const { error } = await supabase
                .from('todos')
                .delete()
                .in('id', ids)
                .eq('user_id', userId);
            if (error) throw error;
            await Promise.all(ids.map((id) => cancelTaskReminders(userId, id)));
            toUnsync.forEach((t) => void removeTaskFromGoogle(t));
            queryClient.invalidateQueries({ queryKey: ['todos', userId] });
        },
        [userId, tasks, queryClient],
    );

    return {
        tasks,
        isLoading,
        addTask,
        addTaskFull,
        toggleTask,
        deleteTask,
        updateTask,
        startTask,
        completeTaskWithDuration,
        rescheduleMany,
        completeMany,
        deleteMany,
    };
};
