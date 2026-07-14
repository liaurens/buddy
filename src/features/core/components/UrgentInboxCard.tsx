/**
 * Urgent inbox — the home-screen takeover for urgent tasks that haven't been
 * scheduled yet. Forces the user to decide WHEN to do each one (and optional
 * prep/notes) before it disappears into the normal flow.
 */

import React, { useMemo, useState } from 'react';
import { Flame, CalendarPlus } from 'lucide-react';
import { useTasks } from '../../tasks/hooks/useTasks';
import UrgentScheduleModal from '../../tasks/components/UrgentScheduleModal';
import { deriveTaskKind } from '../../tasks/utils/taskKind';
import type { Task } from '../../tasks/types';
import type { AppRoute } from '../../../constants/routes';

interface UrgentInboxCardProps {
    onNavigate: (tab: AppRoute, params?: Record<string, unknown>) => void;
}

const UrgentInboxCard: React.FC<UrgentInboxCardProps> = ({ onNavigate }) => {
    const { tasks } = useTasks();
    const [selected, setSelected] = useState<Task | null>(null);

    // Urgent kind, active, and not yet given a "do date".
    const unscheduled = useMemo(
        () => tasks.filter((t) => !t.completed && !t.dueDate && deriveTaskKind(t) === 'urgent'),
        [tasks],
    );

    if (unscheduled.length === 0) return null;

    return (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100">
                        <Flame size={18} className="text-rose-600" />
                    </span>
                    <div>
                        <h2 className="text-sm font-semibold text-rose-900">
                            {unscheduled.length} urgent{' '}
                            {unscheduled.length === 1 ? 'task needs' : 'tasks need'} a plan
                        </h2>
                        <p className="text-xs text-rose-700">
                            Decide when you'll do {unscheduled.length === 1 ? 'it' : 'them'}.
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => onNavigate('tasks', { view: 'urgent' })}
                    className="flex-shrink-0 text-xs font-medium text-rose-700 hover:underline"
                >
                    View all
                </button>
            </div>

            <ul className="mt-3 space-y-2">
                {unscheduled.slice(0, 4).map((task) => (
                    <li
                        key={task.id}
                        className="flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2"
                    >
                        <span className="flex-1 min-w-0 truncate text-sm font-medium text-slate-800">
                            {task.title}
                        </span>
                        <button
                            onClick={() => setSelected(task)}
                            className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-rose-700"
                        >
                            <CalendarPlus size={13} /> Schedule
                        </button>
                    </li>
                ))}
            </ul>

            {selected && (
                <UrgentScheduleModal
                    task={selected}
                    isOpen={!!selected}
                    onClose={() => setSelected(null)}
                    onScheduled={() => setSelected(null)}
                />
            )}
        </div>
    );
};

export default UrgentInboxCard;
