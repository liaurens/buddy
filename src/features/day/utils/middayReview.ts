import type { Task } from '../../tasks/types';

/** Split today's picks into still-open vs. completed. */
export function partitionPicks(picks: Task[]): { open: Task[]; done: Task[] } {
    const open: Task[] = [];
    const done: Task[] = [];
    for (const t of picks) {
        (t.completed ? done : open).push(t);
    }
    return { open, done };
}

/** Subtask completion progress, or null when the task has no subtasks. */
export function subtaskProgress(task: Task): { done: number; total: number } | null {
    const subs = task.subtasks;
    if (!subs || subs.length === 0) return null;
    return { done: subs.filter((s) => s.completed).length, total: subs.length };
}

/** True only when the task has subtasks and every one is complete. */
export function allSubtasksDone(task: Task): boolean {
    const subs = task.subtasks;
    return !!subs && subs.length > 0 && subs.every((s) => s.completed);
}

/** Tomorrow's date as yyyy-MM-dd (local), mirroring SnoozeMenu's date math. */
export function tomorrowIso(from: Date = new Date()): string {
    const d = new Date(from);
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
