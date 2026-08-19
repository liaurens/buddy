import type { Task } from '../types';

/** A task is in the capture inbox when it's active and not yet routed by triage. */
export function isInInbox(task: Task): boolean {
    return !task.completed && !task.triagedAt;
}

/** Count the active, untriaged tasks waiting in the capture inbox. */
export function countInbox(tasks: Task[]): number {
    return tasks.reduce((n, t) => (isInInbox(t) ? n + 1 : n), 0);
}

/**
 * Rotate skipped items to the back of the triage queue. "Not now" is not a
 * classification — nothing is written; the item just stops blocking the line.
 * Deferred items keep the order they were deferred in, so with everything
 * skipped the queue simply wraps around.
 */
export function rotateQueue<T extends { id: string }>(items: T[], deferredIds: string[]): T[] {
    if (deferredIds.length === 0) return items;
    const rank = new Map(deferredIds.map((id, i) => [id, i] as const));
    const front = items.filter((t) => !rank.has(t.id));
    const back = items
        .filter((t) => rank.has(t.id))
        .sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
    return [...front, ...back];
}
