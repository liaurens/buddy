import React from 'react';
import { Sunrise, Sun, Moon, ChevronRight } from 'lucide-react';
import type { AppRoute } from '../../../constants/routes';

type Mode = 'morning' | 'midday' | 'night';

function currentMode(): Mode {
    const h = new Date().getHours();
    if (h < 11) return 'morning';
    if (h < 17) return 'midday';
    return 'night';
}

const MODE_CONFIG: Record<Mode, {
    Icon: typeof Sunrise;
    greeting: string;
    subtitle: string;
    nextStep: string;
    gradient: string;
    iconColor: string;
}> = {
    morning: {
        Icon: Sunrise,
        greeting: 'Good morning',
        subtitle: 'Start your day right',
        nextStep: 'Comms check · Step 1 of 4',
        gradient: 'from-amber-50 to-orange-50',
        iconColor: 'text-amber-500',
    },
    midday: {
        Icon: Sun,
        greeting: 'Good afternoon',
        subtitle: 'Check in & replan if needed',
        nextStep: 'Midday replan',
        gradient: 'from-sky-50 to-indigo-50',
        iconColor: 'text-sky-500',
    },
    night: {
        Icon: Moon,
        greeting: 'Good evening',
        subtitle: 'Wrap up your day',
        nextStep: 'Evening reflection',
        gradient: 'from-indigo-50 to-violet-50',
        iconColor: 'text-indigo-500',
    },
};

interface Props {
    onNavigate: (tab: AppRoute) => void;
}

const DailyRoutineCard: React.FC<Props> = ({ onNavigate }) => {
    const mode = currentMode();
    const { Icon, greeting, subtitle, nextStep, gradient, iconColor } = MODE_CONFIG[mode];

    return (
        <button
            onClick={() => onNavigate('today')}
            className={`w-full text-left bg-gradient-to-br ${gradient} border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group`}
        >
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm`}>
                        <Icon size={20} className={iconColor} />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{greeting}</p>
                        <p className="text-sm text-slate-600">{subtitle}</p>
                    </div>
                </div>
                <ChevronRight size={18} className="text-slate-400 group-hover:text-slate-600 mt-1 transition-colors" />
            </div>

            <div className="mt-1">
                <p className="text-base font-semibold text-slate-800">{nextStep}</p>
            </div>

            <div className="mt-3 w-full bg-white/70 rounded-lg px-4 py-2.5 text-sm font-medium text-center text-slate-700 group-hover:bg-white transition-colors">
                Open {mode === 'morning' ? 'morning routine' : mode === 'midday' ? 'midday replan' : 'evening reflection'} →
            </div>
        </button>
    );
};

export default DailyRoutineCard;
