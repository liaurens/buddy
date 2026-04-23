import React, { useEffect, useState } from 'react';
import { isSameDay, isPast } from 'date-fns';
import { AlertTriangle, BookOpen, ChevronRight } from 'lucide-react';
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
            className="w-full bg-white rounded-2xl border border-slate-200 p-4 shadow-sm text-left hover:bg-slate-50 transition-colors"
        >
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Today</h3>
                <ChevronRight size={16} className="text-slate-400" />
            </div>
            <div className="space-y-1">
                {tasksOverdue > 0 && (
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
                        <AlertTriangle size={14} /> {tasksOverdue} overdue
                    </div>
                )}
                {!hasCheckin && (
                    <div className="flex items-center gap-2 text-sm text-emerald-700">
                        <BookOpen size={14} /> Check-in not done
                    </div>
                )}
                <p className="text-sm text-slate-700">
                    {tasksToday} task{tasksToday !== 1 ? 's' : ''} due today · {eventCount} event{eventCount !== 1 ? 's' : ''}
                </p>
            </div>
        </button>
    );
};

export default TodayCard;
