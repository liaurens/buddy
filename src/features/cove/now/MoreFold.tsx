import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, isSameDay, subDays } from 'date-fns';
import { useAuth } from '../../../hooks/useAuth';
import { useTasks } from '../../tasks/hooks/useTasks';
import { getRoutineProgress, ROUTINE_PROGRESS_EVENT } from '../../day/services/routine-progress';
import { getClosedDatesThisWeek } from '../../planning/services/closeDay.service';
import Fold from '../components/Fold';

interface MoreFoldProps {
    dateKey: string;
    streak: number;
}

const BAR_MAX_HEIGHT = 64;

function useRoutineSnapshot(dateKey: string) {
    const [snapshot, setSnapshot] = useState(() => getRoutineProgress(dateKey));
    useEffect(() => {
        setSnapshot(getRoutineProgress(dateKey));
        const onChange = () => setSnapshot(getRoutineProgress(dateKey));
        window.addEventListener(ROUTINE_PROGRESS_EVENT, onChange);
        return () => window.removeEventListener(ROUTINE_PROGRESS_EVENT, onChange);
    }, [dateKey]);
    return snapshot;
}

const RoutineRow: React.FC<{ label: string; done: boolean; hint: string }> = ({
    label,
    done,
    hint,
}) => (
    <div className="flex items-center gap-3">
        <span
            className="box-border flex h-6 w-6 items-center justify-center rounded-full border-[2.5px] text-xs font-extrabold"
            style={{
                background: done ? '#5cb586' : 'transparent',
                borderColor: done ? '#5cb586' : '#c6dbe7',
                color: done ? '#fff' : 'transparent',
            }}
            aria-hidden
        >
            ✓
        </span>
        <span className="flex-1 text-[13.5px] font-extrabold text-cove-ink">{label}</span>
        <span className="text-[11.5px] font-bold text-cove-faint">{hint}</span>
    </div>
);

/** "More — routine & stats": everything numeric on Now stays behind this fold. */
const MoreFold: React.FC<MoreFoldProps> = ({ dateKey, streak }) => {
    const { user } = useAuth();
    const { tasks } = useTasks();
    const routine = useRoutineSnapshot(dateKey);
    const hour = new Date().getHours();

    const closedThisWeek = useQuery({
        queryKey: ['closedDatesThisWeek', user?.id],
        queryFn: () => getClosedDatesThisWeek(user!.id),
        enabled: !!user?.id,
        staleTime: 60_000,
    });

    const week = useMemo(() => {
        const today = new Date();
        return Array.from({ length: 7 }, (_, i) => {
            const day = subDays(today, 6 - i);
            const count = tasks.filter(
                (t) => t.completedAt && isSameDay(new Date(t.completedAt), day),
            ).length;
            return { day, count, isToday: i === 6 };
        });
    }, [tasks]);

    const doneThisWeek = week.reduce((sum, w) => sum + w.count, 0);
    const insight = useMemo(() => {
        if (doneThisWeek === 0) return 'A quiet week so far — small steps count.';
        const best = week.reduce((a, b) => (b.count > a.count ? b : a));
        return `A steady week. ${format(best.day, 'EEEE')}s are your strongest day.`;
    }, [week, doneThisWeek]);

    const routinesKept = `${(closedThisWeek.data ?? []).length}/7`;

    return (
        <Fold label="More — routine & stats" openLabel="Less" align="center" className="mt-2">
            <div className="flex flex-col gap-2.5">
                <div className="app-surface rounded-card-lg p-4">
                    <div className="app-label mb-3">Daily routine</div>
                    <div className="flex flex-col gap-2.5">
                        <RoutineRow
                            label="Morning check-in"
                            done={routine.morning}
                            hint={routine.morning ? 'done' : 'open'}
                        />
                        <RoutineRow
                            label="Midday reset"
                            done={routine.midday}
                            hint={routine.midday ? 'done' : hour < 12 ? 'later' : 'now'}
                        />
                        <RoutineRow
                            label="Evening close-day"
                            done={routine.night}
                            hint={routine.night ? 'done' : 'this evening'}
                        />
                    </div>
                </div>

                <div className="app-surface rounded-card-lg p-4">
                    <div className="app-label mb-3">Your week</div>
                    <div className="flex h-16 items-end gap-2">
                        {week.map((w) => (
                            <div
                                key={w.day.toISOString()}
                                className="flex h-full flex-1 flex-col items-center justify-end gap-[5px]"
                            >
                                <div
                                    className="w-full max-w-[26px] rounded-t-[7px] rounded-b-[3px]"
                                    style={{
                                        height: Math.min(
                                            w.count === 0 ? 6 : 14 + w.count * 14,
                                            BAR_MAX_HEIGHT,
                                        ),
                                        background: w.isToday
                                            ? 'var(--cove-accent)'
                                            : w.count === 0
                                              ? '#e3eef5'
                                              : '#bcd8e8',
                                    }}
                                />
                                <span
                                    className="text-[10.5px] font-extrabold"
                                    style={{ color: w.isToday ? '#1d3a4d' : '#9cb9c9' }}
                                >
                                    {format(w.day, 'EEEEE')}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 text-[12.5px] font-semibold leading-normal text-cove-muted">
                        {insight}
                    </div>
                </div>

                <div className="app-surface flex justify-around rounded-card-lg p-4 text-center">
                    <div>
                        <div className="text-[22px] font-black text-cove-ink">{doneThisWeek}</div>
                        <div className="text-[11.5px] font-bold text-cove-faint">
                            done this week
                        </div>
                    </div>
                    <div>
                        <div className="text-[22px] font-black text-cove-streak-deep">{streak}</div>
                        <div className="text-[11.5px] font-bold text-cove-faint">day streak</div>
                    </div>
                    <div>
                        <div className="text-[22px] font-black text-cove-success-deep">
                            {routinesKept}
                        </div>
                        <div className="text-[11.5px] font-bold text-cove-faint">routines kept</div>
                    </div>
                </div>
            </div>
        </Fold>
    );
};

export default MoreFold;
