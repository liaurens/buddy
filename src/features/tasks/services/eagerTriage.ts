/**
 * Eager on-capture triage. Called fire-and-forget right after a task is captured:
 * if online + AI configured and the AI is confident, the task is sorted immediately
 * (auto_triaged=true). Otherwise it is left untriaged for the morning review batch.
 *
 * Writes straight to Supabase (no React) so it can run from the capture path. Always
 * non-fatal — capture must never fail because sorting failed.
 */

import { supabase } from '../../../services/supabase';
import {
    getAIService,
    isAIConfigured,
    type TriageAssignmentOption,
} from '../../planning/services/ai.service';
import { sanitizeTriageSuggestions } from '../utils/sanitizeTriageSuggestions';
import { suggestionToDetail } from '../utils/triageConfidence';
import { routeTaskPatch } from '../utils/triageRouting';
import { loadTriageLearnings } from './triageLearnings';
import type { Task } from '../types';

/** Map a routing patch to the snake_case columns the eager writer touches. */
function patchToColumns(patch: Partial<Task>): Record<string, unknown> {
    return {
        due_date: patch.dueDate ?? null,
        due_time: patch.dueTime ?? null,
        kind: patch.kind ?? null,
        recurrence: patch.recurrence ?? 'none',
        assignment_id: patch.assignmentId ?? null,
        location: patch.location ?? null,
        context: patch.context ?? null,
        energy: patch.energy ?? null,
        estimated_time: patch.estimatedTime ?? null,
        reminder_enabled: patch.reminderEnabled ?? false,
        reminder_cadence: patch.reminderCadence ?? null,
        hardness: patch.hardness ?? null,
        triaged_at: patch.triagedAt ?? new Date().toISOString(),
        triage_destination: patch.triageDestination ?? null,
        auto_triaged: true,
    };
}

export async function eagerTriageTask(
    userId: string,
    task: Task,
    assignmentOptions: TriageAssignmentOption[],
): Promise<void> {
    if (!isAIConfigured()) return;
    try {
        const ai = getAIService();
        if (!ai) return;
        const nowIso = new Date().toISOString();
        const todayIso = nowIso.slice(0, 10);
        const learnings = await loadTriageLearnings(userId);
        const result = await ai.triageTasks(
            [{ id: task.id, title: task.title, dueDate: task.dueDate, priority: task.priority }],
            assignmentOptions,
            learnings,
            todayIso,
        );
        if (!result.success || !result.data) return;
        const [s] = sanitizeTriageSuggestions(
            result.data,
            [task.id],
            assignmentOptions.map((a) => a.id),
        );
        if (!s || s.confidence !== 'high') return; // unsure → leave for the morning batch
        const patch = routeTaskPatch(s.destination, suggestionToDetail(s), { nowIso, todayIso });
        const { error } = await supabase
            .from('todos')
            .update(patchToColumns(patch))
            .eq('id', task.id)
            .eq('user_id', userId);
        if (error) console.warn('Eager triage write failed:', error.message);
    } catch (e) {
        console.warn('Eager triage skipped:', e);
    }
}
