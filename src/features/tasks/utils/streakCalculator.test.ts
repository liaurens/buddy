import { describe, it, expect } from 'vitest';
import { calculateStreak, getCompletionCalendar } from './streakCalculator';
import { format, subDays } from 'date-fns';
import type { Task } from '../types';

function makeTask(overrides: Partial<Task> = {}): Task {
    return {
        id: overrides.id || '1',
        title: overrides.title || 'Test task',
        completed: overrides.completed ?? false,
        createdAt: overrides.createdAt || new Date().toISOString(),
        ...overrides,
    };
}

function makeCompletedTask(completedAt: Date, id?: string): Task {
    return makeTask({
        id: id || `task-${completedAt.toISOString()}`,
        completed: true,
        completedAt: completedAt.toISOString(),
        createdAt: completedAt.toISOString(),
    });
}

describe('calculateStreak', () => {
    const today = new Date('2026-02-25T12:00:00');

    it('returns zero streak with no tasks', () => {
        const result = calculateStreak([], today);
        expect(result.currentStreak).toBe(0);
        expect(result.longestStreak).toBe(0);
        expect(result.last30DaysCompleted).toBe(0);
        expect(result.completedToday).toBe(false);
        expect(result.atRisk).toBe(false);
    });

    it('returns zero streak with only incomplete tasks', () => {
        const tasks = [makeTask({ id: '1' }), makeTask({ id: '2' })];
        const result = calculateStreak(tasks, today);
        expect(result.currentStreak).toBe(0);
        expect(result.completedToday).toBe(false);
    });

    it('counts streak of 1 when only today has a completion', () => {
        const tasks = [makeCompletedTask(today)];
        const result = calculateStreak(tasks, today);
        expect(result.currentStreak).toBe(1);
        expect(result.completedToday).toBe(true);
    });

    it('counts consecutive day streak', () => {
        const tasks = [
            makeCompletedTask(today),
            makeCompletedTask(subDays(today, 1)),
            makeCompletedTask(subDays(today, 2)),
        ];
        const result = calculateStreak(tasks, today);
        expect(result.currentStreak).toBe(3);
    });

    it('allows one grace day (Never Miss Twice rule)', () => {
        // Completed today, missed yesterday, completed day before
        const tasks = [
            makeCompletedTask(today),
            makeCompletedTask(subDays(today, 2)),
            makeCompletedTask(subDays(today, 3)),
        ];
        const result = calculateStreak(tasks, today);
        // Should count: today + day-2 + day-3 = 3 (skipping day-1 with grace)
        expect(result.currentStreak).toBe(3);
    });

    it('breaks streak after two consecutive missed days', () => {
        // Completed today, missed yesterday AND day before
        const tasks = [
            makeCompletedTask(today),
            makeCompletedTask(subDays(today, 3)),
            makeCompletedTask(subDays(today, 4)),
        ];
        const result = calculateStreak(tasks, today);
        // Two missed days in a row (day-1, day-2) should break the streak
        expect(result.currentStreak).toBe(1);
    });

    it('detects at-risk streak (completed yesterday but not today)', () => {
        const tasks = [
            makeCompletedTask(subDays(today, 1)),
            makeCompletedTask(subDays(today, 2)),
        ];
        const result = calculateStreak(tasks, today);
        expect(result.atRisk).toBe(true);
        expect(result.completedToday).toBe(false);
        expect(result.currentStreak).toBe(2);
    });

    it('returns zero streak when neither today nor yesterday completed', () => {
        const tasks = [
            makeCompletedTask(subDays(today, 3)),
            makeCompletedTask(subDays(today, 4)),
        ];
        const result = calculateStreak(tasks, today);
        expect(result.currentStreak).toBe(0);
        expect(result.atRisk).toBe(false);
    });

    it('calculates longest streak correctly', () => {
        // Old streak of 5 days, current streak of 2
        const tasks = [
            makeCompletedTask(today),
            makeCompletedTask(subDays(today, 1)),
            // gap
            makeCompletedTask(subDays(today, 10)),
            makeCompletedTask(subDays(today, 11)),
            makeCompletedTask(subDays(today, 12)),
            makeCompletedTask(subDays(today, 13)),
            makeCompletedTask(subDays(today, 14)),
        ];
        const result = calculateStreak(tasks, today);
        expect(result.currentStreak).toBe(2);
        expect(result.longestStreak).toBe(5);
    });

    it('counts last 30 days completions', () => {
        const tasks = [
            makeCompletedTask(today),
            makeCompletedTask(subDays(today, 5)),
            makeCompletedTask(subDays(today, 10)),
            makeCompletedTask(subDays(today, 29)), // Still within 30 days
            makeCompletedTask(subDays(today, 35)), // Outside 30 days
        ];
        const result = calculateStreak(tasks, today);
        expect(result.last30DaysCompleted).toBe(4);
    });

    it('uses createdAt as fallback when completedAt is missing', () => {
        const tasks = [
            makeTask({
                id: '1',
                completed: true,
                createdAt: format(today, "yyyy-MM-dd'T'HH:mm:ss"),
                // no completedAt
            }),
        ];
        const result = calculateStreak(tasks, today);
        expect(result.completedToday).toBe(true);
        expect(result.currentStreak).toBe(1);
    });

    it('deduplicates multiple completions on the same day', () => {
        const tasks = [
            makeCompletedTask(today, 'task-1'),
            makeCompletedTask(today, 'task-2'),
            makeCompletedTask(today, 'task-3'),
        ];
        const result = calculateStreak(tasks, today);
        expect(result.currentStreak).toBe(1);
        expect(result.completionDates.size).toBe(1);
    });

    it('handles long streak correctly', () => {
        const tasks: Task[] = [];
        for (let i = 0; i < 30; i++) {
            tasks.push(makeCompletedTask(subDays(today, i)));
        }
        const result = calculateStreak(tasks, today);
        expect(result.currentStreak).toBe(30);
        expect(result.longestStreak).toBe(30);
        expect(result.last30DaysCompleted).toBe(30);
    });
});

describe('getCompletionCalendar', () => {
    const today = new Date('2026-02-25T12:00:00');

    it('returns map with all dates in range initialized to 0', () => {
        const start = subDays(today, 6);
        const calendar = getCompletionCalendar([], start, today);
        expect(calendar.size).toBe(7);
        for (const count of calendar.values()) {
            expect(count).toBe(0);
        }
    });

    it('counts completions per day', () => {
        const tasks = [
            makeCompletedTask(today, 'task-1'),
            makeCompletedTask(today, 'task-2'),
            makeCompletedTask(subDays(today, 1), 'task-3'),
        ];
        const start = subDays(today, 6);
        const calendar = getCompletionCalendar(tasks, start, today);

        const todayStr = format(today, 'yyyy-MM-dd');
        const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd');
        expect(calendar.get(todayStr)).toBe(2);
        expect(calendar.get(yesterdayStr)).toBe(1);
    });

    it('ignores completions outside the date range', () => {
        const start = subDays(today, 2);
        const tasks = [
            makeCompletedTask(subDays(today, 5)), // outside range
        ];
        const calendar = getCompletionCalendar(tasks, start, today);
        for (const count of calendar.values()) {
            expect(count).toBe(0);
        }
    });

    it('ignores incomplete tasks', () => {
        const tasks = [makeTask({ id: '1', completed: false })];
        const start = subDays(today, 6);
        const calendar = getCompletionCalendar(tasks, start, today);
        for (const count of calendar.values()) {
            expect(count).toBe(0);
        }
    });
});
