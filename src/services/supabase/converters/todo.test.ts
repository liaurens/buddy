import { describe, it, expect } from 'vitest';
import { dbToTodo, todoToDb } from './todo';
import type { DbTodo } from '../types';
import type { Task } from '../../../features/tasks/types';

/** A fully-populated DB row, every nullable column filled. */
function fullDbTodo(): DbTodo {
    return {
        id: 'todo-1',
        user_id: 'user-1',
        title: 'Write tests',
        completed: false,
        due_date: '2026-06-22',
        due_time: '09:30',
        location: 'desk',
        labels: ['focus', 'school'],
        created_at: '2026-06-21T08:00:00.000Z',
        priority: 'high',
        estimated_time: 45,
        subtasks: [{ id: 's1', title: 'outline', completed: true }],
        actual_minutes: 50,
        started_at: '2026-06-21T09:00:00.000Z',
        completed_at: '2026-06-21T09:50:00.000Z',
        historical_minutes: [40, 55],
        recurrence: 'weekly',
        recurrence_config: { daysOfWeek: [1, 3], interval: 1 },
        reminder_enabled: true,
        reminder_offset_minutes: 15,
        reminder_at: '2026-06-22T09:15:00.000Z',
        reminder_cadence: 'smart',
        last_reminded_at: '2026-06-21T20:00:00.000Z',
        task_type_id: 'type-1',
        assignment_id: 'assign-1',
        energy: 'high',
        context: 'computer',
        routine_id: 'routine-1',
        routine_order: 2,
        kind: 'deadline',
        parent_todo_id: 'parent-1',
        notes: 'remember the edge cases',
        triaged_at: '2026-06-21T07:00:00.000Z',
        google_event_id: 'gcal-1',
        google_calendar_id: 'primary',
        google_synced_at: '2026-06-21T07:05:00.000Z',
    };
}

describe('dbToTodo', () => {
    it('maps every field from a fully-populated row', () => {
        const task = dbToTodo(fullDbTodo());
        expect(task).toMatchObject({
            id: 'todo-1',
            title: 'Write tests',
            completed: false,
            dueDate: '2026-06-22',
            dueTime: '09:30',
            location: 'desk',
            labels: ['focus', 'school'],
            createdAt: '2026-06-21T08:00:00.000Z',
            priority: 'high',
            estimatedTime: 45,
            actualMinutes: 50,
            recurrence: 'weekly',
            recurrenceConfig: { daysOfWeek: [1, 3], interval: 1 },
            reminderEnabled: true,
            reminderOffsetMinutes: 15,
            reminderCadence: 'smart',
            taskTypeId: 'type-1',
            assignmentId: 'assign-1',
            energy: 'high',
            context: 'computer',
            routineId: 'routine-1',
            routineOrder: 2,
            kind: 'deadline',
            parentTodoId: 'parent-1',
            notes: 'remember the edge cases',
            googleEventId: 'gcal-1',
        });
    });

    it('normalizes null columns to undefined (not null)', () => {
        const db: DbTodo = {
            ...fullDbTodo(),
            due_date: null,
            due_time: null,
            location: null,
            labels: null,
            estimated_time: null,
            task_type_id: null,
            kind: null,
        };
        const task = dbToTodo(db);
        expect(task.dueDate).toBeUndefined();
        expect(task.dueTime).toBeUndefined();
        expect(task.location).toBeUndefined();
        expect(task.labels).toBeUndefined();
        expect(task.estimatedTime).toBeUndefined();
        expect(task.taskTypeId).toBeUndefined();
        expect(task.kind).toBeUndefined();
    });

    it('defaults a missing recurrence to "none" and subtasks to []', () => {
        const db = {
            ...fullDbTodo(),
            recurrence: undefined as unknown as DbTodo['recurrence'],
            subtasks: null,
        };
        const task = dbToTodo(db);
        expect(task.recurrence).toBe('none');
        expect(task.subtasks).toEqual([]);
    });

    it('keeps a 0 reminderOffsetMinutes via ?? (not ||)', () => {
        const task = dbToTodo({ ...fullDbTodo(), reminder_offset_minutes: 0, routine_order: 0 });
        expect(task.reminderOffsetMinutes).toBe(0);
        expect(task.routineOrder).toBe(0);
    });

    it('defaults reminderEnabled to false when absent', () => {
        const task = dbToTodo({ ...fullDbTodo(), reminder_enabled: undefined });
        expect(task.reminderEnabled).toBe(false);
    });
});

describe('todoToDb', () => {
    it('maps domain fields back to snake_case columns and attaches user_id', () => {
        const task = dbToTodo(fullDbTodo());
        const db = todoToDb(task, 'user-9');
        expect(db.user_id).toBe('user-9');
        expect(db.title).toBe('Write tests');
        expect(db.due_date).toBe('2026-06-22');
        expect(db.task_type_id).toBe('type-1');
        expect(db.recurrence_config).toEqual({ daysOfWeek: [1, 3], interval: 1 });
    });

    it('converts absent optionals to null (not undefined)', () => {
        const task: Omit<Task, 'id'> = {
            title: 'bare',
            completed: false,
            createdAt: '2026-06-21T08:00:00.000Z',
            recurrence: 'none',
        };
        const db = todoToDb(task, 'user-1');
        expect(db.due_date).toBeNull();
        expect(db.labels).toBeNull();
        expect(db.task_type_id).toBeNull();
        expect(db.kind).toBeNull();
        expect(db.priority).toBeNull();
        expect(db.reminder_enabled).toBe(false);
    });

    it('preserves a 0 routineOrder / reminderOffset via ?? (not ||)', () => {
        const task = dbToTodo({ ...fullDbTodo(), routine_order: 0, reminder_offset_minutes: 0 });
        const db = todoToDb(task, 'user-1');
        expect(db.routine_order).toBe(0);
        expect(db.reminder_offset_minutes).toBe(0);
    });

    it('round-trips a full row back to equivalent column values', () => {
        const original = fullDbTodo();
        const task = dbToTodo(original);
        const db = todoToDb({ ...task }, original.user_id);
        // id/created_at are passthrough; compare the data columns.
        expect(db.title).toBe(original.title);
        expect(db.due_date).toBe(original.due_date);
        expect(db.subtasks).toEqual(original.subtasks);
        expect(db.historical_minutes).toEqual(original.historical_minutes);
        expect(db.kind).toBe(original.kind);
        expect(db.google_event_id).toBe(original.google_event_id);
    });
});
