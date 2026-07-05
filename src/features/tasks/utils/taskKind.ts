/**
 * Task Kind — behavioral classification.
 *
 * Hybrid model: a task may carry an explicit `kind`, but when it doesn't we derive
 * one from the signals the task already has (recurrence, priority, due date, reminder).
 * This keeps the list sortable by behavior without forcing the user to classify
 * everything by hand, while still letting an explicit choice win.
 */

import type { Task, TaskKind } from '../types';
import { daysUntilDue } from './dueDates';

/** A due date this many days out (or more) with a reminder reads as a "deadline" item. */
export const DEADLINE_HORIZON_DAYS = 3;

/**
 * Resolve the effective kind of a task.
 * Precedence: explicit kind → routine → urgent → deadline → backlog → standard.
 *
 * @param today Injectable clock for deterministic tests; defaults to now.
 */
export function deriveTaskKind(task: Pick<Task,
    'kind' | 'recurrence' | 'priority' | 'dueDate' | 'reminderEnabled' | 'reminderAt'
>, today: Date = new Date()): TaskKind {
    if (task.kind) return task.kind;

    if (task.recurrence && task.recurrence !== 'none') return 'routine';
    if (task.priority === 'urgent') return 'urgent';

    if (task.dueDate) {
        const daysOut = daysUntilDue(task.dueDate, today);
        const hasReminder = !!task.reminderEnabled || !!task.reminderAt;
        if (daysOut >= DEADLINE_HORIZON_DAYS && hasReminder) return 'deadline';
        return 'standard';
    }

    return 'backlog';
}

export interface TaskKindMeta {
    label: string;
    emoji: string;
    /** Tailwind palette name used for chips/sections (matches existing theme usage). */
    color: 'rose' | 'indigo' | 'amber' | 'violet' | 'slate';
    description: string;
}

export const TASK_KIND_META: Record<TaskKind, TaskKindMeta> = {
    urgent: { label: 'Urgent', emoji: '🔥', color: 'rose', description: 'Big deal — schedule it now' },
    standard: { label: 'Standard', emoji: '✅', color: 'indigo', description: 'Everyday task with a day' },
    deadline: { label: 'Deadline', emoji: '🎯', color: 'amber', description: 'Due later — remind me as it nears' },
    routine: { label: 'Routine', emoji: '🔁', color: 'violet', description: 'Repeats on a schedule' },
    backlog: { label: 'Someday', emoji: '🗂️', color: 'slate', description: 'No pressure — stays until you pick it' },
};

/** Display order for grouping kinds in the task list (most pressing first). */
export const TASK_KIND_ORDER: TaskKind[] = ['urgent', 'deadline', 'standard', 'routine', 'backlog'];

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
        default:
            return { kind };
    }
}
