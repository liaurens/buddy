/**
 * taskWrites — the one write path for creating, updating and deleting a todo.
 *
 * Every full-task update (manual edit, manual triage, AI auto-sort, eager
 * capture sort) funnels through persistTaskUpdate so they all write the same
 * columns (via the todoToDb converter), apply the kind→signal write-through,
 * schedule reminders, and mirror to Google identically. No React in here —
 * callable from hooks and fire-and-forget services alike.
 */

import type { Task } from '../types';
import { supabase, dbToTodo, todoToDb } from '../../../services/supabase';
import type { DbTodo } from '../../../services/supabase/types';
import {
    scheduleTaskReminders,
    cancelTaskReminders,
} from '../../../services/notifications/scheduler.service';
import { getCategorySettings } from '../../../services/settings';
import { applyTaskFlag, deriveTaskFlag } from '../utils/taskFlags';
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
        const reminderDate = task.flag === 'deadline' ? task.dueDate : task.plannedFor;
        const dueAt = resolveDueAt(reminderDate, task.dueTime);
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

/**
 * Settle a task onto its flag's field contract before it hits the database.
 *
 * Resolve the flag (explicit wins, otherwise derived), then let `applyTaskFlag`
 * write everything that flag implies — planned day, reminder cadence, priority,
 * recurrence. Every insert and every update runs through this, so a task's
 * stored fields can never contradict its flag.
 */
export function applyFlagContract(task: Task): Task {
    return applyTaskFlag(task, deriveTaskFlag(task), {
        source: task.triageSource,
        manuallyConfirmed: true,
        explicitPlannedFor: task.plannedFor,
    }).task;
}

/**
 * Mirror a task to Google Calendar. Always non-fatal — a missing connection or
 * a Google error must never break the local task save. Network failures are
 * queued by the service itself.
 */
export async function syncTaskToGoogle(task: Task): Promise<void> {
    try {
        const calendarDate = task.plannedFor;
        const calendarTask = calendarDate ? { ...task, dueDate: calendarDate } : task;
        if (task.googleEventId) {
            if (task.completed || !calendarDate) await removeTaskFromGoogle(task);
            else await updateTaskOnGoogle(calendarTask);
        } else if (
            !task.completed &&
            calendarDate &&
            deriveTaskFlag(task) === 'urgent' &&
            task.dueTime
        ) {
            await pushTaskToGoogle(calendarTask);
        }
    } catch (e) {
        console.warn('Google Calendar sync skipped:', e);
    }
}

/**
 * Insert a new task: flag contract → converter-driven column write → reminder
 * sync → Google mirror. The insert twin of persistTaskUpdate, and the only way
 * a row should ever enter `todos` from the app.
 *
 * Before this existed, four call sites hand-rolled their own insert. The
 * recurrence spawn was the expensive one: completing a repeating task inserted
 * the next occurrence with a raw converter call and never scheduled a reminder,
 * so occurrence #2 onward was silent forever.
 *
 * Throws on DB error; reminder/Google failures are non-fatal.
 */
export async function insertTask(userId: string, task: Task): Promise<Task> {
    const finalTask = applyFlagContract(task);
    const { error } = await supabase.from('todos').insert(todoToDb(finalTask, userId));
    if (error) throw error;

    await syncTaskReminders(userId, finalTask);
    void syncTaskToGoogle(finalTask);
    return finalTask;
}

/** Insert several tasks, then schedule their reminders. Used by routines. */
export async function insertTasks(userId: string, tasks: Task[]): Promise<Task[]> {
    if (tasks.length === 0) return [];
    const finalTasks = tasks.map(applyFlagContract);
    const { error } = await supabase
        .from('todos')
        .insert(finalTasks.map((t) => todoToDb(t, userId)));
    if (error) throw error;

    await Promise.all(finalTasks.map((t) => syncTaskReminders(userId, t)));
    finalTasks.forEach((t) => void syncTaskToGoogle(t));
    return finalTasks;
}

/**
 * Persist a full task update: flag contract → one converter-driven column
 * write → reminder sync → Google mirror. Returns the task as written.
 * Throws on DB error; reminder/Google failures are non-fatal.
 */
export async function persistTaskUpdate(userId: string, task: Task): Promise<Task> {
    const finalTask = applyFlagContract(task);
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

/**
 * Delete tasks and everything hanging off them: pending reminder rows first,
 * then the Google mirror, then the rows. The delete twin of insertTask.
 *
 * School was the reason this exists. Deleting an assignment (or a whole class)
 * removed the mirrored todo with a raw `.delete()`, leaving its
 * `scheduled_notifications` rows behind to fire at a task that no longer
 * existed. Reminders are cancelled per id, so a partial failure still deletes.
 */
export async function deleteTasksFully(userId: string, taskIds: string[]): Promise<void> {
    if (taskIds.length === 0) return;

    // Read first: the Google mirror needs the event id, which the delete takes
    // with it. Non-fatal — a read failure must not block the delete.
    let tasks: Task[] = [];
    try {
        const { data } = await supabase
            .from('todos')
            .select('*')
            .eq('user_id', userId)
            .in('id', taskIds);
        tasks = ((data ?? []) as DbTodo[]).map(dbToTodo);
    } catch (e) {
        console.error('Failed to read tasks before delete:', e);
    }

    await Promise.all(taskIds.map((id) => cancelTaskReminders(userId, id)));

    const { error } = await supabase.from('todos').delete().eq('user_id', userId).in('id', taskIds);
    if (error) throw error;

    tasks.filter((t) => t.googleEventId).forEach((t) => void removeTaskFromGoogle(t));
}

/** Single-task convenience wrapper around deleteTasksFully. */
export async function deleteTaskFully(userId: string, taskId: string): Promise<void> {
    await deleteTasksFully(userId, [taskId]);
}

/**
 * Delete the todos mirroring these assignments — the school cascade's entry
 * point, so deleting an assignment or a class cleans up reminders too.
 */
export async function deleteTasksForAssignments(
    userId: string,
    assignmentIds: string[],
): Promise<void> {
    if (assignmentIds.length === 0) return;
    const { data, error } = await supabase
        .from('todos')
        .select('id')
        .eq('user_id', userId)
        .in('assignment_id', assignmentIds);
    if (error) throw error;
    await deleteTasksFully(
        userId,
        (data ?? []).map((row) => (row as { id: string }).id),
    );
}
