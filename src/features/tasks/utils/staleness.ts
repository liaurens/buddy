/**
 * Staleness — is this task stuck?
 *
 * A task reads as stuck when it keeps getting pushed (snoozed twice or more)
 * or when it's due/overdue and hasn't been touched in a couple of days. At
 * that moment the UI offers a one-tap "split this" instead of another guilt
 * pass — micro-splitting at the point of avoidance.
 *
 * Pure: callers inject the clock.
 */

import { differenceInCalendarDays, format } from 'date-fns';
import type { Task } from '../types';

export const STALE_UNTOUCHED_DAYS = 2;
export const STALE_SNOOZE_COUNT = 2;

/**
 * Does this due-date change count as a snooze? Only pushes AWAY from
 * today-or-earlier to a later date — picking a date for an undated task or
 * pulling a task closer is planning, not avoidance.
 */
export function isSnooze(
    prevDueDate: string | undefined,
    nextDueDate: string | undefined,
    today: string,
): boolean {
    if (!prevDueDate || !nextDueDate) return false;
    return prevDueDate <= today && nextDueDate > prevDueDate;
}

/** Whether any subtask progress was made (some but not all complete). */
function hasSubtaskProgress(task: Task): boolean {
    const subs = task.subtasks ?? [];
    if (subs.length === 0) return false;
    return subs.some((s) => s.completed);
}

/**
 * A task is stale when incomplete, showing no subtask progress, and either
 * snoozed repeatedly or sitting untouched at/past its due date.
 */
export function isStale(task: Task, now: Date): boolean {
    if (task.completed) return false;
    if (hasSubtaskProgress(task)) return false;

    if ((task.snoozeCount ?? 0) >= STALE_SNOOZE_COUNT) return true;

    if (!task.dueDate) return false;
    const today = format(now, 'yyyy-MM-dd');
    if (task.dueDate > today) return false;

    const lastTouched = new Date(task.lastTouchedAt ?? task.createdAt);
    return differenceInCalendarDays(now, lastTouched) >= STALE_UNTOUCHED_DAYS;
}
