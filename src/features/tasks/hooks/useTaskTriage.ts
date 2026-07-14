/**
 * useTaskTriage — the brains of the self-sorting inbox.
 *
 * Pulls the capture inbox (active, untriaged), asks the AI to profile each task,
 * AUTO-APPLIES the high-confidence ones, and exposes the low-confidence ones for a
 * human call. Auto-applied tasks remain reviewable (autoSortedToday) so the user can
 * correct them; corrections feed the learning doc so the AI gets more cautious.
 * Eager on-capture sorting lives in services/eagerTriage.ts; both paths build
 * the final task via applyTriagePatch so results are byte-identical.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isSameDay } from 'date-fns';
import { useAuth } from '../../../hooks/useAuth';
import { useTasks } from './useTasks';
import { useTaskTypes } from './useTaskTypes';
import { useAssignments } from '../../school/hooks/useAssignments';
import { useClasses } from '../../school/hooks/useClasses';
import {
    getAIConfigStatus,
    triageTasks,
    type TaskTriageSuggestion,
    type TriageAssignmentOption,
} from '../../assistant/services/ai-actions.service';
import { sanitizeTriageSuggestions } from '../utils/sanitizeTriageSuggestions';
import { splitByConfidence, suggestionToDetail } from '../utils/triageConfidence';
import {
    isDestinationReady,
    type TriageDestination,
    type TriageDetail,
} from '../utils/triageRouting';
import { applyTriagePatch } from '../services/applyTriage';
import { isInInbox } from '../utils/inbox';
import {
    loadTriageLearnings,
    recordTriageCorrections,
    type TriageCorrection,
} from '../services/triageLearnings';
import type { Task } from '../types';

/** One resolved routing decision, ready to apply. */
export interface TriageDecision {
    taskId: string;
    destination: TriageDestination;
    detail: TriageDetail;
    /** What the AI originally proposed — a mismatch becomes a learned correction. */
    aiDestination: TriageDestination;
    /** True when correcting a task the AI had auto-applied. */
    wasAuto?: boolean;
}

export interface UseTaskTriageReturn {
    /** AI provider configured — when false the user can still sort manually. */
    ready: boolean;
    /** Untriaged tasks the AI was not confident about — need a human call. */
    reviewInbox: Task[];
    /** Tasks the AI auto-applied today — reviewable, tap to correct. */
    autoSortedToday: Task[];
    assignmentOptions: TriageAssignmentOption[];
    suggestions: TaskTriageSuggestion[] | undefined;
    isFetching: boolean;
    error: unknown;
    refetch: () => void;
    /** Apply the routes; returns how many tasks were routed. */
    applyRoutes: (decisions: TriageDecision[]) => Promise<number>;
}

