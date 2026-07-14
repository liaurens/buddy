import React from 'react';
import { format } from 'date-fns';
import { Check, ChevronRight, Moon, PartyPopper, Sun, Sunrise } from 'lucide-react';
import type { AppRoute } from '../../../constants/routes';
import { useRoutineProgress } from '../../day/hooks/useRoutineProgress';
import { ROUTINE_PHASES, type RoutinePhase } from '../../day/services/routine-progress';

function currentPhase(): RoutinePhase {
    const h = new Date().getHours();
    if (h < 11) return 'morning';
    if (h < 17) return 'midday';
    return 'night';
}

const PHASE_CONFIG: Record<RoutinePhase, { Icon: typeof Sunrise; label: string; hint: string }> = {
    morning: { Icon: Sunrise, label: 'Morning check-in', hint: 'Comms, log yesterday, plan today' },
    midday: { Icon: Sun, label: 'Midday reset', hint: 'Check in & adjust your afternoon' },
    night: { Icon: Moon, label: 'Evening reflection', hint: 'Reflect and close the day' },
};

function nextStepLabel(progress: { morning: boolean; midday: boolean; night: boolean }): string {
    if (!progress.morning) return 'Start your morning check-in';
    if (!progress.midday) return 'Do your midday reset';
    if (!progress.night) return 'Reflect & close the day';
    return 'All done for today';
}

interface Props {
    onNavigate: (tab: AppRoute) => void;
}

const DailyRoutineCard: React.FC<Props> = ({ onNavigate }) => {
    const dateKey = format(new Date(), 'yyyy-MM-dd');
    const progress = useRoutineProgress(dateKey);
    const active = currentPhase();
    const allDone = progress.doneCount === ROUTINE_PHASES.length;
    const percent = Math.round((progress.doneCount / ROUTINE_PHASES.length) * 100);

    return (
        <section className="app-surface">
            <button onClick={() => onNavigate('today')} className="group w-full p-5 text-left">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            {allDone ? (
                                <PartyPopper size={18} className="text-emerald-600" />
                            ) : (
                                React.createElement(PHASE_CONFIG[active].Icon, {
                                    size: 18,
                                    className: 'text-emerald-600',
                                })
                            )}
                            <h2 className="text-base font-semibold text-slate-950">
                                Daily routine
                            </h2>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                            {allDone
                                ? 'Everything finished — nice work.'
                                : 'Counts only what you actually finished.'}
                        </p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-slate-500">
                        {progress.doneCount} of {ROUTINE_PHASES.length} done
                    </span>
                </div>

                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${percent}%` }}
                    />
                </div>

                <div className="mt-4 space-y-3">
                    {ROUTINE_PHASES.map((phase) => {
                        const { Icon, label, hint } = PHASE_CONFIG[phase];
                        const done = progress[phase];
                        const isNow = phase === active && !done;
                        return (
                            <div key={phase} className="flex min-w-0 items-center gap-3">
                                <span
                                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                                        done
                                            ? 'border-emerald-100 bg-emerald-500 text-white'
                                            : isNow
                                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                              : 'border-slate-200 bg-white text-slate-400'
                                    }`}
                                >
                                    {done ? <Check size={14} /> : <Icon size={15} />}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span
                                        className={`block truncate text-sm ${done || isNow ? 'font-medium text-slate-800' : 'text-slate-500'}`}
                                    >
                                        {label}
                                    </span>
                                    {isNow && (
                                        <span className="block truncate text-xs text-slate-400">
                                            {hint}
                                        </span>
                                    )}
                                </span>
                                {isNow && (
                                    <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                        Now
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </button>

            <button
                type="button"
                onClick={() => onNavigate('today')}
                className="flex w-full items-center justify-between border-t border-slate-100 px-5 py-3 text-sm font-medium text-indigo-900 transition-colors hover:bg-slate-50"
            >
                <span>{nextStepLabel(progress)}</span>
                <ChevronRight size={15} className="text-slate-400" />
            </button>
        </section>
    );
};

export default DailyRoutineCard;
