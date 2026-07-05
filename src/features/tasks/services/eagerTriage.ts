/**
 * Eager on-capture triage. Called fire-and-forget right after a task is captured:
 * if online + AI configured and the AI is confident, the task is sorted immediately
 * (auto_triaged=true). Otherwise it is left untriaged for the morning review batch.
 *
 * Routing goes through applyTriage — the same write path as manual triage — so an
 * eagerly-sorted task is byte-identical to a hand-sorted one (kind⇒priority
 * write-through, reminder scheduling, Google mirror included). Always non-fatal —
 * capture must never fail because sorting failed.
 */

import { supabase } from '../../../services/supabase';
import {
    getAIService,
    isAIConfigured,
    type TriageAssignmentOption,
    type TriageTaskTypeOption,
} from '../../planning/services/ai.service';
import { sanitizeTriageSuggestions } from '../utils/sanitizeTriageSuggestions';
import { suggestionToDetail } from '../utils/triageConfidence';
import { loadTriageLearnings } from './triageLearnings';
import { applyTriage } from './applyTriage';
import type { Task } from '../types';

/** The user's active assignments, so eager sorting can route school tasks too. */
async function loadAssignmentOptions(userId: string): Promise<TriageAssignmentOption[]> {
    const { data, error } = await supabase
        .from('assignments')
        .select('id, title')
        .eq('user_id', userId)
        .in('status', ['pending', 'in_progress']);
    if (error) {
        console.warn('Eager triage: could not load assignments:', error.message);
        return [];
    }
    return (data ?? []).map((a: { id: string; title: string }) => ({ id: a.id, title: a.title }));
}

/** The user's task types, so eager sorting can assign one. */
async function loadTaskTypeOptions(userId: string): Promise<TriageTaskTypeOption[]> {
    const { data, error } = await supabase
        .from('task_types')
        .select('id, name')
        .eq('user_id', userId);
    if (error) {
        console.warn('Eager triage: could not load task types:', error.message);
        return [];
    }
    return (data ?? []).map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }));
}

export async function eagerTriageTask(userId: string, task: Task): Promise<void> {
    if (!isAIConfigured()) return;
    try {
        const ai = getAIService();
        if (!ai) return;
        const nowIso = new Date().toISOString();
        const todayIso = nowIso.slice(0, 10);
        const [learnings, assignmentOptions, typeOptions] = await Promise.all([
            loadTriageLearnings(userId),
            loadAssignmentOptions(userId),
            loadTaskTypeOptions(userId),
        ]);
        const result = await ai.triageTasks(
            [{ id: task.id, title: task.title, dueDate: task.dueDate, priority: task.priority }],
            assignmentOptions,
            learnings,
            todayIso,
            typeOptions,
        );
        if (!result.success || !result.data) return;
        const [s] = sanitizeTriageSuggestions(
            result.data,
            [task.id],
            assignmentOptions.map((a) => a.id),
            typeOptions,
        );
        if (!s || s.confidence !== 'high') return; // unsure → leave for the morning batch
        await applyTriage(userId, task, s.destination, suggestionToDetail(s), {
            nowIso,
            todayIso,
            autoTriaged: true,
        });
    } catch (e) {
        console.warn('Eager triage skipped:', e);
    }
}