export function useTaskTriage(): UseTaskTriageReturn {
    const { user } = useAuth();
    const userId = user?.id;
    const { tasks, updateTask } = useTasks();
    const { taskTypes } = useTaskTypes();
    const { assignments } = useAssignments({ activeOnly: true });
    const { classes } = useClasses();
    const [ready, setReady] = useState(false);

    // Untriaged, active capture inbox — same selector as the count badges.
    const untriaged = useMemo(() => tasks.filter(isInInbox), [tasks]);

    const autoSortedToday = useMemo(() => {
        const now = new Date();
        return tasks.filter(
            (t) => t.autoTriaged && t.triagedAt && isSameDay(new Date(t.triagedAt), now),
        );
    }, [tasks]);

    const assignmentOptions = useMemo<TriageAssignmentOption[]>(() => {
        const classNameById = new Map(classes.map((c) => [c.id, c.name]));
        return assignments.map((a) => ({
            id: a.id,
            title: a.title,
            className: classNameById.get(a.classId),
        }));
    }, [assignments, classes]);

    useEffect(() => {
        if (!userId) return;
        void getAIConfigStatus()
            .then((status) => setReady(status.configured))
            .catch(() => setReady(false));
    }, [userId]);

    const inboxKey = untriaged.map((t) => t.id).join(',');
    const assignmentsKey = assignmentOptions.map((a) => a.id).join(',');
    const typeOptions = useMemo(
        () => taskTypes.map((t) => ({ id: t.id, name: t.name })),
        [taskTypes],
    );
    const {
        data: suggestions,
        isFetching,
        error,
        refetch,
    } = useQuery({
        queryKey: ['triage-tasks', inboxKey, assignmentsKey, typeOptions.length],
        enabled: ready && untriaged.length > 0,
        staleTime: Infinity,
        gcTime: 0,
        retry: false,
        queryFn: async () => {
            const todayIso = new Date().toISOString().slice(0, 10);
            const learnings = userId ? await loadTriageLearnings(userId) : '';
            const result = await triageTasks({
                tasks: untriaged.map((t) => ({
                    id: t.id,
                    title: t.title,
                    dueDate: t.dueDate,
                    priority: t.priority,
                })),
                assignments: assignmentOptions,
                learningsDoc: learnings,
                todayIso,
                taskTypes: typeOptions,
            });
            return sanitizeTriageSuggestions(
                result,
                untriaged.map((t) => t.id),
                assignmentOptions.map((a) => a.id),
                typeOptions,
            );
        },
    });

    // Auto-apply failures must not vanish: a task whose write failed is still
    // untriaged, so it re-enters the review inbox instead of hiding forever
    // behind the "high confidence" filter (count and list stay in agreement).
    const [failedAutoApply, setFailedAutoApply] = useState<Set<string>>(new Set());

    // Auto-apply the high-confidence suggestions (silent). Membership in `untriaged`
    // is itself the dedup guard: once a task is applied it gets a triagedAt and leaves
    // `untriaged`, so it can't be picked up again — and the effect short-circuits when
    // nothing fresh remains, so it can't loop (failed ids are excluded from retries).
    useEffect(() => {
        if (!userId || !suggestions) return;
        const byId = new Map(untriaged.map((t) => [t.id, t]));
        const { autoApply } = splitByConfidence(suggestions);
        const fresh = autoApply.filter((s) => byId.has(s.id) && !failedAutoApply.has(s.id));
        if (fresh.length === 0) return;
        const nowIso = new Date().toISOString();
        const todayIso = nowIso.slice(0, 10);
        void (async () => {
            const failed: string[] = [];
            for (const s of fresh) {
                const task = byId.get(s.id);
                if (!task) continue;
                try {
                    await updateTask(
                        applyTriagePatch(task, s.destination, suggestionToDetail(s), {
                            nowIso,
                            todayIso,
                            autoTriaged: true,
                        }),
                    );
                } catch (e) {
                    console.warn('Auto-apply failed; task returned to review inbox:', e);
                    failed.push(s.id);
                }
            }
            if (failed.length > 0) {
                setFailedAutoApply((prev) => new Set([...prev, ...failed]));
            }
        })();
    }, [suggestions, untriaged, userId, updateTask, failedAutoApply]);

    // The review section: untriaged tasks the AI was NOT confident about, plus any
    // whose auto-apply write failed. High-confidence tasks being applied right now
    // are hidden to avoid a flash before they leave.
    const reviewInbox = useMemo(() => {
        const highConfidence = new Set(
            (suggestions ?? []).filter((s) => s.confidence === 'high').map((s) => s.id),
        );
        return untriaged.filter((t) => !highConfidence.has(t.id) || failedAutoApply.has(t.id));
    }, [untriaged, suggestions, failedAutoApply]);

    const applyRoutes = useCallback(
        async (decisions: TriageDecision[]): Promise<number> => {
            if (!userId) return 0;
            const nowIso = new Date().toISOString();
            const todayIso = nowIso.slice(0, 10);
            const byId = new Map(tasks.map((t) => [t.id, t]));
            const corrections: TriageCorrection[] = [];
            let applied = 0;

            for (const d of decisions) {
                const task = byId.get(d.taskId);
                if (!task || !isDestinationReady(d.destination, d.detail)) continue;
                // A human confirmed/corrected this — it is no longer an unreviewed auto-apply.
                await updateTask(
                    applyTriagePatch(task, d.destination, d.detail, {
                        nowIso,
                        todayIso,
                        autoTriaged: false,
                    }),
                );
                applied += 1;
                if (d.destination !== d.aiDestination) {
                    corrections.push({
                        title: task.title,
                        aiDestination: d.aiDestination,
                        correctDestination: d.destination,
                        wasAuto: d.wasAuto,
                    });
                }
            }
            await recordTriageCorrections(userId, corrections, nowIso);
            return applied;
        },
        [userId, tasks, updateTask],
    );

    return {
        ready,
        reviewInbox,
        autoSortedToday,
        assignmentOptions,
        suggestions,
        isFetching,
        error,
        refetch,
        applyRoutes,
    };
}
