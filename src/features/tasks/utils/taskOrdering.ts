/**
 * taskOrdering — the one canonical order for task lists.
 *
 * Every view (type groups, schedule buckets, kind groups) sorts with this
 * comparator, so the same tasks appear in the same relative order everywhere:
 * recommender score desc → due date asc (undated last) → created asc → id.
 * Deterministic: equal inputs always produce the same order.
 */

import type { Task } from '../types';

const UNDATED = '9999-99-99';
const FLAG_ORDER: Record<NonNullable<Task['flag']>, number> = {
    urgent: 0,
    today: 1,
    deadline: 2,
    school: 3,
    routine: 4,
    waiting: 5,
    someday: 6,
};

/** Canonical comparator. `scoreById` comes from getRankedTasks. */
export function compareTasks(a: Task, b: Task, scoreById: Map<string, number>): number {
    const scoreDiff = (scoreById.get(b.id) ?? 0) - (scoreById.get(a.id) ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    const aPlan = a.plannedFor ?? UNDATED;
    const bPlan = b.plannedFor ?? UNDATED;
    if (aPlan !== bPlan) return aPlan.localeCompare(bPlan);
    const flagDiff = (a.flag ? FLAG_ORDER[a.flag] : 99) - (b.flag ? FLAG_ORDER[b.flag] : 99);
    if (flagDiff !== 0) return flagDiff;
    const aDue = a.dueDate ?? UNDATED;
    const bDue = b.dueDate ?? UNDATED;
    if (aDue !== bDue) return aDue.localeCompare(bDue);
    const byAge = a.createdAt.localeCompare(b.createdAt);
    if (byAge !== 0) return byAge;
    return a.id.localeCompare(b.id);
}

/** Return a new array sorted canonically (input untouched). */
export function sortTasksCanonical(tasks: Task[], scoreById: Map<string, number>): Task[] {
    return [...tasks].sort((a, b) => compareTasks(a, b, scoreById));
}

/** A task you can knock out in a spare quarter hour. */
export const QUICK_WIN_MINUTES = 15;

export function isQuickWin(task: Task): boolean {
    return !task.completed && !!task.estimatedTime && task.estimatedTime <= QUICK_WIN_MINUTES;
}
