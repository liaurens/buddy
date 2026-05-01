/**
 * Task/Todo Converters
 */

import type { Task } from '../../../types';
import type { DbTodo } from '../types';

export function dbToTodo(db: DbTodo): Task {
    return {
        id: db.id,
        title: db.title,
        completed: db.completed,
        dueDate: db.due_date || undefined,
        dueTime: db.due_time || undefined,
        location: db.location || undefined,
        labels: db.labels || undefined,
        createdAt: db.created_at,
        priority: db.priority as Task['priority'],
        estimatedTime: db.estimated_time || undefined,
        subtasks: db.subtasks || [],
        actualMinutes: db.actual_minutes || undefined,
        startedAt: db.started_at || undefined,
        completedAt: db.completed_at || undefined,
        historicalMinutes: db.historical_minutes || undefined,
        recurrence: (db.recurrence as Task['recurrence']) || 'none',
        recurrenceConfig: db.recurrence_config || undefined,
        reminderEnabled: db.reminder_enabled || false,
        reminderOffsetMinutes: db.reminder_offset_minutes ?? undefined,
        reminderAt: db.reminder_at || undefined,
        reminderCadence: (db.reminder_cadence as Task['reminderCadence']) || undefined,
        lastRemindedAt: db.last_reminded_at || undefined,
    };
}

export function todoToDb(todo: Omit<Task, 'id'> & { id?: string }, userId: string): Omit<DbTodo, 'id' | 'created_at'> & { id?: string; created_at?: string } {
    return {
        id: todo.id,
        user_id: userId,
        title: todo.title,
        completed: todo.completed,
        due_date: todo.dueDate || null,
        due_time: todo.dueTime || null,
        location: todo.location || null,
        labels: todo.labels || null,
        created_at: todo.createdAt,
        priority: todo.priority || null,
        estimated_time: todo.estimatedTime || null,
        subtasks: todo.subtasks || null,
        actual_minutes: todo.actualMinutes || null,
        started_at: todo.startedAt || null,
        completed_at: todo.completedAt || null,
        historical_minutes: todo.historicalMinutes || null,
        recurrence: todo.recurrence || 'none',
        recurrence_config: todo.recurrenceConfig || null,
        reminder_enabled: todo.reminderEnabled || false,
        reminder_offset_minutes: todo.reminderOffsetMinutes ?? null,
        reminder_at: todo.reminderAt || null,
        reminder_cadence: todo.reminderCadence || null,
        last_reminded_at: todo.lastRemindedAt || null,
    };
}
