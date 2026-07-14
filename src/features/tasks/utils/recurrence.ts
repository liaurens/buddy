import { addDays, addWeeks, addMonths, nextDay, getDay } from 'date-fns';
import type { RecurrencePattern, RecurrenceConfig } from '../types';

/**
 * Given a task's current dueDate and recurrence settings, returns the ISO
 * date string (YYYY-MM-DD) for the next occurrence.
 * Falls back to today as the base when no dueDate is provided.
 */
export function calculateNextDueDate(
    currentDueDate: string | undefined,
    recurrence: RecurrencePattern,
    config?: RecurrenceConfig,
): string | null {
    if (recurrence === 'none') return null;

    const base = currentDueDate ? new Date(currentDueDate) : new Date();

    switch (recurrence) {
        case 'daily':
            return addDays(base, config?.interval ?? 1)
                .toISOString()
                .split('T')[0];

        case 'weekdays': {
            let next = addDays(base, 1);
            while (getDay(next) === 0 || getDay(next) === 6) {
                next = addDays(next, 1);
            }
            return next.toISOString().split('T')[0];
        }

        case 'weekly': {
            if (config?.daysOfWeek && config.daysOfWeek.length > 0) {
                const sorted = [...config.daysOfWeek].sort((a, b) => a - b);
                const todayDow = getDay(base);
                // Find the next configured weekday strictly after today's day
                const nextDow = sorted.find((d) => d > todayDow) ?? sorted[0];
                const candidate = nextDay(base, nextDow as 0 | 1 | 2 | 3 | 4 | 5 | 6);
                return candidate.toISOString().split('T')[0];
            }
            return addWeeks(base, config?.interval ?? 1)
                .toISOString()
                .split('T')[0];
        }

        case 'monthly':
            return addMonths(base, config?.interval ?? 1)
                .toISOString()
                .split('T')[0];

        default:
            return null;
    }
}
