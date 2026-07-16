import { addDays, format, isWeekend, subDays } from 'date-fns';
import type { RecurrencePattern, Task, TaskFlag, TriageSource } from '../types';

export const TASK_FLAGS: TaskFlag[] = [
    'urgent',
    'today',
    'deadline',
    'waiting',
    'school',
    'routine',
    'someday',
];

export const TASK_FLAG_META: Record<
    TaskFlag,
    { label: string; emoji: string; description: string }
> = {
    urgent: { label: 'Urgent', emoji: '🔥', description: 'Plan now, with smart reminders' },
    today: { label: 'Today', emoji: '📅', description: "Put it on today's plan" },
    deadline: { label: 'Deadline', emoji: '🎯', description: 'Track a real due date' },
    waiting: { label: 'Waiting', emoji: '⏳', description: 'Park until follow-up' },
    school: { label: 'School', emoji: '🎓', description: 'Connect to school work' },
    routine: { label: 'Routine', emoji: '🔁', description: 'Repeat on a cadence' },
    someday: { label: 'Someday', emoji: '🗂️', description: 'Keep without scheduling pressure' },
};

export interface UrgentPlanningContext {
    now: Date;
    explicitPlannedFor?: string;
    nightTime?: string;
    dayMode?: 'normal' | 'survival';
    plannedTaskCount?: number;
    normalTaskCapacity?: number;
    remainingCalendarMinutes?: number;
    estimatedMinutes?: number;
}

export interface CalendarBusyBlock {
    start: string | Date;
    end: string | Date;
}

/** Free minutes from now until the night boundary, merging overlapping events. */
export function remainingCalendarMinutes(
    blocks: CalendarBusyBlock[],
    now: Date,
    nightTime = '21:00',
): number {
    const night = minutesOfDay(nightTime) ?? 21 * 60;
    const boundary = new Date(now);
    boundary.setHours(Math.floor(night / 60), night % 60, 0, 0);
    if (boundary <= now) return 0;

    const clipped = blocks
        .map((block) => [new Date(block.start).getTime(), new Date(block.end).getTime()] as const)
        .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start)
        .map(
            ([start, end]) =>
                [Math.max(start, now.getTime()), Math.min(end, boundary.getTime())] as const,
        )
        .filter(([start, end]) => end > start)
        .sort((a, b) => a[0] - b[0]);

    let busyMs = 0;
    let cursorStart = 0;
    let cursorEnd = 0;
    for (const [start, end] of clipped) {
        if (start > cursorEnd) {
            busyMs += Math.max(0, cursorEnd - cursorStart);
            cursorStart = start;
            cursorEnd = end;
        } else {
            cursorEnd = Math.max(cursorEnd, end);
        }
    }
    busyMs += Math.max(0, cursorEnd - cursorStart);
    return Math.max(0, Math.floor((boundary.getTime() - now.getTime() - busyMs) / 60_000));
}

function iso(date: Date): string {
    return format(date, 'yyyy-MM-dd');
}

function minutesOfDay(value: string): number | null {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
}

/** Capacity-aware day selection for urgent tasks. */
export function selectUrgentPlannedDate(context: UrgentPlanningContext): string {
    if (context.explicitPlannedFor) return context.explicitPlannedFor;

    const today = iso(context.now);
    const tomorrow = iso(addDays(context.now, 1));
    const night = minutesOfDay(context.nightTime ?? '21:00') ?? 21 * 60;
    const beforeNight = context.now.getHours() * 60 + context.now.getMinutes() < night;
    const hasSlot = (context.plannedTaskCount ?? 0) < (context.normalTaskCapacity ?? 3);
    const load = context.estimatedMinutes ?? 30;
    const fits = load <= (context.remainingCalendarMinutes ?? Number.POSITIVE_INFINITY);

    return beforeNight && context.dayMode !== 'survival' && hasSlot && fits ? today : tomorrow;
}

/** First practical workday, using the estimate as a small amount of lead-time. */
export function suggestDeadlineWorkday(
    dueDate: string,
    estimatedMinutes = 30,
    now: Date = new Date(),
): string {
    const deadline = new Date(`${dueDate}T12:00:00`);
    const workdaysNeeded = Math.max(1, Math.ceil(estimatedMinutes / 120));
    let candidate = deadline;
    let remaining = workdaysNeeded;
    while (remaining > 0) {
        candidate = subDays(candidate, 1);
        if (!isWeekend(candidate)) remaining -= 1;
    }
    const today = iso(now);
    const result = iso(candidate);
    return result < today ? today : result;
}

