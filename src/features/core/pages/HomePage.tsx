import React, { useState, useEffect } from 'react';
import { useTrackers } from '../../health-tracking/hooks/useTrackers';
import { useProtocols } from '../../health-tracking/hooks/useProtocols';
import { useExperiments } from '../../health-tracking/hooks/useExperiments';
import { format, isSameDay } from 'date-fns';
import {
    Zap, Calendar as CalendarIcon,
    BookOpen, CheckSquare, Lightbulb, BarChart2, Timer, ListChecks, ChevronDown, ChevronUp
} from 'lucide-react';
import type { AppRoute } from '../../../constants/routes';
import type { Entry } from '../../health-tracking/types';
import HabitDashboard from '../../tasks/components/HabitDashboard';

interface HomePageProps {
    onNavigate: (tab: AppRoute) => void;
}

const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
    const { entries } = useTrackers();
    const { protocols } = useProtocols();
    const { getActiveExperiments } = useExperiments();

    const [todayValues, setTodayValues] = useState<Entry[]>([]);
    const [toolsExpanded, setToolsExpanded] = useState(false);

    const activeProtocols = protocols.filter(p => p.active);
    const activeExperiments = getActiveExperiments();
    const today = new Date();

    useEffect(() => {
        const todaysEntries = entries.filter(e => isSameDay(new Date(e.timestamp), today));
        setTodayValues(todaysEntries);
    }, [entries]);

    const hasCheckin = todayValues.some(e => e.notes === 'Daily Check-in' || e.trackerId === 'journal_notes' || e.trackerId === 'mood');

    // Notifications
    const notifications = [
        activeExperiments.length > 0 ? {
            id: 'exp-1',
            type: 'info',
            title: 'Experiment Active',
            message: `Running "${activeExperiments[0].name}".`
        } : null,
        activeProtocols.length > 0 ? {
            id: 'prot-1',
            type: 'reminder',
            title: 'Protocol Reminder',
            message: `Doses needed for: ${activeProtocols.map(p => p.name).join(', ')}`
        } : null
    ].filter((n): n is NonNullable<typeof n> => n !== null);

    const tools = [
        {
            id: 'tasks',
            title: 'All Tasks',
            icon: <CheckSquare size={20} className="text-indigo-600" />,
            color: 'bg-indigo-50 text-indigo-900',
            action: () => onNavigate('tasks')
        },
        {
            id: 'focus',
            title: 'Focus',
            icon: <Timer size={20} className="text-rose-600" />,
            color: 'bg-rose-50 text-rose-900',
            action: () => onNavigate('focus')
        },
        {
            id: 'calendar',
            title: 'Calendar',
            icon: <CalendarIcon size={20} className="text-pink-600" />,
            color: 'bg-pink-50 text-pink-900',
            action: () => onNavigate('calendar')
        },
        {
            id: 'notes',
            title: 'Notes',
            icon: <Zap size={20} className="text-cyan-600" />,
            color: 'bg-cyan-50 text-cyan-900',
            action: () => onNavigate('notes')
        },
        {
            id: 'checklists',
            title: 'Lists',
            icon: <ListChecks size={20} className="text-sky-600" />,
            color: 'bg-sky-50 text-sky-900',
            action: () => onNavigate('checklists')
        },
        {
            id: 'check-in',
            title: 'Check-In',
            icon: <BookOpen size={20} className="text-emerald-600" />,
            color: 'bg-emerald-50 text-emerald-900',
            action: () => onNavigate('check-in')
        },
        {
            id: 'tracker',
            title: 'Health',
            icon: <BarChart2 size={20} className="text-blue-600" />,
            color: 'bg-blue-50 text-blue-900',
            action: () => onNavigate('health')
        },
        {
            id: 'toolbox',
            title: 'Toolbox',
            icon: <Lightbulb size={20} className="text-amber-600" />,
            color: 'bg-amber-50 text-amber-900',
            action: () => onNavigate('toolbox')
        },
        {
            id: 'experiments',
            title: 'Experiments',
            icon: <Zap size={20} className="text-violet-600" />,
            color: 'bg-violet-50 text-violet-900',
            action: () => onNavigate('experiments')
        },
    ];

    // Show first 4 tools when collapsed, all when expanded
    const visibleTools = toolsExpanded ? tools : tools.slice(0, 4);

    return (
        <div className="max-w-2xl mx-auto p-4 pb-24 space-y-6">
            {/* Header */}
            <header className="pt-2">
                <p className="text-slate-500 text-sm font-medium">{format(today, 'EEEE, MMMM do')}</p>
            </header>

            {/* Habit Dashboard - The star of the show */}
            <HabitDashboard onNavigateToTasks={() => onNavigate('tasks')} />

            {/* Notifications */}
            {notifications.length > 0 && (
                <div className="space-y-2">
                    {notifications.map(note => (
                        <div key={note.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex gap-3">
                            <div className="mt-0.5"><Zap size={16} className="text-amber-500" /></div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm">{note.title}</h4>
                                <p className="text-xs text-slate-500">{note.message}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Daily Check-in Prompt */}
            {!hasCheckin && (
                <button
                    onClick={() => onNavigate('check-in')}
                    className="w-full bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center gap-3 hover:border-emerald-200 transition-colors text-left"
                >
                    <div className="p-2 bg-emerald-50 rounded-lg">
                        <BookOpen size={18} className="text-emerald-600" />
                    </div>
                    <div className="flex-1">
                        <p className="font-semibold text-slate-800 text-sm">Daily Check-in</p>
                        <p className="text-xs text-slate-500">Log your health metrics</p>
                    </div>
                    <span className="px-2 py-0.5 bg-rose-50 text-rose-500 text-[10px] font-bold uppercase tracking-wider rounded">Pending</span>
                </button>
            )}

            {/* Tools Grid - Compact */}
            <section>
                <button
                    onClick={() => setToolsExpanded(!toolsExpanded)}
                    className="flex items-center gap-2 mb-3 px-1 group"
                >
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Tools</h3>
                    {toolsExpanded
                        ? <ChevronUp size={14} className="text-slate-400" />
                        : <ChevronDown size={14} className="text-slate-400" />
                    }
                </button>
                <div className="grid grid-cols-4 gap-2">
                    {visibleTools.map(tool => (
                        <button
                            key={tool.id}
                            onClick={tool.action}
                            className={`p-3 rounded-xl transition-all text-center group hover:scale-[1.02] hover:shadow-sm ${tool.color}`}
                        >
                            <div className="mx-auto mb-1.5 w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center">
                                {tool.icon}
                            </div>
                            <div className="text-[11px] font-semibold leading-tight">{tool.title}</div>
                        </button>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default HomePage;
