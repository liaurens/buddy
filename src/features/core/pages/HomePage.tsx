import React, { useState, useEffect } from 'react';
import { useTrackers } from '../../health-tracking/hooks/useTrackers';
import { useProtocols } from '../../health-tracking/hooks/useProtocols';
import { useExperiments } from '../../health-tracking/hooks/useExperiments';
import { format, isSameDay } from 'date-fns';
import {
    Zap, Calendar as CalendarIcon,
    BookOpen, CheckSquare, Lightbulb, BarChart2, Timer, ListChecks, ChevronDown, ChevronUp, MessageSquare, Trophy, Brain, Bell
} from 'lucide-react';
import type { AppRoute } from '../../../constants/routes';
import type { Entry } from '../../health-tracking/types';
import HabitDashboard from '../../tasks/components/HabitDashboard';
import AssistantPromptBar from '../../assistant/components/AssistantPromptBar';

interface HomePageProps {
    onNavigate: (tab: AppRoute) => void;
}

const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
    const { entries } = useTrackers();
    const { protocols } = useProtocols();
    const { getActiveExperiments } = useExperiments();

    const [todayValues, setTodayValues] = useState<Entry[]>([]);
    const [toolsExpanded, setToolsExpanded] = useState(false);
    const [actionItemsExpanded, setActionItemsExpanded] = useState(false);

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
            id: 'planner',
            title: 'Planner',
            icon: <Brain size={20} className="text-indigo-600" />,
            color: 'bg-indigo-50 text-indigo-900',
            action: () => onNavigate('planner')
        },
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
            id: 'growth',
            title: 'Growth',
            icon: <Trophy size={20} className="text-fuchsia-600" />,
            color: 'bg-fuchsia-50 text-fuchsia-900',
            action: () => onNavigate('growth')
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

    const visibleTools = toolsExpanded ? tools : tools.slice(0, 4);
    const actionItemsCount = notifications.length + (!hasCheckin ? 1 : 0);

    return (
        <div className="max-w-xl mx-auto p-4 pb-24 space-y-6">
            <header className="pt-2">
                <p className="text-slate-500 text-sm font-medium">{format(today, 'EEEE, MMMM do')}</p>
            </header>

            {/* Assistant Prompt Bar */}
            <div>
              <AssistantPromptBar onNavigate={onNavigate} />
              
              <button
                  onClick={() => onNavigate('assistant')}
                  className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 transition-colors mt-2 pl-1"
              >
                  <MessageSquare size={13} />
                  Open full chat
              </button>
            </div>

            {/* Habit Dashboard - Compact Edition */}
            <HabitDashboard onNavigateToTasks={() => onNavigate('tasks')} />

            {/* Action Items Accordion (Checkins & Notifications) */}
            {actionItemsCount > 0 && (
                <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <button 
                        onClick={() => setActionItemsExpanded(!actionItemsExpanded)}
                        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Bell size={16} className="text-slate-500" />
                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Action Items</h3>
                            <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                {actionItemsCount} pending
                            </span>
                        </div>
                        {actionItemsExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </button>
                    
                    {actionItemsExpanded && (
                        <div className="p-4 space-y-3 bg-white border-t border-slate-100">
                            {/* Check-in */}
                            {!hasCheckin && (
                                <button
                                    onClick={() => onNavigate('check-in')}
                                    className="w-full bg-slate-50 rounded-xl p-3 border border-slate-200 shadow-sm flex items-center gap-3 hover:border-emerald-200 transition-colors text-left group"
                                >
                                    <div className="p-2 bg-emerald-100 rounded-lg group-hover:bg-emerald-200 transition-colors">
                                        <BookOpen size={16} className="text-emerald-700" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-slate-800 text-sm">Daily Check-in</p>
                                        <p className="text-xs text-slate-500">Log your health metrics</p>
                                    </div>
                                </button>
                            )}

                            {/* Notifications */}
                            {notifications.map(note => (
                                <div key={note.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-sm flex gap-3">
                                    <div className="mt-0.5 p-1 rounded-md bg-amber-100/50"><Zap size={14} className="text-amber-600" /></div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm leading-tight mb-0.5">{note.title}</h4>
                                        <p className="text-xs text-slate-600">{note.message}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* Tools Grid - Compact */}
            <section>
                <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Tools</h3>
                    <button
                        onClick={() => setToolsExpanded(!toolsExpanded)}
                        className="text-xs text-indigo-500 hover:text-indigo-700 font-medium"
                    >
                        {toolsExpanded ? 'Show less' : 'View all'}
                    </button>
                </div>
                <div className="grid grid-cols-4 gap-3">
                    {visibleTools.map(tool => (
                        <button
                            key={tool.id}
                            onClick={tool.action}
                            className={`p-3 rounded-xl transition-all text-center flex flex-col items-center justify-center gap-2 group hover:scale-[1.02] hover:shadow-sm ${tool.color}`}
                        >
                            <div className="w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center">
                                {tool.icon}
                            </div>
                            <div className="text-[10px] font-semibold leading-tight">{tool.title}</div>
                        </button>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default HomePage;
