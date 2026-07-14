import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Sun, Sunrise, Moon, LifeBuoy, Zap } from 'lucide-react';
import { ReflectionPage } from '../../planning';
import FullMorning from '../components/FullMorning';
import FullMidday from '../components/FullMidday';
import LightMorning from '../components/LightMorning';
import LightMidday from '../components/LightMidday';
import TriggeredChecklistsCard from '../components/TriggeredChecklistsCard';
import { useDayCapacity } from '../hooks/useDayCapacity';

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
    const dateKey = format(today, 'yyyy-MM-dd');
    const deepLinkStep = isMode(initialParams?.step) ? initialParams.step : null;
    const [mode, setMode] = useState<Mode>(deepLinkStep ?? modeForHour(today.getHours()));
    // An anchor deep link means "get me to the pick/close flow" — skip straight
    // to the plan step inside the morning wizard.
    const startAtPlan = deepLinkStep === 'morning';

    // The one capacity question: normal day or survival day? Per-day, persisted
    // on daily_plans so notifications can respect it server-side.
    const { capacity, setCapacity } = useDayCapacity(dateKey);
    const isSurvival = capacity === 'survival';

    // Full-vs-light is now a secondary preference (survival always runs light).
    const [routineMode, setRoutineMode] = useState<RoutineMode>(() => {
        try {
            const saved = localStorage.getItem('routine_mode');
            return saved === 'full' ? 'full' : 'light';
        } catch {
            return 'light';
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem('routine_mode', routineMode);
        } catch {
            /* ignore */
        }
    }, [routineMode]);

    const isLight = isSurvival || routineMode === 'light';

    return (
        <div className="app-page-readable">
            <header className="hidden lg:block">
                <p className="text-sm font-medium text-slate-500">
                    {format(today, 'EEEE, MMMM do')}
                </p>
                <h1 className="app-title mt-1">Today</h1>
            </header>

            {/* Capacity toggle — the single "what kind of day is this?" decision */}
            <div className="app-segmented">
                <button
                    onClick={() => void setCapacity('normal')}
                    className={`app-segment ${!isSurvival ? 'app-segment-active' : ''}`}
                >
                    <Sun size={14} /> Normal day
                </button>
                <button
                    onClick={() => void setCapacity('survival')}
                    className={`app-segment ${isSurvival ? 'app-segment-active' : ''}`}
                >
                    <LifeBuoy size={14} /> Survival day
                </button>
            </div>

            {isSurvival && (
                <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
                    Survival mode: one task is enough, and only the anchor reminders will reach you
                    today.
                </div>
            )}

            <div className="app-segmented grid grid-cols-3">
                {TABS.map(({ key, label, Icon }) => (
                    <button
                        key={key}
                        onClick={() => setMode(key)}
                        className={`app-segment ${mode === key ? 'app-segment-active' : ''}`}
                    >
                        <Icon size={16} />
                        {label}
                    </button>
                ))}
            </div>

            {/* Checklists triggered by today's calendar events (e.g. work day → work checklist) */}
            {mode !== 'night' && !isSurvival && <TriggeredChecklistsCard />}

            {mode === 'morning' && !isSurvival && (
                <button
                    onClick={() => setRoutineMode(routineMode === 'full' ? 'light' : 'full')}
                    className="flex items-center gap-1 text-xs font-medium text-slate-400 transition-colors hover:text-slate-600"
                >
                    <Zap size={12} />
                    {routineMode === 'full'
                        ? 'Switch to the light routine'
                        : 'Switch to the full routine'}
                </button>
            )}

            {mode === 'morning' &&
                (isLight ? (
                    <LightMorning
                        onNavigate={onNavigate}
                        startAtPlan={startAtPlan}
                        pickSlots={isSurvival ? 1 : 3}
                    />
                ) : (
                    <FullMorning onNavigate={onNavigate} startAtPlan={startAtPlan} />
                ))}
            {mode === 'midday' &&
                (isLight ? (
                    <LightMidday onGoToMorning={() => setMode('morning')} />
                ) : (
                    <FullMidday onGoToMorning={() => setMode('morning')} />
                ))}
            {mode === 'night' && <ReflectionPage />}
        </div>
    );
};

export default DayPage;
