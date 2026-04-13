import React from 'react';
import type { ExperimentPhase } from '../../types';
import { format, isWithinInterval, parseISO, differenceInDays } from 'date-fns';

interface ExperimentPhaseTimelineProps {
    phases: ExperimentPhase[];
    startDate: string;
    className?: string;
}

const PHASE_COLORS = [
    'bg-indigo-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-cyan-500',
    'bg-violet-500',
];

const ExperimentPhaseTimeline: React.FC<ExperimentPhaseTimelineProps> = ({ phases, className = '' }) => {
    if (phases.length === 0) return null;

    const today = new Date();
    const sortedPhases = [...phases].sort((a, b) => a.order - b.order);

    // Calculate total span
    const firstStart = parseISO(sortedPhases[0].startDate);
    const lastEnd = sortedPhases[sortedPhases.length - 1].endDate
        ? parseISO(sortedPhases[sortedPhases.length - 1].endDate!)
        : today;
    const totalDays = Math.max(differenceInDays(lastEnd, firstStart), 1);

    const getCurrentPhase = (): ExperimentPhase | undefined => {
        return sortedPhases.find(phase => {
            const start = parseISO(phase.startDate);
            const end = phase.endDate ? parseISO(phase.endDate) : new Date('2099-12-31');
            return isWithinInterval(today, { start, end });
        });
    };

    const currentPhase = getCurrentPhase();

    return (
        <div className={`space-y-2 ${className}`}>
            {/* Phase bar */}
            <div className="flex rounded-full overflow-hidden h-3 bg-slate-100">
                {sortedPhases.map((phase, i) => {
                    const phaseStart = parseISO(phase.startDate);
                    const phaseEnd = phase.endDate ? parseISO(phase.endDate) : lastEnd;
                    const phaseDays = Math.max(differenceInDays(phaseEnd, phaseStart), 1);
                    const widthPercent = (phaseDays / totalDays) * 100;
                    const isCurrent = currentPhase?.id === phase.id;

                    return (
                        <div
                            key={phase.id}
                            className={`${PHASE_COLORS[i % PHASE_COLORS.length]} ${isCurrent ? 'ring-2 ring-offset-1 ring-indigo-400' : 'opacity-60'} relative transition-all`}
                            style={{ width: `${widthPercent}%` }}
                            title={`${phase.name}: ${format(phaseStart, 'MMM d')} - ${phase.endDate ? format(phaseEnd, 'MMM d') : 'ongoing'}`}
                        />
                    );
                })}
            </div>

            {/* Phase labels */}
            <div className="flex gap-3 flex-wrap">
                {sortedPhases.map((phase, i) => {
                    const isCurrent = currentPhase?.id === phase.id;
                    return (
                        <div key={phase.id} className="flex items-center gap-1.5">
                            <div className={`w-2.5 h-2.5 rounded-full ${PHASE_COLORS[i % PHASE_COLORS.length]} ${isCurrent ? '' : 'opacity-50'}`} />
                            <span className={`text-xs ${isCurrent ? 'font-semibold text-slate-800' : 'text-slate-500'}`}>
                                {phase.name}
                            </span>
                            {isCurrent && (
                                <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">
                                    Current
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export function getCurrentPhaseForDate(phases: ExperimentPhase[], date: Date): ExperimentPhase | undefined {
    return [...phases].sort((a, b) => a.order - b.order).find(phase => {
        const start = parseISO(phase.startDate);
        const end = phase.endDate ? parseISO(phase.endDate) : new Date('2099-12-31');
        return isWithinInterval(date, { start, end });
    });
}

export default ExperimentPhaseTimeline;
