import { differenceInCalendarDays, format, subDays } from 'date-fns';
import type { RecurrencePattern, Task } from '../types';
import { calculateNextDueDate } from './recurrence';
import { parseDueDate } from './dueDates';

export const SOMEDAY_REVIEW_DAYS = 28;
export const ROUTINE_MISS_THRESHOLD = 3;

function todayIso(now: Date): string {
    return format(now, 'yyyy-MM-dd');
}

export function isWaitingParked(task: Pick<Task, 'kind' | 'dueDate'>, now: Date): boolean {
    return task.kind === 'waiting' && Boolean(task.dueDate && task.dueDate > todayIso(now));
}

export function isDeadlineParked(task: Pick<Task, 'kind' | 'startDate'>, now: Date): boolean {
    return task.kind === 'deadline' && Boolean(task.startDate && task.startDate > todayIso(now));
}

export function isTaskParked(
    task: Pick<Task, 'kind' | 'dueDate' | 'startDate'>,
    now: Date,
): boolean {
    return isWaitingParked(task, now) || isDeadlineParked(task, now);
}

export function suggestedDeadlineStart(dueDate: string, now: Date): string {
    const today = todayIso(now);
    const suggested = format(subDays(parseDueDate(dueDate), 3), 'yyyy-MM-dd');
    return suggested < today ? today : suggested;
}

export function isDeadlineStartSlipped(
    task: Pick<Task, 'kind' | 'startDate' | 'lastTouchedAt' | 'createdAt' | 'completed'>,
    now: Date,
): boolean {
    if (task.completed || task.kind !== 'deadline' || !task.startDate) return false;
    if (task.startDate >= todayIso(now)) return false;
    const touched = (task.lastTouchedAt ?? task.createdAt).slice(0, 10);
    return touched < task.startDate;
}

export function isSomedayReviewEligible(
    task: Pick<Task, 'kind' | 'lastTouchedAt' | 'createdAt' | 'completed'>,
    now: Date,
): boolean {
    if (task.completed || task.kind !== 'backlog') return false;
    const touched = new Date(task.lastTouchedAt ?? task.createdAt);
    return differenceInCalendarDays(now, touched) >= SOMEDAY_REVIEW_DAYS;
}

export function pickSomedayReview(tasks: Task[], now: Date): Task | null {
    return (
        tasks
            .filter((task) => isSomedayReviewEligible(task, now))
            .sort((a, b) =>
                (a.lastTouchedAt ?? a.createdAt).localeCompare(b.lastTouchedAt ?? b.createdAt),
            )[0] ?? null
    );
}

export function missedRoutineOccurrences(
    dueDate: string | undefined,
    recurrence: RecurrencePattern | undefined,
    now: Date,
): number {
    if (!dueDate || !recurrence || recurrence === 'none' || dueDate >= todayIso(now)) return 0;
    let cursor = dueDate;
    let missed = 0;
    while (cursor < todayIso(now) && missed < 366) {
        missed += 1;
        const next = calculateNextDueDate(cursor, recurrence);
        if (!next || next <= cursor) break;
        cursor = next;
    }
    return missed;
}

export function needsRoutineDecision(
    task: Pick<Task, 'dueDate' | 'recurrence'>,
    now: Date,
): boolean {
    return missedRoutineOccurrences(task.dueDate, task.recurrence, now) >= ROUTINE_MISS_THRESHOLD;
}

export function taskFitsHomeDay(
    task: Pick<Task, 'taskTypeId'>,
    homeDaysByType: ReadonlyMap<string, number[]>,
    now: Date,
): boolean {
    return Boolean(task.taskTypeId && homeDaysByType.get(task.taskTypeId)?.includes(now.getDay()));
}
