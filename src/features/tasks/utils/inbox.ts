import type { Task } from '../types';

/** A task is in the capture inbox when it's active and not yet routed by triage. */
export function isInInbox(task: Task): boolean {
    return !task.completed && !task.triagedAt;
}

/** Count the active, untriaged tasks waiting in the capture inbox. */
export function countInbox(tasks: Task[]): number {
    return tasks.reduce((n, t) => (isInInbox(t) ? n + 1 : n), 0);
}
