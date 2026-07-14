import React from 'react';
import {
    Activity,
    Calendar,
    StickyNote,
    TrendingUp,
    CheckSquare,
    Bell,
    GraduationCap,
    ChevronRight,
    Heart,
    Settings,
    Sparkles,
    Sun,
} from 'lucide-react';
import type { AppRoute } from '../../../constants/routes';
import InsightCard from '../../core/components/InsightCard';

interface BrowsePageProps {
    onNavigate: (tab: AppRoute, params?: Record<string, unknown>) => void;
}

const SHORTCUTS: Array<{
    tab: AppRoute;
    label: string;
    Icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
    { tab: 'today', label: 'Routines', Icon: Sun },
    { tab: 'calendar', label: 'Calendar', Icon: Calendar },
    { tab: 'notes', label: 'Notes', Icon: StickyNote },
    { tab: 'school', label: 'School', Icon: GraduationCap },
    { tab: 'health', label: 'Health', Icon: Heart },
];

const EXPLORE: Array<{
    tab: AppRoute;
    label: string;
    desc: string;
    Icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
    { tab: 'tasks', label: 'Tasks', desc: 'Organize and get things done', Icon: CheckSquare },
    { tab: 'notes', label: 'Notes', desc: 'Capture and connect ideas', Icon: StickyNote },
    {
        tab: 'school',
        label: 'School',
        desc: 'Classes, assignments, and grades',
        Icon: GraduationCap,
    },
    { tab: 'calendar', label: 'Calendar', desc: 'Events and time blocking', Icon: Calendar },
    { tab: 'health', label: 'Health', desc: 'Track habits and wellness', Icon: Activity },
    {
        tab: 'reflection',
        label: 'Reflection & Growth',
        desc: 'Journal, goals, and skills',
        Icon: TrendingUp,
    },
    {
        tab: 'assistant',
        label: 'AI Capture',
        desc: 'Smart capture and suggestions',
        Icon: Sparkles,
    },
];

const MORE: Array<{
    tab: AppRoute;
    label: string;
    desc: string;
    Icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
    {
        tab: 'notifications',
        label: 'Notifications',
        desc: 'Manage alerts and reminders',
        Icon: Bell,
    },
    { tab: 'me', label: 'Settings', desc: 'Preferences and app settings', Icon: Settings },
];

const BrowsePage: React.FC<BrowsePageProps> = ({ onNavigate }) => {
    return (
        <div className="app-page">
            <header className="hidden items-end justify-between gap-4 lg:flex">
                <div>
                    <h1 className="app-title">Browse</h1>
                    <p className="app-subtitle">All your stuff in one place.</p>
                </div>
            </header>

            <div className="mx-auto max-w-3xl space-y-7 lg:mx-0 lg:max-w-5xl">
                <InsightCard />

                <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-slate-950">Shortcuts</h2>
                    <div className="grid grid-cols-5 gap-2.5">
                        {SHORTCUTS.map(({ tab, label, Icon }) => (
                            <button
                                key={tab}
                                onClick={() => onNavigate(tab)}
                                className="app-surface flex aspect-square min-h-[4.7rem] flex-col items-center justify-center gap-2 text-center"
                            >
                                <Icon size={21} className="text-indigo-800" />
                                <span className="max-w-full truncate px-1 text-xs font-medium text-slate-800">
                                    {label}
                                </span>
                            </button>
                        ))}
                    </div>
                </section>

                <BrowseList title="Explore" items={EXPLORE} onNavigate={onNavigate} />
                <BrowseList title="More" items={MORE} onNavigate={onNavigate} />
            </div>
        </div>
    );
};

const BrowseList: React.FC<{
    title: string;
    items: Array<{
        tab: AppRoute;
        label: string;
        desc: string;
        Icon: React.ComponentType<{ size?: number; className?: string }>;
    }>;
    onNavigate: (tab: AppRoute) => void;
}> = ({ title, items, onNavigate }) => (
    <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
        <div className="app-surface overflow-hidden">
            {items.map(({ tab, label, desc, Icon }) => (
                <button
                    key={tab}
                    onClick={() => onNavigate(tab)}
                    className="flex w-full items-center gap-4 border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-slate-50"
                >
                    <Icon size={22} className="text-indigo-800" />
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">
                            {label}
                        </span>
                        <span className="block truncate text-xs text-slate-500">{desc}</span>
                    </span>
                    <ChevronRight size={17} className="text-slate-300" />
                </button>
            ))}
        </div>
    </section>
);

export default BrowsePage;
