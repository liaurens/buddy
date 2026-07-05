/**
 * Sanitize raw AI organize output into trustworthy suggestions.
 *
 * The model can hallucinate ids, invalid kinds, or malformed dates — never trust
 * it at a system boundary. This keeps only suggestions for known tasks and
 * clamps every field to a valid value, so the review UI and the eventual writes
 * are always safe.
 */

import type { Task, TaskType } from '../types';
import type { TaskOrganizationSuggestion } from '../../planning/services/ai.service';

// Writable kinds only — 'school' is derived from linkage, never assignable.
type SuggestionKind = TaskOrganizationSuggestion['kind'];
const VALID_KINDS: SuggestionKind[] = ['urgent', 'backlog', 'deadline', 'routine', 'standard'];
const VALID_PRIORITIES: TaskOrganizationSuggestion['priority'][] = ['urgent', 'high', 'medium', 'low'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface RawSuggestion {
    id?: unknown;
    taskTypeId?: unknown;
    kind?: unknown;
    priority?: unknown;
    dueDate?: unknown;
    reason?: unknown;
}

function asString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/**
 * @param raw  Either an array of suggestions or an object `{ suggestions: [...] }`.
 * @returns    One sanitized suggestion per known task id (first occurrence wins).
 */
export function sanitizeOrganizeSuggestions(
    raw: unknown,
    tasks: Pick<Task, 'id'>[],
    taskTypes: Pick<TaskType, 'id'>[],
): TaskOrganizationSuggestion[] {
    const list: unknown = Array.isArray(raw)
        ? raw
        : (raw as { suggestions?: unknown })?.suggestions;
    if (!Array.isArray(list)) return [];

    const taskIds = new Set(tasks.map(t => t.id));
    const typeIds = new Set(taskTypes.map(t => t.id));
    const seen = new Set<string>();
    const out: TaskOrganizationSuggestion[] = [];

    for (const entry of list as RawSuggestion[]) {
        const id = asString(entry?.id);
        if (!id || !taskIds.has(id) || seen.has(id)) continue;
        seen.add(id);

        const kindRaw = asString(entry?.kind) as SuggestionKind | null;
        const kind = kindRaw && VALID_KINDS.includes(kindRaw) ? kindRaw : 'standard';

        const prioRaw = asString(entry?.priority) as TaskOrganizationSuggestion['priority'] | null;
        const priority = prioRaw && VALID_PRIORITIES.includes(prioRaw) ? prioRaw : 'medium';

        const typeId = asString(entry?.taskTypeId);
        const taskTypeId = typeId && typeIds.has(typeId) ? typeId : null;

        const dueRaw = asString(entry?.dueDate);
        const dueDate = dueRaw && DATE_RE.test(dueRaw) ? dueRaw : null;

        out.push({
            id,
            taskTypeId,
            kind,
            priority,
            dueDate,
            reason: asString(entry?.reason) ?? '',
        });
    }

    return out;
}
