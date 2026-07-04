/**
 * PickRow — one of today's picked tasks as a compact actionable row:
 * Done, Reschedule (SnoozeMenu), or Needs work (expand → subtasks + note).
 *
 * Extracted from MiddayTaskReview so the home Today card and the midday
 * review render the exact same row. Presentational only — all mutations
 * come in via callbacks.
 */

import React, { useRef, useState } from 'react';
import { Check, CalendarClock, ListChecks, Sparkles } from 'lucide-react';
import SnoozeMenu from '../../tasks/components/SnoozeMenu';
import AITaskSplitter from '../../tasks/components/AITaskSplitter';
import type { Task, Subtask } from '../../tasks/types';
import { subtaskProgress, allSubtasksDone } from '../utils/middayReview';
import { isStale } from '../../tasks/utils/staleness';

export interface PickAccent {
    text: string;
    solid: string;
    softBg: string;
    softText: string;
}

export const PICK_ACCENTS: Record<'amber' | 'indigo', PickAccent> = {
    indigo: {
        text: 'text-indigo-600',
        solid: 'bg-indigo-600 hover:bg-indigo-700',
        softBg: 'bg-indigo-50',
        softText: 'text-indigo-700',
    },
    amber: {
        text: 'text-amber-600',
        solid: 'bg-amber-500 hover:bg-amber-600',
        softBg: 'bg-amber-50',
        softText: 'text-amber-700',
    },
};

interface PickRowProps {
    task: Task;
    accent: PickAccent;
    onDone: () => void;
    onReschedule: (date: string, time?: string) => void;
    onUpdate: (task: Task) => void;
}

const PickRow: React.FC<PickRowProps> = ({ task, accent, onDone, onReschedule, onUpdate }) => {
    const [expanded, setExpanded] = useState(false);
    const [showSnooze, setShowSnooze] = useState(false);
    const [splitting, setSplitting] = useState(false);
    const [newSubtask, setNewSubtask] = useState('');
    const [note, setNote] = useState(task.notes ?? '');
    const snoozeBtnRef = useRef<HTMLButtonElement>(null);

    const progress = subtaskProgress(task);
    const suggestDone = allSubtasksDone(task);
    // Stuck signal: repeatedly snoozed or due/overdue and untouched — offer a split.
    const stale = isStale(task, new Date()) && (task.subtasks ?? []).length === 0;

    const addSubtask = () => {
        const title = newSubtask.trim();
        if (!title) return;
        const next: Subtask = { id: crypto.randomUUID(), title, completed: false };
        onUpdate({ ...task, subtasks: [...(task.subtasks ?? []), next] });
        setNewSubtask('');
    };

    const toggleSubtask = (id: string) => {
        const subtasks = (task.subtasks ?? []).map((s) =>
            s.id === id ? { ...s, completed: !s.completed } : s,
        );
        onUpdate({ ...task, subtasks });
    };

    const saveNote = () => {
        const trimmed = note.trim();
        if ((task.notes ?? '') === trimmed) return;
        onUpdate({ ...task, notes: trimmed || undefined });
    };

    return (
        <li className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center gap-2 p-2.5">
                <button
                    type="button"
                    onClick={onDone}
                    aria-label="Mark done"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-300 text-slate-300 transition-colors hover:border-emerald-400 hover:text-emerald-500"
                >
                    <Check size={15} />
                </button>

                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{task.title}</p>
                    {progress && (
                        <p className="text-xs text-slate-400">
                            {progress.done}/{progress.total} subtasks
                        </p>
                    )}
                </div>

                {stale && (
                    <button
                        type="button"
                        onClick={() => setSplitting((v) => !v)}
                        className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
                        title="This task looks stuck — break it into smaller steps"
                    >
                        <Sparkles size={12} /> Split this?
                    </button>
                )}

                {suggestDone && (
                    <button
                        type="button"
                        onClick={onDone}
                        className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                    >
                        Mark done?
                    </button>
                )}

                <button
                    type="button"
                    ref={snoozeBtnRef}
                    onClick={() => setShowSnooze((v) => !v)}
                    aria-label="Reschedule"
                    className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
                >
                    <CalendarClock size={16} />
                </button>
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    aria-label="Needs work"
                    className={`shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 ${expanded ? accent.text : ''}`}
                >
                    <ListChecks size={16} />
                </button>
            </div>

            {showSnooze && (
                <SnoozeMenu
                    anchorRef={snoozeBtnRef}
                    onSnooze={(date, time) => {
                        onReschedule(date, time);
                        setShowSnooze(false);
                    }}
                    onClose={() => setShowSnooze(false)}
                />
            )}

            {splitting && (
                <div className="border-t border-slate-100 px-2.5 pb-3 pt-2.5">
                    <AITaskSplitter
                        task={task}
                        onSplit={(subtasks) => {
                            onUpdate({ ...task, subtasks });
                            setSplitting(false);
                        }}
                        onCancel={() => setSplitting(false)}
                    />
                </div>
            )}

            {expanded && (
                <div className="space-y-2.5 border-t border-slate-100 px-2.5 pb-3 pt-2.5">
                    {(task.subtasks ?? []).length > 0 && (
                        <ul className="space-y-1">
                            {(task.subtasks ?? []).map((s) => (
                                <li key={s.id} className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => toggleSubtask(s.id)}
                                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${s.completed ? 'border-emerald-400 bg-emerald-500 text-white' : 'border-slate-300 text-transparent'}`}
                                    >
                                        <Check size={12} />
                                    </button>
                                    <span
                                        className={`text-sm ${s.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}
                                    >
                                        {s.title}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={newSubtask}
                            onChange={(e) => setNewSubtask(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') addSubtask();
                            }}
                            placeholder="Add subtask…"
                            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                        />
                        <button
                            type="button"
                            onClick={addSubtask}
                            disabled={!newSubtask.trim()}
                            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-40 ${accent.solid}`}
                        >
                            Add
                        </button>
                    </div>

                    <label className="block text-xs text-slate-500">
                        Adjustment / note
                        <input
                            type="text"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            onBlur={saveNote}
                            placeholder="A quick tweak for next time…"
                            className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700"
                        />
                    </label>
                </div>
            )}
        </li>
    );
};

export default PickRow;
