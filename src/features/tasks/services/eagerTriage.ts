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
    triageTasks,
    type TriageAssignmentOption,
    type TriageTaskTypeOption,
} from '../../assistant/services/ai-actions.service';
import { sanitizeTriageSuggestions } from '../utils/sanitizeTriageSuggestions';
import { suggestionToDetail } from '../utils/triageConfidence';
import { loadTriageLearnings } from './triageLearnings';
import { applyTriage } from './applyTriage';
import type { Task } from '../types';
import { getCategorySettings } from '../../../services/settings';
import { remainingCalendarMinutes, selectUrgentPlannedDate } from '../utils/taskFlags';

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
    try {
        const now = new Date();
        const nowIso = now.toISOString();
        const todayIso = nowIso.slice(0, 10);
        const [learnings, assignmentOptions, typeOptions] = await Promise.all([
            loadTriageLearnings(userId),
            loadAssignmentOptions(userId),
            loadTaskTypeOptions(userId),
        ]);
        const result = await triageTasks({
            tasks: [
                {
                    id: task.id,
                    title: task.title,
                    dueDate: task.dueDate,
                    plannedFor: task.plannedFor,
                    flag: task.triageSource ? task.flag : undefined,
                    recurrence: task.recurrence,
                    priority: task.priority,
                    estimatedMinutes: task.estimatedTime,
                },
            ],
            assignments: assignmentOptions,
            learningsDoc: learnings,
            todayIso,
            taskTypes: typeOptions,
        });
        const [s] = sanitizeTriageSuggestions(
            result,
            [task.id],
            assignmentOptions.map((a) => a.id),
            typeOptions,
        );
        if (!s || s.confidence < 0.8) return; // unsure → leave for the Smart Inbox
        const detail = suggestionToDetail(s);
        if (s.destination === 'urgent' && !detail.plannedFor) {
            const endOfDay = new Date(`${todayIso}T23:59:59`);
            const [{ data: plan }, { count }, settings, eventsResult] = await Promise.all([
                supabase
                    .from('daily_plans')
                    .select('capacity')
                    .eq('user_id', userId)
                    .eq('date', todayIso)
                    .maybeSingle(),
                supabase
                    .from('todos')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', userId)
                    .eq('planned_for', todayIso)
                    .eq('completed', false),
                getCategorySettings(userId, 'notifications').catch(() => ({
                    nightTime: '21:00',
                })),
                supabase
                    .from('calendar_events')
                    .select('start_time, end_time')
                    .eq('user_id', userId)
                    .gte('end_time', nowIso)
                    .lte('start_time', endOfDay.toISOString()),
            ]);
            const freeMinutes = eventsResult.error
                ? undefined
                : remainingCalendarMinutes(
                      (eventsResult.data ?? []).map((event) => ({
                          start: event.start_time,
                          end: event.end_time,
                      })),
                      now,
                      settings.nightTime,
                  );
            detail.plannedFor = selectUrgentPlannedDate({
                now,
                dayMode: plan?.capacity === 'survival' ? 'survival' : 'normal',
                nightTime: settings.nightTime,
                plannedTaskCount: count ?? 0,
                remainingCalendarMinutes: freeMinutes,
                estimatedMinutes: detail.estimatedMinutes,
            });
        }
        await applyTriage(userId, task, s.destination, detail, {
            nowIso,
            todayIso,
            autoTriaged: true,
            confidence: s.confidence,
            reason: s.reason,
        });
    } catch (e) {
        console.warn('Eager triage skipped:', e);
    }
}
