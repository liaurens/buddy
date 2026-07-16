/**
 * TriageInbox — the accept-all triage list.
 *
 * AI pre-fills a destination for every captured task; the user tweaks the wrong
 * ones (each change is a learned correction) then routes everything with one tap.
 * Tap a row to expand it for a closer look + the detail a destination needs
 * (today time, school assignment, routine cadence).
 *
 * Presentational only — all logic lives in useTaskTriage.
 */

import React, { useMemo, useState } from 'react';
import { Loader2, AlertCircle, Check, SkipForward, ChevronDown, Sparkles } from 'lucide-react';
import { useTaskTriage, type TriageDecision } from '../hooks/useTaskTriage';
import type { TaskTriageSuggestion } from '../../assistant/services/ai-actions.service';
import {
    TRIAGE_DESTINATION_META,
    TRIAGE_DESTINATION_ORDER,
    isDestinationReady,
    type TriageDestination,
    type TriageDetail,
} from '../utils/triageRouting';
import type { RecurrencePattern } from '../types';
import { suggestionToDetail } from '../utils/triageConfidence';

interface TriageInboxProps {
    /** Called after routes are applied, with how many tasks were routed. */
    onDone?: (appliedCount: number) => void;
    /** Embedded (morning step) trims outer chrome; page adds a heading. */
    variant?: 'page' | 'embedded';
}

const CHIP_ACTIVE: Record<string, string> = {
    rose: 'border-rose-600 bg-rose-600 text-white',
    indigo: 'border-indigo-600 bg-indigo-600 text-white',
    amber: 'border-amber-500 bg-amber-500 text-white',
    violet: 'border-violet-600 bg-violet-600 text-white',
    slate: 'border-slate-500 bg-slate-500 text-white',
};

const CADENCES: { value: RecurrencePattern; label: string }[] = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekdays', label: 'Weekdays' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
];

interface Override {
    destination?: TriageDestination;
    detail?: TriageDetail;
    skipped?: boolean;
}

function baseDecision(s: TaskTriageSuggestion | undefined): {
    destination: TriageDestination;
    detail: TriageDetail;
} {
    if (!s) return { destination: 'today', detail: {} };
    return { destination: s.destination, detail: suggestionToDetail(s) };
}

