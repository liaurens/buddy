/**
 * Pure helpers for the Today card numbers.
 *
 * The first screen must never under-report a deadline: overdue tasks and
 * school assignments are counted here alongside due-today tasks so the
 * Now page tells the truth at a glance.
 */

import { isSameDay, startOfDay, endOfDay, addDays } from 'date-fns';

/** Assignments with a deadline within this many days count as "due soon". */
export const ASSIGNMENT_HORIZON_DAYS = 7;

export interface TaskLike {
    completed: boolean;
    dueDate?: string;
}

export interface AssignmentLike {
    status: string;
    deadline: string;
}

export interface TodaySummary {
    /** Incomplete tasks with a due date before today. */
    overdue: number;
    /** Incomplete tasks due today. */
    dueToday: number;
    /** Active assignments (pending/in-progress) due within the horizon, including overdue ones. */
    assignmentsDueSoon: number;
}

const ACTIVE_ASSIGNMENT_STATUSES = new Set(['pending', 'in_progress']);

export function summarizeToday(
    tasks: readonly TaskLike[],
    assignments: readonly AssignmentLike[],
    now: Date = new Date(),
): TodaySummary {
    const todayStart = startOfDay(now);
    const assignmentHorizon = endOfDay(addDays(now, ASSIGNMENT_HORIZON_DAYS));

    let overdue = 0;
    let dueToday = 0;
    for (const task of tasks) {
        if (task.completed || !task.dueDate) continue;
        const due = new Date(task.dueDate);
        if (Number.isNaN(due.getTime())) continue;
        if (isSameDay(due, now)) {
            dueToday += 1;
        } else if (due < todayStart) {
            overdue += 1;
        }
    }

    let assignmentsDueSoon = 0;
    for (const assignment of assignments) {
        if (!ACTIVE_ASSIGNMENT_STATUSES.has(assignment.status)) continue;
        const deadline = new Date(assignment.deadline);
        if (Number.isNaN(deadline.getTime())) continue;
        if (deadline <= assignmentHorizon) {
            assignmentsDueSoon += 1;
        }
    }

    return { overdue, dueToday, assignmentsDueSoon };
}
