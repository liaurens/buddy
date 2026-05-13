import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Sun, Sunrise, Moon, Coffee, Zap } from 'lucide-react';
import { ReflectionPage } from '../../planning';
import FullMorning from '../components/FullMorning';
import FullMidday from '../components/FullMidday';
import LightMorning from '../components/LightMorning';
import LightMidday from '../components/LightMidday';

type Mode = 'morning' | 'midday' | 'night';
type RoutineMode = 'full' | 'light';

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

interface DayPageProps {
    onNavigate?: (tab: import('../../../constants/routes').AppRoute) => void;
}

const DayPage: React.FC<DayPageProps> = ({ onNavigate }) => {
    const today = new Date();
    const [mode, setMode] = useState<Mode>(modeForHour(today.getHours()));
    const [routineMode, setRoutineMode] = useState<RoutineMode>(() => {
        try {
            const saved = localStorage.getItem('routine_mode');
            return saved === 'full' ? 'full' : 'light';
        } catch { return 'light'; }
    });

    useEffect(() => {
        try { localStorage.setItem('routine_mode', routineMode); } catch { /* ignore */ }
    }, [routineMode]);

    const isLight = routineMode === 'light';

    return (
        <div className="max-w-2xl mx-auto space-y-4">
            <header>
                <p className="text-slate-500 text-sm font-medium">{format(today, 'EEEE, MMMM do')}</p>
                <h1 className="text-3xl font-bold text-slate-900 mt-1">Today</h1>
            </header>

            {/* Routine mode toggle */}
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                <button
                    onClick={() => setRoutineMode('full')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                        !isLight ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <Zap size={14} /> Full routine
                </button>
                <button
                    onClick={() => setRoutineMode('light')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isLight ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <Coffee size={14} /> Light day
                </button>
            </div>

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

            {mode === 'morning' && (isLight
                ? <LightMorning onNavigate={onNavigate} />
                : <FullMorning onNavigate={onNavigate} />)}
            {mode === 'midday' && (isLight
                ? <LightMidday onGoToMorning={() => setMode('morning')} />
                : <FullMidday onGoToMorning={() => setMode('morning')} />)}
            {mode === 'night' && <ReflectionPage />}
        </div>
    );
};

export default DayPage;
