/**
 * AIOrganizeModal — batch "organize my inbox" review.
 *
 * Asks the AI to propose a type / kind / priority / due date for unorganized
 * tasks, then lets the user approve, adjust, or skip each one before anything is
 * written. The AI proposes; the user decides.
 *
 * Mount this conditionally (only while open) so its review state starts fresh
 * each time and is discarded on close.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, Loader2, AlertCircle, X, Check, SkipForward } from 'lucide-react';
import { getAIService, isAIConfigured, initializeAIService } from '../../planning/services/ai.service';
import type { TaskOrganizationSuggestion } from '../../planning/services/ai.service';
import { useAuth } from '../../../hooks/useAuth';
import { supabase } from '../../../services/supabase';
import { sanitizeOrganizeSuggestions } from '../utils/organizeSuggestions';
import { TASK_KIND_META, TASK_KIND_ORDER, kindSignalPatch } from '../utils/taskKind';
import type { Task, TaskType } from '../types';

interface AIOrganizeModalProps {
    candidates: Task[];
    taskTypes: TaskType[];
    onApply: (updated: Task[]) => void;
    onClose: () => void;
}

const PRIORITIES: TaskOrganizationSuggestion['priority'][] = ['urgent', 'high', 'medium', 'low'];

/** Merge an (edited) suggestion onto its task, keeping kind/priority signals consistent. */
function applySuggestion(task: Task, s: TaskOrganizationSuggestion): Task {
    return {
        ...task,
        taskTypeId: s.taskTypeId ?? undefined,
        priority: s.priority,
        dueDate: s.dueDate ?? task.dueDate,
        ...kindSignalPatch(s.kind),
    };
}

