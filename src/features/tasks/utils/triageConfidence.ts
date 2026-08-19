/**
 * Pure helpers bridging AI suggestions and routing decisions, kept out of the
 * hook so the confidence/auto-apply logic is unit-testable.
 */

import type { TaskTriageSuggestion } from '../../assistant/services/ai-actions.service';
import type { TriageDestination, TriageDetail } from './triageRouting';

/** High-confidence suggestions are safe to apply silently; the rest need a human. */
export function splitByConfidence(suggestions: TaskTriageSuggestion[]): {
    autoApply: TaskTriageSuggestion[];
    review: TaskTriageSuggestion[];
} {
    const autoApply: TaskTriageSuggestion[] = [];
    const review: TaskTriageSuggestion[] = [];
    for (const s of suggestions) (s.confidence >= 0.8 ? autoApply : review).push(s);
    return { autoApply, review };
}

/** Map a suggestion to the detail routeTaskPatch expects for its destination. */
export function suggestionToDetail(s: TaskTriageSuggestion): TriageDetail {
    const detail: TriageDetail = {};
    if (s.destination === 'today' && s.dueTime) detail.time = s.dueTime;
    if (s.dueDate) detail.dueDate = s.dueDate;
    if (s.plannedFor) detail.plannedFor = s.plannedFor;
    if (s.waitingOn) detail.waitingOn = s.waitingOn;
    if (s.destination === 'school' && s.assignmentId) detail.assignmentId = s.assignmentId;
    if (s.destination === 'routine') detail.recurrence = s.recurrence ?? 'daily';
    if (s.hardness) detail.hardness = s.hardness;
    if (s.location) detail.location = s.location;
    if (s.context) detail.context = s.context;
    if (s.energy) detail.energy = s.energy;
    if (s.estimatedMinutes != null) detail.estimatedMinutes = s.estimatedMinutes;
    if (s.taskTypeId) detail.taskTypeId = s.taskTypeId;
    return detail;
}

/**
 * The AI detail a tap should carry to its destination.
 *
 * Agreeing with the suggestion keeps everything. Routing somewhere else keeps
 * only the destination-independent profile (estimate, energy, type, context,
 * location, hardness) and drops destination-specific fields (dates, waitingOn,
 * recurrence, assignment). Before this, a mismatched tap dropped the whole
 * profile — racing the AI silently threw its work away.
 */
export function mergeProfileDetail(
    aiDetail: TriageDetail,
    tapped: TriageDestination,
    suggested: TriageDestination | undefined,
): TriageDetail {
    if (suggested === tapped) return { ...aiDetail };
    const detail: TriageDetail = {};
    if (aiDetail.estimatedMinutes != null) detail.estimatedMinutes = aiDetail.estimatedMinutes;
    if (aiDetail.energy) detail.energy = aiDetail.energy;
    if (aiDetail.taskTypeId) detail.taskTypeId = aiDetail.taskTypeId;
    if (aiDetail.context) detail.context = aiDetail.context;
    if (aiDetail.location) detail.location = aiDetail.location;
    if (aiDetail.hardness) detail.hardness = aiDetail.hardness;
    return detail;
}
