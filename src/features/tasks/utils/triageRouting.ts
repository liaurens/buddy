/**
 * Triage routing — turn a chosen destination into the task patch that "sends"
 * a captured task to the right part of the app.
 *
 * Each destination reuses an existing flow rather than inventing a new one:
 *   urgent  → flagged urgent + left unscheduled, so the home Urgent inbox forces
 *             a when/prep decision and writes it to Google Calendar.
 *   today   → due today (optional start time) so it lands on the day timeline.
 *   someday → backlog kind, no pressure.
 *   school  → linked to an assignment (which moves it out of the todo list into
 *             the school feature).
 *   routine → recurring, so it derives to the routine kind.
 *
 * Pure: no I/O, no Date.now() — callers pass the timestamps so it stays testable.
 */

import type { Task, RecurrencePattern, Hardness, TaskEnergy, TaskContext } from '../types';

export type TriageDestination = 'urgent' | 'today' | 'someday' | 'school' | 'routine';

export interface TriageDestinationMeta {
    label: string;
    emoji: string;
    /** Tailwind palette name used for chips (matches existing kind chips). */
    color: 'rose' | 'indigo' | 'amber' | 'violet' | 'slate';
    description: string;
    /** Whether the destination needs extra input before it can be applied. */
    needs?: 'assignment' | 'cadence';
}

export const TRIAGE_DESTINATION_META: Record<TriageDestination, TriageDestinationMeta> = {
    urgent: {
        label: 'Urgent',
        emoji: '🔥',
        color: 'rose',
        description: 'Schedule it on your calendar',
    },
    today: { label: 'Today', emoji: '📅', color: 'indigo', description: "Onto today's plan" },
    school: {
        label: 'School',
        emoji: '🎓',
        color: 'amber',
        description: 'Link to a class',
        needs: 'assignment',
    },
    routine: {
        label: 'Routine',
        emoji: '🔁',
        color: 'violet',
        description: 'Repeats on a schedule',
        needs: 'cadence',
    },
    someday: {
        label: 'Someday',
        emoji: '🗂️',
        color: 'slate',
        description: 'No pressure — stays until you pick it',
    },
};

/** Chip display order (most pressing first). */
export const TRIAGE_DESTINATION_ORDER: TriageDestination[] = [
    'urgent',
    'today',
    'school',
    'routine',
    'someday',
];

/** Extra input a destination may need to be actionable. */
export interface TriageDetail {
    /** today: optional start time, HH:MM. */
    time?: string;
    /** school: the assignment to link the task to (optional — unmatched = loose school task). */
    assignmentId?: string;
    /** routine: the cadence to repeat on (defaults to daily). */
    recurrence?: RecurrencePattern;
    /** Can the planner move it? */
    hardness?: Hardness;
    location?: string;
    context?: TaskContext;
    energy?: TaskEnergy;
    estimatedMinutes?: number;
    /** User-defined task type to assign (validated upstream). */
    taskTypeId?: string;
}

/**
 * Build the field patch that routes a task to a destination. Merge onto the task
 * and persist via useTasks.updateTask.
 *
 * @param opts.nowIso   ISO timestamp to stamp `triagedAt` with.
 * @param opts.todayIso Today's date (YYYY-MM-DD) for the "today" destination.
 */
/** Reminder cadence implied by hardness: fixed tasks escalate, flexible ones nudge once. */
function cadenceForHardness(hardness?: Hardness): Task['reminderCadence'] | undefined {
    if (hardness === 'fixed') return 'smart';
    if (hardness === 'flexible') return 'single';
    return undefined;
}

/** Fields every destination writes from the inferred profile. */
function profilePatch(
    destination: TriageDestination,
    detail: TriageDetail,
    triagedAt: string,
): Partial<Task> {
    return {
        triagedAt,
        triageDestination: destination,
        autoTriaged: false,
        hardness: detail.hardness,
        location: detail.location,
        context: detail.context,
        energy: detail.energy,
        estimatedTime: detail.estimatedMinutes,
        taskTypeId: detail.taskTypeId,
        reminderEnabled: detail.hardness ? true : undefined,
        reminderCadence: cadenceForHardness(detail.hardness),
    };
}

export function routeTaskPatch(
    destination: TriageDestination,
    detail: TriageDetail,
    opts: { nowIso: string; todayIso: string },
): Partial<Task> {
    const base = profilePatch(destination, detail, opts.nowIso);

    switch (destination) {
        case 'urgent':
            // Flag urgent, drop any do-date — the Urgent inbox owns scheduling.
            return { ...base, kind: 'urgent', dueDate: undefined, dueTime: undefined };
        case 'today':
            return { ...base, dueDate: opts.todayIso, dueTime: detail.time, kind: undefined };
        case 'someday':
            return { ...base, kind: 'backlog', dueDate: undefined, dueTime: undefined };
        case 'school':
            // assignmentId optional: unmatched school items become loose school tasks.
            return { ...base, assignmentId: detail.assignmentId };
        case 'routine':
            return { ...base, kind: 'routine', recurrence: detail.recurrence ?? 'daily' };
    }
}

/**
 * A destination is ready to apply. Every destination is now applicable on its own;
 * school without an assignment becomes a loose school task that still surfaces in
 * school planning.
 */
export function isDestinationReady(
    _destination: TriageDestination,
    _detail: TriageDetail,
): boolean {
    return true;
}

/** A task is locked (planner must not auto-move it) when it is fixed AND has a date. */
export function isLocked(task: Pick<Task, 'hardness' | 'dueDate'>): boolean {
    return task.hardness === 'fixed' && !!task.dueDate;
}

/**
 * The destination an explicit capture kind implies, so kind-stamped captures
 * carry a truthful `triageDestination` like routed ones do. The dated kinds
 * (standard/deadline) map to the dated destination.
 */
export function kindToDestination(kind: NonNullable<Task['kind']>): TriageDestination {
    switch (kind) {
        case 'urgent':
            return 'urgent';
        case 'backlog':
        case 'waiting':
            return 'someday';
        case 'routine':
            return 'routine';
        case 'school':
            // Not pickable at capture (derived-only kind), but total for safety.
            return 'school';
        case 'deadline':
        case 'standard':
            return 'today';
    }
}
