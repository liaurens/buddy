import React, { useState } from 'react';
import { format } from 'date-fns';
import { Sun, Sunrise, Moon } from 'lucide-react';
import { ReflectionPage } from '../../planning';
import MorningRoutine from '../components/MorningRoutine';
import MiddayRoutine from '../components/MiddayRoutine';

type Mode = 'morning' | 'midday' | 'night';

function modeForHour(hour: number): Mode {
    if (hour < 11) return 'morning';
    if (hour < 17) return 'midday';
    return 'night';
}

const TABS: Array<{ key: Mode; label: string; Icon: typeof Sun }> = [
    { key: 'morning', label: 'Morning', Icon: Sunrise },
    { key: 'midday', label: 'Midday', Icon: Sun },
    { key: 'night', label: 'Night', Icon: Moon },
];

/**
 * Day view scaffold. Auto-selects mode by time of day and embeds the existing
 * Plan / Check-in / Reflection pages. Full split (per Phase 3 of the streamlining plan)
 * requires auditing PlannerPage.tsx; until that audit, this thin shell collapses
 * the four daily-loop destinations into one IA destination.
 */
interface DayPageProps {
    onNavigate?: (tab: import('../../../constants/routes').AppRoute) => void;
}

const DayPage: React.FC<DayPageProps> = ({ onNavigate }) => {
    const today = new Date();
    const [mode, setMode] = useState<Mode>(modeForHour(today.getHours()));

    return (
        <div className="max-w-2xl mx-auto space-y-4">
            <header>
                <p className="text-slate-500 text-sm font-medium">{format(today, 'EEEE, MMMM do')}</p>
                <h1 className="text-3xl font-bold text-slate-900 mt-1">Today</h1>
            </header>

            <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-xl">
                {TABS.map(({ key, label, Icon }) => (
                    <button
                        key={key}
                        onClick={() => setMode(key)}
                        className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                            mode === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <Icon size={16} />
                        {label}
                    </button>
                ))}
            </div>

            {mode === 'morning' && <MorningRoutine onNavigate={onNavigate} />}
            {mode === 'midday' && <MiddayRoutine />}
            {mode === 'night' && <ReflectionPage />}
        </div>
    );
};

export default DayPage;
