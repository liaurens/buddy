import React from 'react';
import { format } from 'date-fns';
import { Check, ChevronRight, Layers, Sunrise, Sun, Moon } from 'lucide-react';
import type { AppRoute } from '../../../constants/routes';

type Mode = 'morning' | 'midday' | 'night';

function currentMode(): Mode {
    const h = new Date().getHours();
    if (h < 11) return 'morning';
    if (h < 17) return 'midday';
    return 'night';
}

const MORNING_STEP_LABELS = ['Comms check', 'Log Yesterday', 'Tasks & Calendar', 'Plan Day'];

function getMorningNextStep(dateKey: string): string {
    try {
        const saved = sessionStorage.getItem(`morning_step_${dateKey}`);
        const step = saved !== null ? Number(saved) : 0;
        return `${MORNING_STEP_LABELS[step]} · Step ${step + 1} of 4`;
    } catch {
        return 'Comms check · Step 1 of 4';
    }
}

function isLightMode(): boolean {
    try { return localStorage.getItem('routine_mode') === 'light'; } catch { return false; }
}

function getLightHint(dateKey: string): string {
    try {
        const locked = sessionStorage.getItem(`light_locked_${dateKey}`) === '1';
        return locked ? 'Light day · check off your picks' : 'Light day · pick top 3';
    } catch {
        return 'Light day · pick top 3';
    }
}

const MODE_CONFIG: Record<Mode, {
    Icon: typeof Sunrise;
    greeting: string;
    subtitle: string;
}> = {
    morning: {
        Icon: Sunrise,
        greeting: 'Good morning',
        subtitle: 'Start your day right',
    },
    midday: {
        Icon: Sun,
        greeting: 'Good afternoon',
        subtitle: 'Check in & replan if needed',
    },
    night: {
        Icon: Moon,
        greeting: 'Good evening',
        subtitle: 'Wrap up your day',
    },
};

const MODE_NEXT_STEP: Record<Exclude<Mode, 'morning'>, string> = {
    midday: 'Midday replan',
    night: 'Evening reflection',
};

interface Props {
    onNavigate: (tab: AppRoute) => void;
}

const DailyRoutineCard: React.FC<Props> = ({ onNavigate }) => {
    const mode = currentMode();
    const dateKey = format(new Date(), 'yyyy-MM-dd');
    const { Icon, greeting, subtitle } = MODE_CONFIG[mode];

    const lightActive = isLightMode();
    const nextStep = lightActive
        ? getLightHint(dateKey)
        : mode === 'morning'
            ? getMorningNextStep(dateKey)
            : MODE_NEXT_STEP[mode];
    const steps = [
        {
            label: 'Morning check-in',
            active: mode === 'morning',
            done: mode !== 'morning',
            icon: <Sunrise size={15} />,
        },
        {
            label: 'Plan top priorities',
            active: mode === 'morning',
            done: mode !== 'morning',
            icon: <Layers size={15} />,
        },
        {
            label: 'Midday reset',
            active: mode === 'midday',
            done: mode === 'night',
            icon: <Sun size={15} />,
        },
        {
            label: 'Evening reflection',
            active: mode === 'night',
            done: false,
            icon: <Moon size={15} />,
        },
    ];
    const doneCount = steps.filter(step => step.done).length;
    const progress = Math.max(12, Math.round((doneCount / steps.length) * 100));

    return (
        <section className="rounded-lg border border-slate-200/90 bg-white shadow-[0_16px_42px_rgba(15,23,42,0.045)]">
            <button
                onClick={() => onNavigate('today')}
                className="group w-full p-5 text-left"
            >
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <Icon size={18} className="text-emerald-600" />
                            <h2 className="text-base font-semibold text-slate-950">Daily routine</h2>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{greeting} - {subtitle}</p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-slate-500">
                        {doneCount} of {steps.length} done
                    </span>
                </div>

                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <div className="mt-4 space-y-3">
                    {steps.map(step => (
                        <RoutineStep
                            key={step.label}
                            label={step.label}
                            active={step.active}
                            done={step.done}
                            icon={step.done ? <Check size={14} /> : step.icon}
                        />
                    ))}
                </div>
            </button>

            <button
                type="button"
                onClick={() => onNavigate('today')}
                className="flex w-full items-center justify-between border-t border-slate-100 px-5 py-3 text-sm font-medium text-indigo-900 transition-colors hover:bg-slate-50"
            >
                <span>{nextStep}</span>
                <ChevronRight size={15} className="text-slate-400" />
            </button>
        </section>
    );
};

const RoutineStep: React.FC<{
    label: string;
    active?: boolean;
    done?: boolean;
    icon: React.ReactNode;
}> = ({ label, active = false, done = false, icon }) => (
    <div className="flex min-w-0 items-center gap-3">
        <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                done
                    ? 'border-emerald-100 bg-emerald-500 text-white'
                    : active
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-400'
            }`}
        >
            {icon}
        </span>
        <span className={`truncate text-sm ${done || active ? 'font-medium text-slate-800' : 'text-slate-500'}`}>
            {label}
        </span>
    </div>
);

export default DailyRoutineCard;
