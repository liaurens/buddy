import React from 'react';
import {
    Calendar,
    CheckSquare,
    GraduationCap,
    Heart,
    StickyNote,
    Timer,
    TrendingUp,
    Wrench,
} from 'lucide-react';
import type { AppRoute } from '../../../constants/routes';

interface BrowsePageProps {
    onNavigate: (tab: AppRoute, params?: Record<string, unknown>) => void;
}

const ITEMS: Array<{
    tab: AppRoute;
    label: string;
    desc: string;
    Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
    tileBg: string;
    iconColor: string;
}> = [
    {
        tab: 'school',
        label: 'School',
        desc: 'Classes, assignments, deadlines',
        Icon: GraduationCap,
        tileBg: '#e3f0fa',
        iconColor: '#4d9fd6',
    },
    {
        tab: 'calendar',
        label: 'Calendar',
        desc: 'Events & timed picks',
        Icon: Calendar,
        tileBg: '#e6f4ec',
        iconColor: '#5cb586',
    },
    {
        tab: 'health',
        label: 'Health',
        desc: 'Check-in, trends, protocols',
        Icon: Heart,
        tileBg: '#fbe9ec',
        iconColor: '#e8899a',
    },
    {
        tab: 'notes',
        label: 'Notes',
        desc: 'Quick & smart notes',
        Icon: StickyNote,
        tileBg: '#efe9f8',
        iconColor: '#9c8ad0',
    },
    {
        tab: 'focus',
        label: 'Focus timer',
        desc: 'Pomodoro for one task',
        Icon: Timer,
        tileBg: '#fdeeda',
        iconColor: '#f2a541',
    },
    {
        tab: 'checklists',
        label: 'Checklists',
        desc: 'Incl. calendar-triggered',
        Icon: CheckSquare,
        tileBg: '#e3f0fa',
        iconColor: '#7cc3e8',
    },
    {
        tab: 'toolbox',
        label: 'Toolbox',
        desc: 'Coping tools & strategies',
        Icon: Wrench,
        tileBg: '#e6f4ec',
        iconColor: '#3d8a63',
    },
    {
        tab: 'reflection',
        label: 'Reflect',
        desc: 'Journal, goals, skills',
        Icon: TrendingUp,
        tileBg: '#efe9f8',
        iconColor: '#7a5fb0',
    },
];

/** Browse — everything else lives here, out of the way until you want it. */
const BrowsePage: React.FC<BrowsePageProps> = ({ onNavigate }) => (
    <div className="cove-fadeslide flex flex-col">
        <div className="px-1 pb-1 pt-1.5 text-[22px] font-black text-cove-ink">Browse</div>
        <div className="px-1 pb-[18px] text-[13.5px] font-semibold text-cove-muted">
            Everything else lives here — out of the way until you want it.
        </div>
        <div className="grid grid-cols-2 gap-3">
            {ITEMS.map(({ tab, label, desc, Icon, tileBg, iconColor }) => (
                <button
                    key={tab}
                    type="button"
                    onClick={() => onNavigate(tab)}
                    className="flex flex-col gap-2 rounded-card-lg bg-white px-4 py-[18px] text-left shadow-cove transition-shadow hover:shadow-[0_6px_18px_rgba(40,90,130,0.14)]"
                >
                    <span
                        className="flex h-[34px] w-[34px] items-center justify-center rounded-xl"
                        style={{ background: tileBg }}
                    >
                        <Icon size={17} style={{ color: iconColor }} />
                    </span>
                    <span className="text-[14.5px] font-extrabold text-cove-ink">{label}</span>
                    <span className="text-xs font-semibold leading-[1.4] text-cove-soft">
                        {desc}
                    </span>
                </button>
            ))}
        </div>
    </div>
);

export default BrowsePage;