const TriageInbox: React.FC<TriageInboxProps> = ({ onDone, variant = 'page' }) => {
    const {
        ready,
        reviewInbox,
        autoSortedToday,
        assignmentOptions,
        suggestions,
        isFetching,
        error,
        refetch,
        applyRoutes,
        undoLastBatch,
        canUndo,
    } = useTaskTriage();

    const [overrides, setOverrides] = useState<Record<string, Override>>({});
    const [expanded, setExpanded] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const suggestionsById = useMemo(
        () => new Map((suggestions ?? []).map((s) => [s.id, s])),
        [suggestions],
    );

    // Effective rows: AI base merged with any user overrides.
    const rows = useMemo(
        () =>
            reviewInbox.map((task) => {
                const base = baseDecision(suggestionsById.get(task.id));
                const ov = overrides[task.id] ?? {};
                const destination = ov.destination ?? base.destination;
                // If the user switched destination, ov.detail is the source of truth;
                // otherwise layer their detail edits over the AI's base detail.
                const detail: TriageDetail = ov.destination
                    ? (ov.detail ?? {})
                    : { ...base.detail, ...(ov.detail ?? {}) };
                return {
                    task,
                    destination,
                    detail,
                    aiDestination: base.destination,
                    reason: suggestionsById.get(task.id)?.reason ?? '',
                    skipped: !!ov.skipped,
                    ready: isDestinationReady(destination, detail),
                };
            }),
        [reviewInbox, suggestionsById, overrides],
    );

    const setDestination = (id: string, destination: TriageDestination) => {
        // Reset detail when switching, defaulting routine cadence so it's actionable.
        const detail: TriageDetail = destination === 'routine' ? { recurrence: 'daily' } : {};
        setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], destination, detail } }));
    };
    const editDetail = (id: string, patch: Partial<TriageDetail>) => {
        setOverrides((prev) => ({
            ...prev,
            [id]: { ...prev[id], detail: { ...prev[id]?.detail, ...patch } },
        }));
    };
    const setSkip = (id: string, skipped: boolean) => {
        setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], skipped } }));
    };

    const actionable = rows.filter((r) => !r.skipped && r.ready);
    const blockedCount = rows.filter((r) => !r.skipped && !r.ready).length;

    const apply = async () => {
        if (busy || actionable.length === 0) return;
        setBusy(true);
        try {
            const decisions: TriageDecision[] = actionable.map((r) => ({
                taskId: r.task.id,
                destination: r.destination,
                detail: r.detail,
                aiDestination: r.aiDestination,
            }));
            const count = await applyRoutes(decisions);
            onDone?.(count);
        } finally {
            setBusy(false);
        }
    };

    // Empty inbox — nothing to sort and nothing auto-sorted to review.
    if (reviewInbox.length === 0 && autoSortedToday.length === 0) {
        return (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center">
                <Sparkles size={20} className="mx-auto mb-1 text-emerald-500" />
                <p className="text-sm font-medium text-emerald-800">Inbox clear</p>
                <p className="text-xs text-emerald-600">Nothing captured to sort right now.</p>
            </div>
        );
    }

    return (
        <div className={variant === 'page' ? 'space-y-3' : 'space-y-3'}>
            <div className="flex items-center justify-between gap-2">
                <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600">
                        Smart Inbox — {reviewInbox.length} to review
                    </h2>
                    {!ready && (
                        <p className="text-xs text-slate-400">
                            Set up AI in Account settings for auto-sorting. You can still sort by
                            hand.
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {canUndo && (
                        <button
                            type="button"
                            onClick={() => void undoLastBatch()}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                        >
                            Undo batch
                        </button>
                    )}
                    <button
                        onClick={() => void apply()}
                        disabled={busy || actionable.length === 0}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-40"
                    >
                        {busy ? (
                            <Loader2 size={15} className="animate-spin" />
                        ) : (
                            <Check size={15} />
                        )}
                        Apply all ({actionable.length})
                    </button>
                </div>
            </div>

            {autoSortedToday.length > 0 && (
                <details className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                    <summary className="cursor-pointer text-sm font-medium text-slate-600">
                        I sorted {autoSortedToday.length} for you — tap to review
                    </summary>
                    <ul className="mt-2 space-y-1.5">
                        {autoSortedToday.map((t) => {
                            const dest = (t.triageDestination as TriageDestination) ?? 'today';
                            const m = TRIAGE_DESTINATION_META[dest];
                            return (
                                <li
                                    key={t.id}
                                    className="flex items-center gap-2 text-xs text-slate-600"
                                >
                                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                                    <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5">
                                        {m.emoji} {m.label}
                                    </span>
                                    <button
                                        onClick={() =>
                                            void applyRoutes([
                                                {
                                                    taskId: t.id,
                                                    destination: 'someday',
                                                    detail: {},
                                                    aiDestination: dest,
                                                    wasAuto: true,
                                                },
                                            ])
                                        }
                                        className="shrink-0 text-rose-600 hover:underline"
                                        title="Wrong — move to Someday and teach the AI"
                                    >
                                        Wrong
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </details>
            )}

            {ready && isFetching && (
                <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-600">
                    <Loader2 size={15} className="animate-spin" /> Reading your inbox…
                </div>
            )}
            {ready && error != null && !isFetching && (
                <div className="flex items-center justify-between gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    <span className="flex items-center gap-1.5">
                        <AlertCircle size={15} /> Couldn't auto-sort — sort manually or retry.
                    </span>
                    <button
                        onClick={() => refetch()}
                        className="rounded-md bg-rose-100 px-2 py-1 text-xs font-medium hover:bg-rose-200"
                    >
                        Retry
                    </button>
                </div>
            )}

            <ul className="space-y-2">
                {rows.map((row) => {
                    const meta = TRIAGE_DESTINATION_META[row.destination];
                    const isOpen = expanded === row.task.id;
                    return (
                        <li
                            key={row.task.id}
                            className={`rounded-xl border transition-colors ${row.skipped ? 'border-slate-100 bg-slate-50 opacity-60' : 'border-slate-200 bg-white'}`}
                        >
                            <div className="flex items-center gap-2 p-3">
                                <button
                                    onClick={() => setExpanded(isOpen ? null : row.task.id)}
                                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                >
                                    <ChevronDown
                                        size={15}
                                        className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                    />
                                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                                        {row.task.title}
                                    </span>
                                    <span
                                        className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${CHIP_ACTIVE[meta.color]}`}
                                    >
                                        {meta.emoji} {meta.label}
                                    </span>
                                </button>
                                {row.skipped ? (
                                    <button
                                        onClick={() => setSkip(row.task.id, false)}
                                        className="shrink-0 text-xs font-medium text-indigo-600 hover:underline"
                                    >
                                        Undo
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setSkip(row.task.id, true)}
                                        title="Skip — stays in inbox"
                                        className="shrink-0 p-1.5 text-slate-400 hover:text-slate-600"
                                    >
                                        <SkipForward size={15} />
                                    </button>
                                )}
                            </div>

                            {isOpen && !row.skipped && (
                                <div className="space-y-2.5 border-t border-slate-100 px-3 pb-3 pt-2.5">
                                    {row.reason && (
                                        <p className="text-xs italic text-slate-400">
                                            AI: {row.reason}
                                        </p>
                                    )}

                                    <div className="flex flex-wrap gap-1.5">
                                        {TRIAGE_DESTINATION_ORDER.map((d) => {
                                            const m = TRIAGE_DESTINATION_META[d];
                                            const active = row.destination === d;
                                            return (
                                                <button
                                                    key={d}
                                                    onClick={() => setDestination(row.task.id, d)}
                                                    className={`rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors ${active ? CHIP_ACTIVE[m.color] : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300'}`}
                                                >
                                                    {m.emoji} {m.label}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Destination-specific detail */}
                                    {row.destination === 'today' && (
                                        <label className="flex items-center gap-2 text-xs text-slate-500">
                                            Start time (optional)
                                            <input
                                                type="time"
                                                value={row.detail.time ?? ''}
                                                onChange={(e) =>
                                                    editDetail(row.task.id, {
                                                        time: e.target.value || undefined,
                                                    })
                                                }
                                                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                                            />
                                        </label>
                                    )}
                                    {row.destination === 'routine' && (
                                        <label className="flex items-center gap-2 text-xs text-slate-500">
                                            Repeats
                                            <select
                                                value={row.detail.recurrence ?? 'daily'}
                                                onChange={(e) =>
                                                    editDetail(row.task.id, {
                                                        recurrence: e.target
                                                            .value as RecurrencePattern,
                                                    })
                                                }
                                                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                                            >
                                                {CADENCES.map((c) => (
                                                    <option key={c.value} value={c.value}>
                                                        {c.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    )}
                                    {row.destination === 'deadline' && (
                                        <label className="flex items-center gap-2 text-xs text-slate-500">
                                            Due date
                                            <input
                                                type="date"
                                                value={row.detail.dueDate ?? ''}
                                                onChange={(e) =>
                                                    editDetail(row.task.id, {
                                                        dueDate: e.target.value || undefined,
                                                    })
                                                }
                                                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                                            />
                                        </label>
                                    )}
                                    {row.destination === 'waiting' && (
                                        <label className="flex items-center gap-2 text-xs text-slate-500">
                                            Waiting on
                                            <input
                                                value={row.detail.waitingOn ?? ''}
                                                onChange={(e) =>
                                                    editDetail(row.task.id, {
                                                        waitingOn: e.target.value || undefined,
                                                    })
                                                }
                                                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                                            />
                                        </label>
                                    )}
                                    {row.destination === 'school' &&
                                        (assignmentOptions.length === 0 ? (
                                            <p className="text-xs text-amber-600">
                                                No active assignments to link — add one in School
                                                first, or pick another destination.
                                            </p>
                                        ) : (
                                            <label className="flex items-center gap-2 text-xs text-slate-500">
                                                Assignment
                                                <select
                                                    value={row.detail.assignmentId ?? ''}
                                                    onChange={(e) =>
                                                        editDetail(row.task.id, {
                                                            assignmentId:
                                                                e.target.value || undefined,
                                                        })
                                                    }
                                                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                                                >
                                                    <option value="">Pick one…</option>
                                                    {assignmentOptions.map((a) => (
                                                        <option key={a.id} value={a.id}>
                                                            {a.title}
                                                            {a.className ? ` · ${a.className}` : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                        ))}
                                    {!row.ready && (
                                        <p className="text-xs font-medium text-amber-600">
                                            Add the required detail before routing this task.
                                        </p>
                                    )}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>

            {blockedCount > 0 && (
                <p className="text-xs text-amber-600">
                    {blockedCount} task{blockedCount === 1 ? '' : 's'} need
                    {blockedCount === 1 ? 's' : ''} a detail before it can be routed — expand to
                    fix.
                </p>
            )}
        </div>
    );
};

export default TriageInbox;
