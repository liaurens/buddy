import { describe, it, expect } from 'vitest';
import { summarizeToday } from '../utils/todaySummary';

const NOW = new Date('2026-06-10T12:00:00');

const task = (overrides: { completed?: boolean; dueDate?: string }) => ({
    completed: overrides.completed ?? false,
    dueDate: overrides.dueDate,
});

const assignment = (overrides: { status?: string; deadline?: string }) => ({
    status: overrides.status ?? 'pending',
    deadline: overrides.deadline ?? '2026-06-12T23:59:00',
});

describe('summarizeToday', () => {
    it('returns zeros for empty input', () => {
        expect(summarizeToday([], [], NOW)).toEqual({
            overdue: 0,
            dueToday: 0,
            assignmentsDueSoon: 0,
        });
    });

    it('counts overdue and due-today tasks separately', () => {
        const tasks = [
            task({ dueDate: '2026-06-08T10:00:00' }), // overdue
            task({ dueDate: '2026-06-09T23:00:00' }), // overdue (yesterday)
            task({ dueDate: '2026-06-10T18:00:00' }), // due today
            task({ dueDate: '2026-06-15T10:00:00' }), // future — not counted
        ];
        expect(summarizeToday(tasks, [], NOW)).toEqual({
            overdue: 2,
            dueToday: 1,
            assignmentsDueSoon: 0,
        });
    });

    it('ignores completed tasks and tasks without due dates', () => {
        const tasks = [
            task({ completed: true, dueDate: '2026-06-08T10:00:00' }),
            task({ completed: true, dueDate: '2026-06-10T10:00:00' }),
            task({}),
        ];
        expect(summarizeToday(tasks, [], NOW)).toEqual({
            overdue: 0,
            dueToday: 0,
            assignmentsDueSoon: 0,
        });
    });

    it('ignores invalid due dates', () => {
        expect(summarizeToday([task({ dueDate: 'not-a-date' })], [], NOW)).toEqual({
            overdue: 0,
            dueToday: 0,
            assignmentsDueSoon: 0,
        });
    });

    it('counts active assignments due within 7 days, including overdue ones', () => {
        const assignments = [
            assignment({ deadline: '2026-06-09T23:59:00' }), // overdue — still counts
            assignment({ deadline: '2026-06-17T23:59:00' }), // exactly day 7
            assignment({ deadline: '2026-06-18T08:00:00' }), // beyond horizon
            assignment({ status: 'submitted', deadline: '2026-06-11T23:59:00' }), // not active
            assignment({ status: 'graded', deadline: '2026-06-11T23:59:00' }), // not active
            assignment({ status: 'in_progress', deadline: '2026-06-12T23:59:00' }),
        ];
        expect(summarizeToday([], assignments, NOW)).toEqual({
            overdue: 0,
            dueToday: 0,
            assignmentsDueSoon: 3,
        });
    });
});
