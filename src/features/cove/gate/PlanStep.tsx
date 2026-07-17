import React from 'react';
import { differenceInCalendarDays, format } from 'date-fns';
import type { Task } from '../../tasks/types';
import type { Assignment } from '../../../services/supabase';
import { parseDueDate } from '../../tasks/utils/dueDates';
import MorningProtocolsCard from '../../day/components/MorningProtocolsCard';
import Fold from '../components/Fold';

interface PlanStepProps {
    survival: boolean;
    intention: string;
    onIntention: (value: string) => void;
    /** Today's picks: already-planned tasks plus fresh suggestions, in order. */
    picks: Array<{ task: Task; suggested: boolean }>;
    deadlines: Assignment[];
}

function formatDeadline(deadline: string, today: Date): string {
    const due = parseDueDate(deadline);
    const days = differenceInCalendarDays(due, today);
    if (days < 0) return 'overdue';
    if (days === 0) return 'today';
    if (days === 1) return 'tomorrow';
    if (days < 7) return format(due, 'EEE');
    if (days < 14) return `next ${format(due, 'EEE')}`;
    return format(due, 'MMM d');
}

/** Gate step 3 — protocols, one-word intention, the auto-picked tasks, and folded school deadlines. */
const PlanStep: React.FC<PlanStepProps> = ({
    survival,
    intention,
    onIntention,
    picks,
    deadlines,
}) => {
    const today = new Date();
    return (
        <div className="cove-fadeslide mt-4 flex flex-col gap-3">
            <div>
                <div className="px-0.5 pb-1 text-[15px] font-extrabold text-cove-ink">
                    Plan today
                </div>
                <div className="px-0.5 pb-1 text-[12.5px] font-semibold text-cove-soft">
                    Meds, one word, and your picks. That’s the whole plan.
                </div>
            </div>

            <MorningProtocolsCard />

            <div className="rounded-card bg-white px-4 py-3.5 shadow-cove">
                <div className="mb-2 text-xs font-extrabold uppercase tracking-[0.06em] text-cove-soft">
                    One word for today{' '}
                    <span className="font-bold normal-case text-cove-faint">(optional)</span>
                </div>
                <input
                    value={intention}
                    onChange={(e) => onIntention(e.target.value)}
                    placeholder="rest · focus · catch up · …"
                    className="w-full rounded-[10px] border-0 bg-[#eef6fa] px-3 py-2.5 text-[15px] font-extrabold text-cove-ink outline-none"
                />
            </div>

            <div className="rounded-card bg-white px-4 py-3.5 shadow-cove">
                <div className="mb-2.5 text-xs font-extrabold uppercase tracking-[0.06em] text-cove-soft">
                    {survival ? 'Your one pick' : 'Your three picks'}
                </div>
                {picks.length === 0 ? (
                    <div className="rounded-xl bg-[#eef6fa] px-3 py-2.5 text-[13px] font-bold text-cove-muted">
                        Nothing to pick from yet — capture a task or two first.
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {picks.map(({ task }) => (
                            <div
                                key={task.id}
                                className="flex items-center gap-[11px] rounded-xl bg-[#eef6fa] px-[13px] py-[11px]"
                            >
                                <span className="h-2 w-2 flex-none rounded-full bg-cove-accent" />
                                <span className="flex-1 text-[13.5px] font-extrabold text-cove-ink">
                                    {task.title}
                                </span>
                                {task.estimatedTime ? (
                                    <span className="text-[11.5px] font-bold text-cove-faint">
                                        {task.estimatedTime} min
                                    </span>
                                ) : null}
                            </div>
                        ))}
                    </div>
                )}
                <div className="mt-2 text-[11.5px] font-semibold text-cove-faint">
                    Picked for you — smallest wins first. Swap them on the Tasks screen.
                </div>
            </div>

            {deadlines.length > 0 ? (
                <Fold
                    label={`School deadlines (${deadlines.length})`}
                    openLabel="Hide school deadlines"
                >
                    <div className="rounded-card bg-white px-4 py-3.5 shadow-cove">
                        <div className="flex flex-col gap-[9px]">
                            {deadlines.map((a, i) => (
                                <div key={a.id} className="flex items-center gap-[11px]">
                                    <span
                                        className="h-2 w-2 flex-none rounded-[2px]"
                                        style={{ background: i === 0 ? '#f2a541' : '#7cc3e8' }}
                                    />
                                    <span className="flex-1 text-[13px] font-extrabold text-cove-ink">
                                        {a.title}
                                    </span>
                                    <span
                                        className="text-[11.5px] font-bold"
                                        style={{ color: i === 0 ? '#c07a1e' : '#9cb9c9' }}
                                    >
                                        {formatDeadline(a.deadline, today)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </Fold>
            ) : null}
        </div>
    );
};

export default PlanStep;
