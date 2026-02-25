/**
 * Streak Calculator
 *
 * Computes habit streak data from task completion timestamps.
 * Uses a "Never Miss Twice" rule: streak only breaks after 2 consecutive missed days.
 * Also tracks consistency rate (completions / total days in period).
 */

import { startOfDay, subDays, differenceInCalendarDays, format, isSameDay } from 'date-fns';
import type { Task } from '../types';

export interface StreakData {
    /** Current consecutive day streak (with 1 grace day) */
    currentStreak: number;
    /** Longest streak ever achieved */
    longestStreak: number;
    /** Number of days with completions in the last 30 days */
    last30DaysCompleted: number;
    /** Set of date strings (YYYY-MM-DD) that had at least one completion */
    completionDates: Set<string>;
    /** Whether today has a completed task */
    completedToday: boolean;
    /** Whether yesterday was missed (streak at risk) */
    atRisk: boolean;
}

/**
 * Extract unique completion dates from tasks
 */
function getCompletionDates(tasks: Task[]): Set<string> {
    const dates = new Set<string>();
    for (const task of tasks) {
        if (task.completed && task.completedAt) {
            dates.add(format(new Date(task.completedAt), 'yyyy-MM-dd'));
        } else if (task.completed && task.createdAt) {
            // Fallback: use createdAt if completedAt not set
            dates.add(format(new Date(task.createdAt), 'yyyy-MM-dd'));
        }
    }
    return dates;
}

/**
 * Calculate streak with "Never Miss Twice" grace rule.
 * A single missed day doesn't break the streak, but two in a row does.
 */
function calculateStreakWithGrace(completionDates: Set<string>, today: Date): { current: number; longest: number; atRisk: boolean } {
    const todayStr = format(today, 'yyyy-MM-dd');
    const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd');

    const hasToday = completionDates.has(todayStr);
    const hasYesterday = completionDates.has(yesterdayStr);

    // Walk backwards from today counting streak
    let current = 0;
    let gracesUsed = 0;
    const maxGraces = 1; // "Never Miss Twice" = 1 grace day
    let day = today;

    // If today isn't completed yet, start from yesterday
    if (!hasToday) {
        day = subDays(today, 1);
        if (!hasYesterday) {
            // Neither today nor yesterday - streak is 0
            return { current: 0, longest: calculateLongestStreak(completionDates), atRisk: false };
        }
    }

    // Walk backwards
    while (true) {
        const dateStr = format(day, 'yyyy-MM-dd');
        if (completionDates.has(dateStr)) {
            current++;
            gracesUsed = 0; // Reset grace counter on active days
        } else {
            gracesUsed++;
            if (gracesUsed > maxGraces) {
                break;
            }
            // Grace day - don't increment streak but continue counting
        }
        day = subDays(day, 1);

        // Safety: don't go back more than 1000 days
        if (differenceInCalendarDays(today, day) > 1000) break;
    }

    const atRisk = !hasToday && hasYesterday;
    const longest = calculateLongestStreak(completionDates);

    return {
        current,
        longest: Math.max(current, longest),
        atRisk,
    };
}

/**
 * Calculate the longest streak in the completion history (no grace)
 */
function calculateLongestStreak(completionDates: Set<string>): number {
    if (completionDates.size === 0) return 0;

    const sortedDates = Array.from(completionDates).sort();
    let longest = 1;
    let current = 1;

    for (let i = 1; i < sortedDates.length; i++) {
        const prev = new Date(sortedDates[i - 1]);
        const curr = new Date(sortedDates[i]);
        const diff = differenceInCalendarDays(curr, prev);

        if (diff === 1) {
            current++;
            longest = Math.max(longest, current);
        } else if (diff > 1) {
            current = 1;
        }
        // diff === 0 means same day, skip
    }

    return longest;
}

/**
 * Main function: calculate all streak data from tasks
 */
export function calculateStreak(tasks: Task[], today: Date = new Date()): StreakData {
    const completionDates = getCompletionDates(tasks);
    const todayStr = format(today, 'yyyy-MM-dd');
    const completedToday = completionDates.has(todayStr);

    const { current, longest, atRisk } = calculateStreakWithGrace(completionDates, today);

    // Count completions in last 30 days
    let last30DaysCompleted = 0;
    for (let i = 0; i < 30; i++) {
        const dateStr = format(subDays(today, i), 'yyyy-MM-dd');
        if (completionDates.has(dateStr)) {
            last30DaysCompleted++;
        }
    }

    return {
        currentStreak: current,
        longestStreak: longest,
        last30DaysCompleted,
        completionDates,
        completedToday,
        atRisk,
    };
}

/**
 * Get completion dates for a calendar range (for heatmap display)
 */
export function getCompletionCalendar(tasks: Task[], startDate: Date, endDate: Date): Map<string, number> {
    const calendar = new Map<string, number>();
    const totalDays = differenceInCalendarDays(endDate, startDate) + 1;

    // Initialize all dates with 0
    for (let i = 0; i < totalDays; i++) {
        const dateStr = format(subDays(endDate, totalDays - 1 - i), 'yyyy-MM-dd');
        calendar.set(dateStr, 0);
    }

    // Count completions per day
    for (const task of tasks) {
        if (task.completed) {
            const dateStr = task.completedAt
                ? format(new Date(task.completedAt), 'yyyy-MM-dd')
                : format(new Date(task.createdAt), 'yyyy-MM-dd');

            const current = calendar.get(dateStr);
            if (current !== undefined) {
                calendar.set(dateStr, current + 1);
            }
        }
    }

    return calendar;
}
