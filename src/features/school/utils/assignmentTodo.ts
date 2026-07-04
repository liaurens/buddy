/**
 * assignmentTodo — pure builder for the todo that mirrors a school assignment.
 *
 * Every assignment gets a linked todo (todos.assignment_id) so its deadline
 * lives on the one trusted surface (task list / Next Up / morning pick)
 * instead of hiding inside the School module. Completing either side
 * completes the other (wired in useAssignments / useTasks).
 *
 * Pure: caller injects `now` so tests stay deterministic.
 */

import { format } from 'date-fns';
import type { Task } from '../../tasks/types';

export interface AssignmentTodoSource {
    id: string;
    title: string;
    /** timestamptz ISO string. */
    deadline: string;
    estimatedMinutes?: number | null;
}

export function buildAssignmentTodo(a: AssignmentTodoSource, now: Date): Omit<Task, 'id'> {
    return {
        title: a.title,
        completed: false,
        createdAt: now.toISOString(),
        // Local date of the deadline — a 23:30 deadline is still "due that day".
        dueDate: format(new Date(a.deadline), 'yyyy-MM-dd'),
        kind: 'deadline',
        priority: 'medium',
        estimatedTime: a.estimatedMinutes ?? undefined,
        assignmentId: a.id,
        triageDestination: 'school',
        // Skip the capture inbox — this task is already routed.
        triagedAt: now.toISOString(),
        // Deliberately NOT hardness:'fixed' — a locked task can never be pulled
        // into today by rescheduleMany / the morning pick.
        subtasks: [],
        recurrence: 'none',
    };
}
