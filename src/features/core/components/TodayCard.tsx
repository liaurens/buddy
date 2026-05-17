import React, { useEffect, useState } from 'react';
import { isSameDay, isPast } from 'date-fns';
import { CalendarDays, CheckCircle2, ChevronRight, ListTodo, RotateCcw } from 'lucide-react';
import { useTrackers } from '../../health-tracking/hooks/useTrackers';
import { useTasks } from '../../tasks/hooks/useTasks';
import { useAuth } from '../../../hooks/useAuth';
import { supabase } from '../../../services/supabase';
import type { AppRoute } from '../../../constants/routes';

interface Props {
    onNavigate: (tab: AppRoute) => void;
}

const TodayCard: React.FC<Props> = ({ onNavigate }) => {
    const { entries } = useTrackers();
    const { tasks } = useTasks();
    const { user } = useAuth();
    const [eventCount, setEventCount] = useState(0);

    const today = new Date();
    const todayEntries = entries.filter(e => isSameDay(new Date(e.timestamp), today));
    const hasCheckin = todayEntries.some(e => e.notes === 'Daily Check-in' || e.trackerId === 'journal_notes' || e.trackerId === 'mood');

    const tasksToday = tasks.filter(t => !t.completed && t.dueDate && isSameDay(new Date(t.dueDate), today)).length;
    const tasksOverdue = tasks.filter(t => !t.completed && t.dueDate && isPast(new Date(t.dueDate)) && !isSameDay(new Date(t.dueDate), today)).length;

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
            className="w-full rounded-lg border border-slate-200/90 bg-white p-5 text-left shadow-[0_16px_42px_rgba(15,23,42,0.045)] transition-colors hover:bg-slate-50"
        >
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-950">Today</h2>
                <ChevronRight size={16} className="text-slate-400" />
            </div>
            <div className="grid grid-cols-4 gap-2">
                <Stat icon={<ListTodo size={17} />} value={tasksToday + tasksOverdue} label="Tasks" tone="text-slate-700" />
                <Stat icon={<CalendarDays size={17} />} value={eventCount} label="Events" tone="text-blue-600" />
                <Stat icon={<CheckCircle2 size={17} />} value={hasCheckin ? 0 : 1} label="Check-in" tone="text-rose-500" />
                <Stat icon={<RotateCcw size={17} />} value="0m" label="Focus" tone="text-slate-700" />
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
