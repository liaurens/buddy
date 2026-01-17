import React, { useState, useEffect } from 'react';
import { useTracker } from '../context/TrackerContext';
import { useProtocol } from '../context/ProtocolContext';
import { useExperiment } from '../context/ExperimentContext';
import { format, isSameDay } from 'date-fns';
import {
    Zap, Calendar as CalendarIcon,
    BookOpen, CheckSquare, Lightbulb, BarChart2
} from 'lucide-react';

interface HomePageProps {
    onNavigate: (tab: any) => void;
}

const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
    const { entries } = useTracker();
    const { protocols } = useProtocol();
    const { getActiveExperiments } = useExperiment();

    const [todayValues, setTodayValues] = useState<any[]>([]);

    const activeProtocols = protocols.filter(p => p.active);
    const activeExperiments = getActiveExperiments();
    const today = new Date();

    useEffect(() => {
        const todaysEntries = entries.filter(e => isSameDay(new Date(e.timestamp), today));
        setTodayValues(todaysEntries);
    }, [entries]);

    const hasCheckin = todayValues.some(e => e.notes === 'Daily Check-in' || e.trackerId === 'journal_notes' || e.trackerId === 'mood');

    // MOCK Notifications
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
    ].filter(Boolean) as any[];

    const tools = [
        {
            id: 'journal',
            title: 'Journal',
            description: 'Daily check-in & logs',
            icon: <BookOpen size={24} className="text-emerald-600" />,
            color: 'bg-emerald-50 text-emerald-900 border-emerald-100',
            action: () => onNavigate('journal')
        },
        {
            id: 'tracker',
            title: 'Tracker Stats',
            description: 'Trends & Analysis',
            icon: <BarChart2 size={24} className="text-blue-600" />,
            color: 'bg-blue-50 text-blue-900 border-blue-100',
            action: () => onNavigate('tracker') // This maps to "Dashboard" view
        },
        {
            id: 'toolbox',
            title: 'Toolbox',
            description: 'Strategies & Models',
            icon: <Lightbulb size={24} className="text-amber-600" />,
            color: 'bg-amber-50 text-amber-900 border-amber-100',
            action: () => onNavigate('toolbox')
        },
        {
            id: 'tasks',
            title: 'Tasks',
            description: 'Todo List',
            icon: <CheckSquare size={24} className="text-indigo-600" />,
            color: 'bg-indigo-50 text-indigo-900 border-indigo-100',
            action: () => onNavigate('todos')
        },
        {
            id: 'calendar',
            title: 'Calendar',
            description: 'Schedule & Planning',
            icon: <CalendarIcon size={24} className="text-pink-600" />,
            color: 'bg-pink-50 text-pink-900 border-pink-100',
            action: () => onNavigate('calendar')
        },
        {
            id: 'experiments',
            title: 'Experiments',
            description: 'Testing & optimization',
            icon: <Zap size={24} className="text-violet-600" />,
            color: 'bg-violet-50 text-violet-900 border-violet-100',
            action: () => onNavigate('experiments')
        }
    ];

    return (
        <div className="max-w-2xl mx-auto p-4 pb-24 space-y-8">
            <header className="pt-4">
                <h1 className="text-3xl font-bold text-slate-900">Tracker Hub</h1>
                <p className="text-slate-500 text-lg">{format(today, 'EEEE, MMM do')}</p>
            </header>

            {/* Daily Prompt */}
            {!hasCheckin && (
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl shadow-slate-200 cursor-pointer group"
                    onClick={() => onNavigate('journal')}
                >
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm">
                                <BookOpen size={20} className="text-emerald-300" />
                            </div>
                            <h2 className="text-xl font-bold">Daily Check-in</h2>
                        </div>
                        <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 text-[10px] font-bold uppercase tracking-wider rounded border border-rose-500/30">Pending</span>
                    </div>
                    <p className="text-slate-300 mb-0 group-hover:text-white transition-colors">
                        Ready to log your metrics for today?
                    </p>
                </div>
            )}

            {/* Notifications */}
            {notifications.length > 0 && (
                <div className="space-y-3">
                    {notifications.map(note => (
                        <div key={note.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex gap-3 animate-in fade-in slide-in-from-bottom-2">
                            <div className="mt-0.5"><Zap size={18} className="text-amber-500" /></div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm">{note.title}</h4>
                                <p className="text-xs text-slate-500">{note.message}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Tools Grid */}
            <section>
                <h3 className="text-lg font-bold text-slate-800 mb-4 px-1">Tools</h3>
                <div className="grid grid-cols-2 gap-4">
                    {tools.map(tool => (
                        <button
                            key={tool.id}
                            onClick={tool.action}
                            className={`p-5 rounded-2xl border transition-all text-left group hover:scale-[1.02] hover:shadow-md ${tool.color} border-transparent hover:border-black/5`}
                        >
                            <div className="mb-3 bg-white/60 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm group-hover:bg-white transition-colors">
                                {tool.icon}
                            </div>
                            <div className="font-bold text-lg mb-0.5">{tool.title}</div>
                            <div className="text-xs opacity-70 font-medium">{tool.description}</div>
                        </button>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default HomePage;
