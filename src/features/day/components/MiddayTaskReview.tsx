/**
 * MiddayTaskReview — the "wrap up your tasks" section of the midday reset.
 *
 * For each task due today the user decides: Done, Reschedule (not finished), or
 * Needs work (partially done — add subtasks / a slight adjustment). Plus a
 * header summary, a one-tap "carry all unfinished to tomorrow", and an
 * auto-suggest-complete hint when a task's subtasks are all checked.
 *
 * Presentational glue only — task mutations go through useTasks; today's picks
 * come from useTodayItems; the date math + partitioning live in middayReview.
 */

import React, { useRef, useState } from 'react';
import { Check, CalendarClock, ListChecks, CalendarArrowUp } from 'lucide-react';
import { useTasks } from '../../tasks/hooks/useTasks';
import { useTodayItems } from '../hooks/useTodayItems';
import SnoozeMenu from '../../tasks/components/SnoozeMenu';
import type { Task, Subtask } from '../../tasks/types';
import {
    partitionPicks,
    subtaskProgress,
    allSubtasksDone,
    tomorrowIso,
} from '../utils/middayReview';

interface Props {
    dateKey: string;
    accent: 'amber' | 'indigo';
}

interface Accent {
    text: string;
    solid: string;
    softBg: string;
    softText: string;
}

const ACCENTS: Record<Props['accent'], Accent> = {
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

const MiddayTaskReview: React.FC<Props> = ({ dateKey, accent }) => {
    const { picks, completedCount, totalCount } = useTodayItems(dateKey);
    const { toggleTask, updateTask, rescheduleMany } = useTasks();
    const a = ACCENTS[accent];

    if (picks.length === 0) return null;

    const { open, done } = partitionPicks(picks);

    const carryAllToTomorrow = () => {
        if (open.length === 0) return;
        void rescheduleMany(
            open.map((t) => t.id),
            tomorrowIso(),
        );
    };

    return (
        <div className="space-y-3 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h3 className="text-sm font-semibold text-slate-900">Wrap up your tasks</h3>
                    <p className="text-xs text-slate-500">
                        {open.length === 0
                            ? 'All wrapped up — nice.'
                            : 'Decide what to do with the rest.'}
                    </p>
                </div>
                <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${a.softBg} ${a.softText}`}
                >
                    {completedCount} / {totalCount} done
                </span>
            </div>

            {open.length > 0 && (
                <ul className="space-y-2">
                    {open.map((task) => (
                        <ReviewRow
                            key={task.id}
                            task={task}
                            accent={a}
                            onDone={() => toggleTask(task.id)}
                            onReschedule={(date, time) =>
                                updateTask({
                                    ...task,
                                    dueDate: date,
                                    dueTime: time ?? task.dueTime,
                                })
                            }
                            onUpdate={updateTask}
                        />
                    ))}
                </ul>
            )}

            {open.length > 1 && (
                <button
                    type="button"
                    onClick={carryAllToTomorrow}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                >
                    <CalendarArrowUp size={14} /> Carry all {open.length} unfinished to tomorrow
                </button>
            )}

            {done.length > 0 && (
                <details className="rounded-xl bg-slate-50 px-3 py-2">
                    <summary className="cursor-pointer text-xs font-medium text-slate-500">
                        Done ({done.length})
                    </summary>
                    <ul className="mt-2 space-y-1">
                        {done.map((t) => (
                            <li
                                key={t.id}
                                className="flex items-center gap-2 text-xs text-slate-400"
                            >
                                <Check size={12} className="shrink-0 text-emerald-500" />
                                <span className="truncate line-through">{t.title}</span>
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </div>
    );
};

interface RowProps {
    task: Task;
    accent: Accent;
    onDone: () => void;
    onReschedule: (date: string, time?: string) => void;
    onUpdate: (task: Task) => void;
}

const ReviewRow: React.FC<RowProps> = ({ task, accent, onDone, onReschedule, onUpdate }) => {
    const [expanded, setExpanded] = useState(false);
    const [showSnooze, setShowSnooze] = useState(false);
    const [newSubtask, setNewSubtask] = useState('');
    const [note, setNote] = useState(task.notes ?? '');
    const snoozeBtnRef = useRef<HTMLButtonElement>(null);

    const progress = subtaskProgress(task);
    const suggestDone = allSubtasksDone(task);

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

export default MiddayTaskReview;
