/**
 * Task Kind — behavioral classification.
 *
 * Hybrid model: a task may carry an explicit `kind`, but when it doesn't we derive
 * one from the signals the task already has (school linkage, recurrence, priority,
 * due date, reminder). This keeps the list sortable by behavior without forcing the
 * user to classify everything by hand, while still letting an explicit choice win.
 *
 * 'school' is derived-only: it comes from assignmentId / triage destination and is
 * never written to the todos.kind column (the DB CHECK doesn't allow it either).
 */

import type { Task, TaskKind } from '../types';
import { daysUntilDue } from './dueDates';

/** A due date this many days out (or more) reads as a "deadline" item. */
export const DEADLINE_HORIZON_DAYS = 3;

/**
 * Resolve the effective kind of a task.
 * Precedence: explicit kind → school → routine → urgent → deadline → standard → backlog.
 *
 * @param today Injectable clock for deterministic tests; defaults to now.
 */
export function deriveTaskKind(task: Pick<Task,
    'kind' | 'recurrence' | 'priority' | 'dueDate' | 'reminderEnabled' | 'reminderAt'
    | 'assignmentId' | 'triageDestination'
>, today: Date = new Date()): TaskKind {
    if (task.kind) return task.kind;

    // School linkage wins over date signals — a school task belongs under
    // School, not "Someday" or "Standard".
    if (task.assignmentId || task.triageDestination === 'school') return 'school';

    if (task.recurrence && task.recurrence !== 'none') return 'routine';
    if (task.priority === 'urgent') return 'urgent';

    if (task.dueDate) {
        const daysOut = daysUntilDue(task.dueDate, today);
        if (daysOut >= DEADLINE_HORIZON_DAYS) return 'deadline';
        return 'standard';
    }

    return 'backlog';
}

export interface TaskKindMeta {
    label: string;
    emoji: string;
    /** Tailwind palette name used for chips/sections (matches existing theme usage). */
    color: 'rose' | 'indigo' | 'amber' | 'violet' | 'slate' | 'emerald';
    description: string;
}

export const TASK_KIND_META: Record<TaskKind, TaskKindMeta> = {
    urgent: { label: 'Urgent', emoji: '🔥', color: 'rose', description: 'Big deal — schedule it now' },
    standard: { label: 'Standard', emoji: '✅', color: 'indigo', description: 'Everyday task with a day' },
    deadline: { label: 'Deadline', emoji: '🎯', color: 'amber', description: 'Due later — remind me as it nears' },
    school: { label: 'School', emoji: '🎓', color: 'emerald', description: 'Linked to your classes' },
    routine: { label: 'Routine', emoji: '🔁', color: 'violet', description: 'Repeats on a schedule' },
    backlog: { label: 'Someday', emoji: '🗂️', color: 'slate', description: 'No pressure — stays until you pick it' },
};

/** Display order for grouping kinds in the task list (most pressing first). */
export const TASK_KIND_ORDER: TaskKind[] = ['urgent', 'deadline', 'school', 'standard', 'routine', 'backlog'];

/** Kinds a user may pick explicitly ('school' is derived from linkage only). */
export const PICKABLE_TASK_KINDS: TaskKind[] = ['urgent', 'deadline', 'standard', 'routine', 'backlog'];

/**
 * Canonical signal write-through: when a kind is chosen explicitly, seed the signal
 * that derivation reads from so the two never drift. Returns a patch to merge onto the task.
 */
export function kindSignalPatch(kind: TaskKind): Partial<Task> {
    switch (kind) {
        case 'urgent':
            return { kind, priority: 'urgent' };
        case 'routine':
            // Caller supplies the actual cadence; default to daily if none set yet.
            return { kind };
        case 'school':
            // Derived-only: never write 'school' to the kind column.
            return {};
        default:
            return { kind };
    }
}
