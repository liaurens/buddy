import { describe, it, expect } from 'vitest';
import { dbToTodo, todoToDb } from './todo';
import type { DbTodo } from '../types';

describe('todo converter — metadata columns', () => {
    it('maps hardness, autoTriaged, triageDestination from db to domain', () => {
        const db = {
            id: 'x', user_id: 'u', title: 't', completed: false,
            due_date: null, due_time: null, location: null, labels: null,
            created_at: '2026-06-21T00:00:00.000Z', priority: null, estimated_time: null,
            subtasks: null, actual_minutes: null, started_at: null, completed_at: null,
            historical_minutes: null, recurrence: 'none', recurrence_config: null,
            hardness: 'fixed', auto_triaged: true, triage_destination: 'school',
        } as DbTodo;
        const task = dbToTodo(db);
        expect(task.hardness).toBe('fixed');
        expect(task.autoTriaged).toBe(true);
        expect(task.triageDestination).toBe('school');
    });

    it('defaults autoTriaged to false and round-trips back to db', () => {
        const db = { id: 'x', user_id: 'u', title: 't', completed: false,
            due_date: null, due_time: null, location: null, labels: null,
            created_at: '2026-06-21T00:00:00.000Z', priority: null, estimated_time: null,
            subtasks: null, actual_minutes: null, started_at: null, completed_at: null,
            historical_minutes: null, recurrence: 'none', recurrence_config: null } as DbTodo;
        const task = dbToTodo(db);
        expect(task.autoTriaged).toBe(false);
        expect(task.hardness).toBeUndefined();

        const back = todoToDb({ ...task, hardness: 'flexible', autoTriaged: true, triageDestination: 'today' }, 'u');
        expect(back.hardness).toBe('flexible');
        expect(back.auto_triaged).toBe(true);
        expect(back.triage_destination).toBe('today');
    });
});
