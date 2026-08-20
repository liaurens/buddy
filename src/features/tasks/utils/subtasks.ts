/**
 * Subtasks — the small steps under a task.
 *
 * Pure, immutable helpers so the detail sheet can edit a draft's steps without
 * reaching for array mutation. Ids are injected by the caller (the sheet passes
 * uuid) to keep these testable and free of side effects.
 */

import type { Subtask } from '../types';

/** Toggle one step's completion. Unknown ids leave the list untouched. */
export function toggleSubtask(subtasks: Subtask[] | undefined, id: string): Subtask[] {
    return (subtasks ?? []).map((s) => (s.id === id ? { ...s, completed: !s.completed } : s));
}

/**
 * Append a step. Blank titles are ignored — the sheet's add-input calls this on
 * every Enter, and an empty step is noise nobody can tick off.
 */
export function addSubtask(subtasks: Subtask[] | undefined, title: string, id: string): Subtask[] {
    const trimmed = title.trim();
    const current = subtasks ?? [];
    if (!trimmed) return current;
    return [...current, { id, title: trimmed, completed: false }];
}

/** Drop one step. */
export function removeSubtask(subtasks: Subtask[] | undefined, id: string): Subtask[] {
    return (subtasks ?? []).filter((s) => s.id !== id);
}

/** The first unfinished step, or null when there is nothing left to do. */
export function nextSubtask(subtasks: Subtask[] | undefined): Subtask | null {
    return (subtasks ?? []).find((s) => !s.completed) ?? null;
}

/** "2/5" progress, or null when there are no steps. */
export function subtaskProgress(
    subtasks: Subtask[] | undefined,
): { done: number; total: number } | null {
    const list = subtasks ?? [];
    if (list.length === 0) return null;
    return { done: list.filter((s) => s.completed).length, total: list.length };
}
