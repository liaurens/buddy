/**
 * useStreak Hook
 *
 * Provides streak data computed from the user's task completion history.
 * Re-computes when tasks change.
 */

import { useMemo } from 'react';
import { subDays } from 'date-fns';
import { useTasks } from './useTasks';
import { calculateStreak, getCompletionCalendar, type StreakData } from '../utils/streakCalculator';

export interface UseStreakReturn extends StreakData {
    /** Calendar heatmap data for the last 35 days (5 weeks) */
    calendarData: Map<string, number>;
    /** Consistency percentage (0-100) for last 30 days */
    consistencyPercent: number;
    /** Encouraging message based on current state */
    message: string;
}

function getStreakMessage(data: StreakData): string {
    if (data.completedToday && data.currentStreak >= 7) {
        return `${data.currentStreak} day streak! You're on fire.`;
    }
    if (data.completedToday) {
        return `Done for today! ${data.currentStreak} day streak.`;
    }
    if (data.atRisk) {
        return `Your ${data.currentStreak} day streak is at risk. Complete a task to keep it going!`;
    }
    if (data.currentStreak === 0 && data.last30DaysCompleted > 0) {
        return `You've completed tasks on ${data.last30DaysCompleted} of the last 30 days. Start a new streak today!`;
    }
    if (data.currentStreak === 0) {
        return 'Complete your first task to start a streak!';
    }
    return `${data.currentStreak} day streak. Complete a task to keep it going!`;
}

export function useStreak(): UseStreakReturn {
    const { tasks } = useTasks();

    return useMemo(() => {
        const today = new Date();
        const streakData = calculateStreak(tasks, today);
        const calendarData = getCompletionCalendar(tasks, subDays(today, 34), today);
        const consistencyPercent = Math.round((streakData.last30DaysCompleted / 30) * 100);
        const message = getStreakMessage(streakData);

        return {
            ...streakData,
            calendarData,
            consistencyPercent,
            message,
        };
    }, [tasks]);
}
