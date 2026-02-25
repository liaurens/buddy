import { describe, it, expect } from 'vitest';
import { getRecommendedTask, getRankedTasks } from './taskRecommender';
import { format, addDays, subDays } from 'date-fns';
import type { Task } from '../types';

function makeTask(overrides: Partial<Task> = {}): Task {
    return {
        id: overrides.id || '1',
        title: overrides.title || 'Test task',
        completed: false,
        createdAt: new Date().toISOString(),
        ...overrides,
    };
}

const today = new Date('2026-02-25T12:00:00');

describe('getRecommendedTask', () => {
    it('returns null when no tasks', () => {
        expect(getRecommendedTask([], today)).toBeNull();
    });

    it('returns null when all tasks are completed', () => {
        const tasks = [makeTask({ completed: true })];
        expect(getRecommendedTask(tasks, today)).toBeNull();
    });

    it('returns the only active task', () => {
        const tasks = [makeTask({ id: '1', title: 'Only task' })];
        const result = getRecommendedTask(tasks, today);
        expect(result).not.toBeNull();
        expect(result!.task.title).toBe('Only task');
    });

    it('recommends overdue task over due-today task', () => {
        const tasks = [
            makeTask({ id: '1', title: 'Due today', dueDate: format(today, 'yyyy-MM-dd'), priority: 'medium' }),
            makeTask({ id: '2', title: 'Overdue', dueDate: format(subDays(today, 2), 'yyyy-MM-dd'), priority: 'medium' }),
        ];
        const result = getRecommendedTask(tasks, today);
        expect(result!.task.title).toBe('Overdue');
    });

    it('recommends due-today task over future task', () => {
        const tasks = [
            makeTask({ id: '1', title: 'Due next week', dueDate: format(addDays(today, 7), 'yyyy-MM-dd'), priority: 'medium' }),
            makeTask({ id: '2', title: 'Due today', dueDate: format(today, 'yyyy-MM-dd'), priority: 'medium' }),
        ];
        const result = getRecommendedTask(tasks, today);
        expect(result!.task.title).toBe('Due today');
    });

    it('recommends higher priority when no due dates', () => {
        const tasks = [
            makeTask({ id: '1', title: 'Low', priority: 'low' }),
            makeTask({ id: '2', title: 'Urgent', priority: 'urgent' }),
            makeTask({ id: '3', title: 'Medium', priority: 'medium' }),
        ];
        const result = getRecommendedTask(tasks, today);
        expect(result!.task.title).toBe('Urgent');
    });

    it('recommends due-tomorrow task over far-future task', () => {
        const tasks = [
            makeTask({ id: '1', title: 'Far future', dueDate: format(addDays(today, 30), 'yyyy-MM-dd'), priority: 'medium' }),
            makeTask({ id: '2', title: 'Due tomorrow', dueDate: format(addDays(today, 1), 'yyyy-MM-dd'), priority: 'medium' }),
        ];
        const result = getRecommendedTask(tasks, today);
        expect(result!.task.title).toBe('Due tomorrow');
    });

    it('provides the first incomplete subtask', () => {
        const tasks = [
            makeTask({
                id: '1',
                title: 'Parent',
                subtasks: [
                    { id: 'st-1', title: 'Done subtask', completed: true },
                    { id: 'st-2', title: 'Next subtask', completed: false },
                    { id: 'st-3', title: 'Later subtask', completed: false },
                ],
            }),
        ];
        const result = getRecommendedTask(tasks, today);
        expect(result!.subtask).not.toBeNull();
        expect(result!.subtask!.title).toBe('Next subtask');
    });

    it('returns null subtask when all subtasks are completed', () => {
        const tasks = [
            makeTask({
                id: '1',
                title: 'Parent',
                subtasks: [
                    { id: 'st-1', title: 'Done 1', completed: true },
                    { id: 'st-2', title: 'Done 2', completed: true },
                ],
            }),
        ];
        const result = getRecommendedTask(tasks, today);
        expect(result!.subtask).toBeNull();
    });

    it('returns null subtask when task has no subtasks', () => {
        const tasks = [makeTask({ id: '1' })];
        const result = getRecommendedTask(tasks, today);
        expect(result!.subtask).toBeNull();
    });

    it('includes a reason string', () => {
        const tasks = [
            makeTask({ id: '1', dueDate: format(today, 'yyyy-MM-dd'), priority: 'high' }),
        ];
        const result = getRecommendedTask(tasks, today);
        expect(result!.reason).toContain('due today');
        expect(result!.reason).toContain('high priority');
    });
});

describe('getRankedTasks', () => {
    it('returns empty array when no tasks', () => {
        expect(getRankedTasks([], today)).toEqual([]);
    });

    it('excludes completed tasks', () => {
        const tasks = [
            makeTask({ id: '1', completed: true }),
            makeTask({ id: '2', completed: false, title: 'Active' }),
        ];
        const result = getRankedTasks(tasks, today);
        expect(result).toHaveLength(1);
        expect(result[0].task.title).toBe('Active');
    });

    it('ranks tasks in descending score order', () => {
        const tasks = [
            makeTask({ id: '1', title: 'Low prio', priority: 'low' }),
            makeTask({ id: '2', title: 'Overdue', dueDate: format(subDays(today, 3), 'yyyy-MM-dd'), priority: 'medium' }),
            makeTask({ id: '3', title: 'High prio', priority: 'high' }),
        ];
        const result = getRankedTasks(tasks, today);
        expect(result[0].task.title).toBe('Overdue');
        expect(result[0].score).toBeGreaterThan(result[1].score);
        expect(result[1].score).toBeGreaterThan(result[2].score);
    });

    it('more overdue items score higher (capped)', () => {
        const tasks = [
            makeTask({ id: '1', title: '1 day overdue', dueDate: format(subDays(today, 1), 'yyyy-MM-dd'), priority: 'medium' }),
            makeTask({ id: '2', title: '5 days overdue', dueDate: format(subDays(today, 5), 'yyyy-MM-dd'), priority: 'medium' }),
        ];
        const result = getRankedTasks(tasks, today);
        expect(result[0].task.title).toBe('5 days overdue');
        expect(result[0].score).toBeGreaterThan(result[1].score);
    });

    it('tasks due this week score higher than tasks due later', () => {
        const tasks = [
            makeTask({ id: '1', title: 'Due in 3 days', dueDate: format(addDays(today, 3), 'yyyy-MM-dd'), priority: 'medium' }),
            makeTask({ id: '2', title: 'Due in 14 days', dueDate: format(addDays(today, 14), 'yyyy-MM-dd'), priority: 'medium' }),
        ];
        const result = getRankedTasks(tasks, today);
        expect(result[0].task.title).toBe('Due in 3 days');
        expect(result[0].score).toBeGreaterThan(result[1].score);
    });

    it('tasks without due dates are scored only by priority', () => {
        const tasks = [
            makeTask({ id: '1', title: 'No date high', priority: 'high' }),
            makeTask({ id: '2', title: 'No date low', priority: 'low' }),
        ];
        const result = getRankedTasks(tasks, today);
        expect(result[0].task.title).toBe('No date high');
        expect(result[0].score).toBe(40); // high = 40
        expect(result[1].score).toBe(10); // low = 10
    });
});