export interface FlagEffectOptions extends Partial<UrgentPlanningContext> {
    now?: Date;
    source?: TriageSource;
    manuallyConfirmed?: boolean;
    waitingOn?: string;
    recurrence?: RecurrencePattern;
}

export interface FlagEffectResult {
    task: Task;
    errors: string[];
}

/**
 * Apply the complete, canonical field contract for one workflow flag.
 * The function is pure and preserves a real deadline unless the user edits it directly.
 */
export function applyTaskFlag(
    input: Task,
    flag: TaskFlag,
    options: FlagEffectOptions = {},
): FlagEffectResult {
    const now = options.now ?? new Date();
    const today = iso(now);
    const errors: string[] = [];
    let task: Task = {
        ...input,
        flag,
        triageSource: options.source ?? input.triageSource ?? 'manual',
    };

    switch (flag) {
        case 'today':
            task = { ...task, plannedFor: options.explicitPlannedFor ?? today };
            break;
        case 'urgent':
            task = {
                ...task,
                priority: 'urgent',
                reminderEnabled: true,
                reminderCadence: 'smart',
                plannedFor: selectUrgentPlannedDate({
                    now,
                    explicitPlannedFor: options.explicitPlannedFor ?? task.plannedFor,
                    nightTime: options.nightTime,
                    dayMode: options.dayMode,
                    plannedTaskCount: options.plannedTaskCount,
                    normalTaskCapacity: options.normalTaskCapacity,
                    remainingCalendarMinutes: options.remainingCalendarMinutes,
                    estimatedMinutes: task.estimatedTime ?? options.estimatedMinutes,
                }),
            };
            break;
        case 'deadline':
            if (!task.dueDate) errors.push('Deadline tasks require a real due date.');
            else if (!task.plannedFor) {
                task = {
                    ...task,
                    plannedFor: suggestDeadlineWorkday(task.dueDate, task.estimatedTime, now),
                };
            }
            task = { ...task, reminderEnabled: true, reminderCadence: 'smart' };
            break;
        case 'waiting': {
            const waitingOn = options.waitingOn ?? task.waitingOn;
            if (!waitingOn?.trim())
                errors.push('Waiting tasks require who or what you are waiting on.');
            task = {
                ...task,
                waitingOn: waitingOn?.trim() || undefined,
                plannedFor: options.explicitPlannedFor ?? task.plannedFor ?? iso(addDays(now, 3)),
                reminderEnabled: true,
                reminderCadence: 'single',
            };
            break;
        }
        case 'school':
            task = {
                ...task,
                triageDestination: 'school',
                reminderEnabled: Boolean(task.dueDate),
                reminderCadence: task.dueDate ? 'smart' : task.reminderCadence,
            };
            break;
        case 'routine': {
            const recurrence = options.recurrence ?? task.recurrence;
            if (!recurrence || recurrence === 'none') {
                if (options.manuallyConfirmed) task = { ...task, recurrence: 'daily' };
                else errors.push('Routine tasks require a recurrence.');
            }
            task = { ...task, reminderEnabled: true };
            break;
        }
        case 'someday':
            task = {
                ...task,
                plannedFor: undefined,
                reminderEnabled: false,
                reminderAt: undefined,
                reminderOffsetMinutes: undefined,
                reminderCadence: undefined,
            };
            break;
    }

    return { task, errors };
}

/** Compatibility mapping for rows written before flags existed. */
export function deriveTaskFlag(
    task: Pick<
        Task,
        | 'flag'
        | 'kind'
        | 'priority'
        | 'recurrence'
        | 'assignmentId'
        | 'triageDestination'
        | 'plannedFor'
        | 'dueDate'
        | 'waitingOn'
    >,
): TaskFlag {
    if (task.flag) return task.flag;
    if (task.assignmentId || task.triageDestination === 'school' || task.kind === 'school')
        return 'school';
    if (task.waitingOn || task.kind === 'waiting') return 'waiting';
    if ((task.recurrence && task.recurrence !== 'none') || task.kind === 'routine')
        return 'routine';
    if (task.priority === 'urgent' || task.kind === 'urgent') return 'urgent';
    if (task.kind === 'deadline') return 'deadline';
    if (task.plannedFor || task.kind === 'standard' || task.triageDestination === 'today')
        return 'today';
    if (task.dueDate) return 'deadline';
    return 'someday';
}

/** Legacy kind mirror. Reads may still rely on this during the rollout. */
export function flagToLegacyKind(flag: TaskFlag): Task['kind'] | undefined {
    switch (flag) {
        case 'today':
            return 'standard';
        case 'someday':
            return 'backlog';
        case 'school':
            return undefined;
        default:
            return flag;
    }
}