const AIOrganizeModal: React.FC<AIOrganizeModalProps> = ({ candidates, taskTypes, onApply, onClose }) => {
    const { user } = useAuth();
    const [ready, setReady] = useState(isAIConfigured());
    // Per-task local edits + skip flags, keyed by task id. Reset on remount.
    const [overrides, setOverrides] = useState<Record<string, Partial<TaskOrganizationSuggestion>>>({});
    const [skipped, setSkipped] = useState<Record<string, boolean>>({});

    // Lazily hydrate the AI service from saved settings (same pattern as
    // AITaskSplitter). setState here runs after an await, so it is not a
    // synchronous-in-effect update.
    useEffect(() => {
        if (!user?.id || ready) return;
        void (async () => {
            const { data } = await supabase
                .from('settings')
                .select('key, value')
                .eq('user_id', user.id)
                .in('key', ['ai_aiProvider', 'ai_aiApiKey', 'ai_aiModel']);
            if (!data) return;
            const m = data.reduce((acc, s) => { acc[s.key] = s.value; return acc; }, {} as Record<string, string>);
            const provider = m['ai_aiProvider'] as 'openai' | 'anthropic' | 'gemini' | undefined;
            const apiKey = m['ai_aiApiKey'];
            if (provider && apiKey) {
                initializeAIService({ provider, apiKey, model: m['ai_aiModel'] || undefined });
                setReady(true);
            }
        })();
    }, [user?.id, ready]);

    const candidateKey = candidates.map(c => c.id).join(',');
    const { data: suggestions, isFetching, error, refetch } = useQuery({
        queryKey: ['organize-tasks', candidateKey],
        enabled: ready && candidates.length > 0,
        staleTime: Infinity,
        gcTime: 0,
        retry: false,
        queryFn: async () => {
            const ai = getAIService();
            if (!ai) throw new Error('AI not configured. Set up an AI provider in Account settings.');
            const todayIso = new Date().toISOString().slice(0, 10);
            const result = await ai.organizeTasks(
                candidates.map(t => ({ id: t.id, title: t.title, priority: t.priority, dueDate: t.dueDate })),
                taskTypes.map(t => ({ id: t.id, name: t.name })),
                todayIso,
            );
            if (!result.success || !result.data) throw new Error(result.error || 'Failed to organize tasks.');
            return sanitizeOrganizeSuggestions(result.data, candidates, taskTypes);
        },
    });

    const rows = useMemo(() => {
        if (!suggestions) return [];
        const byId = new Map(candidates.map(c => [c.id, c]));
        return suggestions
            .filter(s => byId.has(s.id))
            .map(s => ({
                task: byId.get(s.id)!,
                suggestion: { ...s, ...overrides[s.id] } as TaskOrganizationSuggestion,
                skipped: !!skipped[s.id],
            }));
    }, [suggestions, candidates, overrides, skipped]);

    const editRow = (id: string, patch: Partial<TaskOrganizationSuggestion>) => {
        setOverrides(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    };
    const setSkip = (id: string, value: boolean) => {
        setSkipped(prev => ({ ...prev, [id]: value }));
    };

    const pendingCount = rows.filter(r => !r.skipped).length;

    const approveAll = () => {
        onApply(rows.filter(r => !r.skipped).map(r => applySuggestion(r.task, r.suggestion)));
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
            <div
                className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
                onClick={e => e.stopPropagation()}
            >
                <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div className="flex items-center gap-2">
                        <Sparkles size={18} className="text-indigo-500" />
                        <h2 className="text-base font-semibold text-slate-900">Organize with AI</h2>
                    </div>
                    <button onClick={onClose} className="app-icon-button" aria-label="Close">
                        <X size={18} />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto p-5">
                    {!ready ? (
                        <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-4 text-sm text-amber-700">
                            <AlertCircle size={16} className="mt-0.5 shrink-0" />
                            Configure an AI provider in Account settings to organize tasks automatically.
                        </div>
                    ) : isFetching ? (
                        <div className="py-12 text-center text-slate-500">
                            <Loader2 size={22} className="mx-auto mb-2 animate-spin text-indigo-500" />
                            Reading {candidates.length} task{candidates.length === 1 ? '' : 's'}…
                        </div>
                    ) : error ? (
                        <div className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700">
                            <p className="mb-3">{error instanceof Error ? error.message : 'Failed to organize tasks.'}</p>
                            <button onClick={() => void refetch()} className="rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-200">
                                Retry
                            </button>
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="py-12 text-center text-sm text-slate-500">Nothing to organize — every task already has a type and kind.</div>
                    ) : (
                        <div className="space-y-2">
                            {rows.map(({ task, suggestion, skipped: isSkipped }) => (
                                <div
                                    key={task.id}
                                    className={`rounded-xl border p-3 transition-colors ${isSkipped ? 'border-slate-100 bg-slate-50 opacity-60' : 'border-slate-200 bg-white'}`}
                                >
                                    <div className="mb-2 flex items-start justify-between gap-2">
                                        <p className="text-sm font-medium text-slate-800">{task.title}</p>
                                        {isSkipped ? (
                                            <button onClick={() => setSkip(task.id, false)} className="shrink-0 text-xs font-medium text-indigo-600 hover:underline">
                                                Undo
                                            </button>
                                        ) : (
                                            <button onClick={() => setSkip(task.id, true)} title="Skip" className="shrink-0 text-slate-400 hover:text-slate-600">
                                                <SkipForward size={15} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <select
                                            value={suggestion.taskTypeId ?? ''}
                                            onChange={e => editRow(task.id, { taskTypeId: e.target.value || null })}
                                            disabled={isSkipped}
                                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                                        >
                                            <option value="">No type</option>
                                            {taskTypes.map(t => (
                                                <option key={t.id} value={t.id}>{t.emoji ? `${t.emoji} ` : ''}{t.name}</option>
                                            ))}
                                        </select>

                                        <select
                                            value={suggestion.kind}
                                            onChange={e => editRow(task.id, { kind: e.target.value as TaskOrganizationSuggestion['kind'] })}
                                            disabled={isSkipped}
                                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                                        >
                                            {TASK_KIND_ORDER.map(k => (
                                                <option key={k} value={k}>{TASK_KIND_META[k].emoji} {TASK_KIND_META[k].label}</option>
                                            ))}
                                        </select>

                                        <select
                                            value={suggestion.priority}
                                            onChange={e => editRow(task.id, { priority: e.target.value as TaskOrganizationSuggestion['priority'] })}
                                            disabled={isSkipped}
                                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs capitalize text-slate-700"
                                        >
                                            {PRIORITIES.map(p => (
                                                <option key={p} value={p}>{p}</option>
                                            ))}
                                        </select>

                                        <input
                                            type="date"
                                            value={suggestion.dueDate ?? ''}
                                            onChange={e => editRow(task.id, { dueDate: e.target.value || null })}
                                            disabled={isSkipped}
                                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                                        />
                                    </div>

                                    {suggestion.reason && !isSkipped && (
                                        <p className="mt-1.5 text-xs text-slate-400">{suggestion.reason}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {rows.length > 0 && !isFetching && !error && (
                    <footer className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-3">
                        <span className="text-xs text-slate-500">{pendingCount} to apply</span>
                        <div className="flex gap-2">
                            <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
                                Cancel
                            </button>
                            <button
                                onClick={approveAll}
                                disabled={pendingCount === 0}
                                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
                            >
                                <Check size={15} />
                                Approve all ({pendingCount})
                            </button>
                        </div>
                    </footer>
                )}
            </div>
        </div>
    );
};

export default AIOrganizeModal;
