import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Sun, Sunrise, Moon, Coffee, Zap } from 'lucide-react';
import { ReflectionPage } from '../../planning';
import FullMorning from '../components/FullMorning';
import FullMidday from '../components/FullMidday';
import LightMorning from '../components/LightMorning';
import LightMidday from '../components/LightMidday';
import TriggeredChecklistsCard from '../components/TriggeredChecklistsCard';

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
    /** Deep-link params (e.g. { step: 'morning' } from an anchor notification). */
    initialParams?: Record<string, unknown> | null;
}

function isMode(value: unknown): value is Mode {
    return value === 'morning' || value === 'midday' || value === 'night';
}

const DayPage: React.FC<DayPageProps> = ({ onNavigate, initialParams }) => {
    const today = new Date();
    const deepLinkStep = isMode(initialParams?.step) ? initialParams.step : null;
    const [mode, setMode] = useState<Mode>(deepLinkStep ?? modeForHour(today.getHours()));
    // An anchor deep link means "get me to the pick/close flow" — skip straight
    // to the plan step inside the morning wizard.
    const startAtPlan = deepLinkStep === 'morning';
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
        <div className="app-page-readable">
            <header className="hidden lg:block">
                <p className="text-sm font-medium text-slate-500">{format(today, 'EEEE, MMMM do')}</p>
                <h1 className="app-title mt-1">Today</h1>
            </header>

            {/* Routine mode toggle */}
            <div className="app-segmented">
                <button
                    onClick={() => setRoutineMode('full')}
                    className={`app-segment ${
                        !isLight ? 'app-segment-active' : ''
                    }`}
                >
                    <Zap size={14} /> Full routine
                </button>
                <button
                    onClick={() => setRoutineMode('light')}
                    className={`app-segment ${
                        isLight ? 'app-segment-active' : ''
                    }`}
                >
                    <Coffee size={14} /> Light day
                </button>
            </div>

            <div className="app-segmented grid grid-cols-3">
                {TABS.map(({ key, label, Icon }) => (
                    <button
                        key={key}
                        onClick={() => setMode(key)}
                        className={`app-segment ${
                            mode === key ? 'app-segment-active' : ''
                        }`}
                    >
                        <Icon size={16} />
                        {label}
                    </button>
                ))}
            </div>

            {/* Checklists triggered by today's calendar events (e.g. work day → work checklist) */}
            {mode !== 'night' && <TriggeredChecklistsCard />}

            {mode === 'morning' && (isLight
                ? <LightMorning onNavigate={onNavigate} startAtPlan={startAtPlan} />
                : <FullMorning onNavigate={onNavigate} startAtPlan={startAtPlan} />)}
            {mode === 'midday' && (isLight
                ? <LightMidday onGoToMorning={() => setMode('morning')} />
                : <FullMidday onGoToMorning={() => setMode('morning')} />)}
            {mode === 'night' && <ReflectionPage />}
        </div>
    );
};

export default DayPage;
