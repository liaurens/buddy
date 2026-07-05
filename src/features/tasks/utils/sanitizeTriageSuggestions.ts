/**
 * Sanitize raw AI triage output into trustworthy suggestions.
 *
 * The model can hallucinate ids, invalid destinations/enums, unknown assignment
 * ids, or malformed values — never trust it at a system boundary. This keeps only
 * suggestions for tasks actually in the inbox and clamps every field to a valid
 * value, so the review UI and the eventual writes are always safe.
 */

import type {
    TaskTriageSuggestion,
    TriageDestinationValue,
} from '../../planning/services/ai.service';
import type { RecurrencePattern, Hardness, TaskEnergy, TaskContext } from '../types';

const VALID_DESTINATIONS: TriageDestinationValue[] = [
    'urgent',
    'today',
    'someday',
    'school',
    'routine',
];
const VALID_RECURRENCE: RecurrencePattern[] = ['none', 'daily', 'weekly', 'monthly', 'weekdays'];
const VALID_HARDNESS: Hardness[] = ['fixed', 'flexible'];
const VALID_ENERGY: TaskEnergy[] = ['low', 'medium', 'high'];
const VALID_CONTEXT: TaskContext[] = ['computer', 'phone', 'home', 'out', 'anywhere'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_MINUTES = 1440; // one day
const MAX_LOCATION = 80;

interface RawSuggestion {
    id?: unknown;
    destination?: unknown;
    confidence?: unknown;
    hardness?: unknown;
    dueDate?: unknown;
    dueTime?: unknown;
    assignmentId?: unknown;
    recurrence?: unknown;
    location?: unknown;
    context?: unknown;
    energy?: unknown;
    estimatedMinutes?: unknown;
    taskTypeName?: unknown;
    reason?: unknown;
}

function asString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function asEnum<T extends string>(value: unknown, allowed: T[]): T | null {
    const s = asString(value);
    return s && (allowed as string[]).includes(s) ? (s as T) : null;
}

function asMinutes(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
    return Math.min(Math.round(value), MAX_MINUTES);
}

/**
 * @param raw           Either an array of suggestions or `{ suggestions: [...] }`.
 * @param inboxIds      Ids of tasks currently in the inbox — others are dropped.
 * @param assignmentIds Known assignment ids — a "school" suggestion to an unknown
 *                      id keeps the school destination but with a null assignment
 *                      (a loose school task), so it can't silently vanish.
 * @param taskTypes     The user's real task types; the AI's taskTypeName resolves
 *                      to an id case-insensitively, unknown names become null.
 * @returns             One sanitized suggestion per known task id (first wins).
 */
export function sanitizeTriageSuggestions(
    raw: unknown,
    inboxIds: Iterable<string>,
    assignmentIds: Iterable<string>,
    taskTypes: Iterable<{ id: string; name: string }> = [],
): TaskTriageSuggestion[] {
    const list: unknown = Array.isArray(raw)
        ? raw
        : (raw as { suggestions?: unknown })?.suggestions;
    if (!Array.isArray(list)) return [];

    const ids = new Set(inboxIds);
    const assignments = new Set(assignmentIds);
    const typeIdByName = new Map(
        Array.from(taskTypes, (t) => [t.name.trim().toLowerCase(), t.id] as const),
    );
    const seen = new Set<string>();
    const out: TaskTriageSuggestion[] = [];

    for (const entry of list as RawSuggestion[]) {
        const id = asString(entry?.id);
        if (!id || !ids.has(id) || seen.has(id)) continue;
        seen.add(id);

        const destRaw = asString(entry?.destination) as TriageDestinationValue | null;
        const destination: TriageDestinationValue =
            destRaw && VALID_DESTINATIONS.includes(destRaw) ? destRaw : 'today';

        // School keeps its destination even with an unknown assignment — it becomes a
        // loose school task (assignmentId null) so it still surfaces in school planning.
        const assignmentRaw = asString(entry?.assignmentId);
        const assignmentId = assignmentRaw && assignments.has(assignmentRaw) ? assignmentRaw : null;

        const timeRaw = asString(entry?.dueTime);
        const dueTime =
            destination === 'today' && timeRaw && TIME_RE.test(timeRaw) ? timeRaw : null;

        const dateRaw = asString(entry?.dueDate);
        const dueDate = dateRaw && DATE_RE.test(dateRaw) ? dateRaw : null;

        const recRaw = asString(entry?.recurrence) as RecurrencePattern | null;
        const recurrence =
            destination === 'routine'
                ? recRaw && VALID_RECURRENCE.includes(recRaw) && recRaw !== 'none'
                    ? recRaw
                    : 'daily'
                : null;

        const locRaw = asString(entry?.location);
        const location = locRaw ? locRaw.trim().slice(0, MAX_LOCATION) : null;

        out.push({
            id,
            destination,
            confidence: entry?.confidence === 'high' ? 'high' : 'low',
            hardness: asEnum<Hardness>(entry?.hardness, VALID_HARDNESS),
            dueDate,
            dueTime,
            assignmentId: destination === 'school' ? assignmentId : null,
            recurrence,
            location,
            context: asEnum<TaskContext>(entry?.context, VALID_CONTEXT),
            energy: asEnum<TaskEnergy>(entry?.energy, VALID_ENERGY),
            estimatedMinutes: asMinutes(entry?.estimatedMinutes),
            taskTypeId:
                typeIdByName.get(asString(entry?.taskTypeName)?.trim().toLowerCase() ?? '') ??
                null,
            reason: asString(entry?.reason) ?? '',
        });
    }

    return out;
}
