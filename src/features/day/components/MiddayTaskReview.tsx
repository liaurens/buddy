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

import React from 'react';
import { Check, CalendarArrowUp } from 'lucide-react';
import { useTasks } from '../../tasks/hooks/useTasks';
import { useTodayItems } from '../hooks/useTodayItems';
import PickRow, { PICK_ACCENTS } from './PickRow';
import { partitionPicks, tomorrowIso } from '../utils/middayReview';

interface Props {
    dateKey: string;
    accent: 'amber' | 'indigo';
}

const MiddayTaskReview: React.FC<Props> = ({ dateKey, accent }) => {
    const { picks, completedCount, totalCount } = useTodayItems(dateKey);
    const { toggleTask, updateTask, rescheduleMany } = useTasks();
    const a = PICK_ACCENTS[accent];

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
                        <PickRow
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

export default MiddayTaskReview;
