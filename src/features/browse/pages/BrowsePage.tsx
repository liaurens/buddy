import React from 'react';
import {
    Activity,
    Pill,
    FlaskConical,
    Calendar,
    StickyNote,
    ListChecks,
    Wrench,
    TrendingUp,
    CheckSquare,
    LayoutGrid,
    Timer,
    CalendarClock,
    Bell,
} from 'lucide-react';
import type { AppRoute } from '../../../constants/routes';

interface BrowsePageProps {
    onNavigate: (tab: AppRoute, params?: Record<string, unknown>) => void;
}

const ITEMS: Array<{ tab: AppRoute; label: string; Icon: React.ComponentType<{ size?: number; className?: string }>; group: string }> = [
    { tab: 'tasks', label: 'Tasks', Icon: CheckSquare, group: 'Stuff' },
    { tab: 'notes', label: 'Notes', Icon: StickyNote, group: 'Stuff' },
    { tab: 'checklists', label: 'Checklists', Icon: ListChecks, group: 'Stuff' },
    { tab: 'toolbox', label: 'Strategies', Icon: Wrench, group: 'Stuff' },
    { tab: 'growth', label: 'Growth', Icon: TrendingUp, group: 'Stuff' },

    { tab: 'health', label: 'Trackers', Icon: Activity, group: 'Health' },
    { tab: 'protocols', label: 'Protocols', Icon: Pill, group: 'Health' },
    { tab: 'experiments', label: 'Experiments', Icon: FlaskConical, group: 'Health' },

    { tab: 'calendar', label: 'Calendar', Icon: Calendar, group: 'Time' },
    { tab: 'planning', label: 'Plan', Icon: CalendarClock, group: 'Time' },
    { tab: 'planner', label: 'AI Planner', Icon: LayoutGrid, group: 'Time' },
    { tab: 'reflection', label: 'Reflect', Icon: TrendingUp, group: 'Time' },
    { tab: 'focus', label: 'Focus Timer', Icon: Timer, group: 'Time' },

    { tab: 'notifications', label: 'Notifications', Icon: Bell, group: 'Settings' },
];

const BrowsePage: React.FC<BrowsePageProps> = ({ onNavigate }) => {
    const groups = Array.from(new Set(ITEMS.map(i => i.group)));

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <header>
                <h1 className="text-3xl font-bold text-slate-900">Browse</h1>
                <p className="text-sm text-slate-500 mt-1">All your stuff in one place.</p>
            </header>

            {groups.map(group => (
                <section key={group}>
                    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{group}</h2>
                    <div className="grid grid-cols-2 gap-3">
                        {ITEMS.filter(i => i.group === group).map(({ tab, label, Icon }) => (
                            <button
                                key={tab}
                                onClick={() => onNavigate(tab)}
                                className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-slate-100 shadow-sm hover:bg-slate-50 transition-colors text-left"
                            >
                                <Icon size={20} className="text-indigo-600" />
                                <span className="text-sm font-medium text-slate-700">{label}</span>
                            </button>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
};

export default BrowsePage;
