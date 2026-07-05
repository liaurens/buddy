/**
 * taskWrites — the one write path for updating an existing todo.
 *
 * Every full-task update (manual edit, manual triage, AI auto-sort, eager
 * capture sort) funnels through persistTaskUpdate so they all write the same
 * columns (via the todoToDb converter), apply the kind→signal write-through,
 * schedule reminders, and mirror to Google identically. No React in here —
 * callable from hooks and fire-and-forget services alike.
 */

import type { Task } from '../types';
import { supabase, todoToDb } from '../../../services/supabase';
import {
    scheduleTaskReminders,
    cancelTaskReminders,
} from '../../../services/notifications/scheduler.service';
import { getCategorySettings } from '../../../services/settings';
import { deriveTaskKind, kindSignalPatch } from '../utils/taskKind';
import {
    pushTaskToGoogle,
    updateTaskOnGoogle,
    removeTaskFromGoogle,
} from '../../planning/services/google-calendar.service';

/** Build the absolute due moment from dueDate (YYYY-MM-DD) + optional dueTime (HH:MM). */
export function resolveDueAt(dueDate?: string, dueTime?: string): Date | undefined {
    if (!dueDate) return undefined;
    const time = dueTime || '09:00';
    const dt = new Date(`${dueDate}T${time}:00`);
    return isNaN(dt.getTime()) ? undefined : dt;
}

/** Push a task's reminder configuration to scheduled_notifications. */
export async function syncTaskReminders(userId: string, task: Task): Promise<void> {
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

/** Hybrid write-through: seed the canonical signal for an explicit kind so the two never drift. */
export function applyKindWriteThrough(task: Task): Task {
    return task.kind ? { ...task, ...kindSignalPatch(task.kind) } : task;
}

/**
 * Mirror a task to Google Calendar. Always non-fatal — a missing connection or
 * a Google error must never break the local task save. Network failures are
 * queued by the service itself.
 */
export async function syncTaskToGoogle(task: Task): Promise<void> {
    try {
        if (task.googleEventId) {
            if (task.completed || !task.dueDate) await removeTaskFromGoogle(task);
            else await updateTaskOnGoogle(task);
        } else if (!task.completed && task.dueDate && deriveTaskKind(task) === 'urgent') {
            await pushTaskToGoogle(task);
        }
    } catch (e) {
        console.warn('Google Calendar sync skipped:', e);
    }
}

/**
 * Persist a full task update: kind write-through → one converter-driven column
 * write → reminder sync → Google mirror. Returns the task as written.
 * Throws on DB error; reminder/Google failures are non-fatal.
 */
export async function persistTaskUpdate(userId: string, task: Task): Promise<Task> {
    const finalTask = applyKindWriteThrough(task);
    const {
        id: _id,
        user_id: _userId,
        created_at: _createdAt,
        ...dbUpdates
    } = todoToDb(finalTask, userId);

    const { error } = await supabase
        .from('todos')
        .update(dbUpdates)
        .eq('id', finalTask.id)
        .eq('user_id', userId);
    if (error) throw error;

    await syncTaskReminders(userId, finalTask);
    void syncTaskToGoogle(finalTask);
    return finalTask;
}
