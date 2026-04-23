import React from 'react';
import { Target, Calendar as CalendarIcon, Play, Check } from 'lucide-react';
import { format } from 'date-fns';
import { useNextUp } from '../hooks/useNextUp';
import { useTasks } from '../../tasks/hooks/useTasks';
import type { AppRoute } from '../../../constants/routes';

interface Props {
    onNavigate: (tab: AppRoute, params?: Record<string, unknown>) => void;
}

const NextUpCard: React.FC<Props> = ({ onNavigate }) => {
    const next = useNextUp();
    const { toggleTask } = useTasks();

    if (next.kind === 'none') {
        return (
            <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Next up</h3>
                <p className="text-sm text-slate-400">Nothing scheduled. Capture a task above to get started.</p>
            </section>
        );
    }

    if (next.kind === 'task' && next.task) {
        const t = next.task;
        return (
            <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Next up</h3>
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600 mt-0.5">
                        <Target size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 text-sm leading-tight truncate">{t.task.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{t.reason}</p>
                    </div>
                </div>
                <div className="flex gap-2 mt-3">
                    <button
                        onClick={() => onNavigate('focus', { taskId: t.task.id })}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                    >
                        <Play size={14} /> Start focus
                    </button>
                    <button
                        onClick={() => toggleTask(t.task.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                    >
                        <Check size={14} /> Done
                    </button>
                </div>
            </section>
        );
    }

    if (next.kind === 'event' && next.event) {
        const e = next.event;
        const startsAt = format(new Date(e.startTime), 'HH:mm');
        return (
            <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Next up</h3>
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-pink-100 rounded-lg text-pink-600 mt-0.5">
                        <CalendarIcon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 text-sm leading-tight truncate">{e.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">at {startsAt}{e.location ? ` · ${e.location}` : ''}</p>
                    </div>
                </div>
                <button
                    onClick={() => onNavigate('calendar')}
                    className="w-full mt-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                >
                    Open calendar
                </button>
            </section>
        );
    }

    return null;
};

export default NextUpCard;
