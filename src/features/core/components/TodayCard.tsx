import React, { useEffect, useState } from 'react';
import { AlertTriangle, CalendarDays, ChevronRight, GraduationCap, ListTodo } from 'lucide-react';
import { useTasks } from '../../tasks/hooks/useTasks';
import { useAssignments } from '../../school/hooks/useAssignments';
import { useAuth } from '../../../hooks/useAuth';
import { supabase } from '../../../services/supabase';
import { summarizeToday } from '../utils/todaySummary';
import type { AppRoute } from '../../../constants/routes';

interface Props {
    onNavigate: (tab: AppRoute) => void;
}

const TodayCard: React.FC<Props> = ({ onNavigate }) => {
    const { tasks } = useTasks();
    const { assignments } = useAssignments({ activeOnly: true });
    const { user } = useAuth();
    const [eventCount, setEventCount] = useState(0);

    const { overdue, dueToday, assignmentsDueSoon } = summarizeToday(tasks, assignments);

    useEffect(() => {
        if (!user?.id) return;
        const now = new Date();
        const start = new Date(now); start.setHours(0, 0, 0, 0);
        const end = new Date(now); end.setHours(23, 59, 59, 999);
        supabase
            .from('calendar_events')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gte('start_time', start.toISOString())
            .lte('start_time', end.toISOString())
            .then(({ count }) => setEventCount(count ?? 0));
    }, [user?.id]);

    return (
        <button
            onClick={() => onNavigate('today')}
            className="app-surface w-full p-5 text-left transition-colors hover:bg-slate-50"
        >
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-950">Today</h2>
                <ChevronRight size={16} className="text-slate-400" />
            </div>

            {overdue > 0 && (
                <div className="mb-3 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                    <AlertTriangle size={15} />
                    <span>{overdue} overdue task{overdue === 1 ? '' : 's'}</span>
                </div>
            )}

            <div className="grid grid-cols-4 gap-2">
                <Stat icon={<ListTodo size={17} />} value={dueToday} label="Due today" tone="text-slate-700" />
                <Stat
                    icon={<AlertTriangle size={17} />}
                    value={overdue}
                    label="Overdue"
                    tone={overdue > 0 ? 'text-rose-600' : 'text-slate-400'}
                />
                <Stat icon={<CalendarDays size={17} />} value={eventCount} label="Events" tone="text-blue-600" />
                <Stat
                    icon={<GraduationCap size={17} />}
                    value={assignmentsDueSoon}
                    label="School ≤7d"
                    tone={assignmentsDueSoon > 0 ? 'text-amber-600' : 'text-slate-400'}
                />
            </div>
        </button>
    );
};

const Stat: React.FC<{ icon: React.ReactNode; value: React.ReactNode; label: string; tone: string }> = ({ icon, value, label, tone }) => (
    <div className="min-w-0 text-center">
        <div className={`mx-auto flex min-h-6 items-center justify-center gap-1 text-sm font-semibold ${tone}`}>
            {icon}
            <span className="text-xl leading-none text-slate-950">{value}</span>
        </div>
        <div className="mt-1 truncate text-[11px] text-slate-500">{label}</div>
    </div>
);

export default TodayCard;
