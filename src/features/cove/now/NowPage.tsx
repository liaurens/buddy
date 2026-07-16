import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useAuth } from '../../../hooks/useAuth';
import type { AppRoute } from '../../../constants/routes';
import { useTodayItems } from '../../day/hooks/useTodayItems';
import { useDayCapacity } from '../../day/hooks/useDayCapacity';
import { useTasks } from '../../tasks/hooks/useTasks';
import { getRankedTasks } from '../../tasks/utils/taskRecommender';
import { sortTasksCanonical } from '../../tasks/utils/taskOrdering';
import { getCloseStreak } from '../../planning/services/closeDay.service';
import type { Task } from '../../tasks/types';
import { Whale, SpeechBubble, Confetti, PickCircle, TagChip, taskTagFor } from '../components';
import { useCelebration } from '../hooks/useCelebration';
import { whaleCopy } from './whaleCopy';
import { dismissMidday, isMiddayDismissed, middayLine, shouldShowMidday } from './middayVisibility';
import MoreFold from './MoreFold';

interface NowPageProps {
    onNavigate: (tab: AppRoute, params?: Record<string, unknown>) => void;
}

const PickCard: React.FC<{
    task: Task;
    bursting: boolean;
    onToggle: (task: Task) => void;
}> = ({ task, bursting, onToggle }) => {
    const tag = taskTagFor(task);
    return (
        <div className="relative">
            {bursting ? <Confetti className="left-[34px] top-[32px]" /> : null}
            <button
                type="button"
                onClick={() => onToggle(task)}
                className="flex w-full items-center gap-3.5 rounded-card-lg bg-white p-4 text-left shadow-cove"
            >
                <PickCircle done={task.completed} size={34} />
                <span className="min-w-0 flex-1">
                    <span
                        className="block text-[15px] font-extrabold leading-[1.3]"
                        style={{ color: task.completed ? '#9cb9c9' : '#1d3a4d' }}
                    >
                        {task.title}
                    </span>
                    {tag ? <TagChip tag={tag} className="mt-[5px]" /> : null}
                </span>
            </button>
        </div>
    );
};

const NowPage: React.FC<NowPageProps> = ({ onNavigate }) => {
    const { user } = useAuth();
    const dateKey = format(new Date(), 'yyyy-MM-dd');
    const hour = new Date().getHours();

    const { picks, completedCount } = useTodayItems(dateKey);
    const { capacity } = useDayCapacity(dateKey);
    const { toggleTask } = useTasks();
    const { burstId, celebrate } = useCelebration();
    const [middayDismissed, setMiddayDismissed] = useState(() => isMiddayDismissed(dateKey));

    const survival = capacity === 'survival';

    const visiblePicks = useMemo(() => {
        const scoreById = new Map(getRankedTasks(picks).map((r) => [r.task.id, r.score] as const));
        const sorted = sortTasksCanonical(picks, scoreById);
        return survival ? sorted.slice(0, 1) : sorted;
    }, [picks, survival]);

    const visibleDone = visiblePicks.filter((p) => p.completed).length;
    const allDone = visiblePicks.length > 0 && visibleDone === visiblePicks.length;

    const copy = whaleCopy(visibleDone, visiblePicks.length, hour, survival);

    const streakQuery = useQuery({
        queryKey: ['closeStreak', user?.id],
        queryFn: () => getCloseStreak(user!.id),
        enabled: !!user?.id,
        staleTime: 60_000,
    });
    const streak = streakQuery.data ?? 0;

    const showMidday = shouldShowMidday(hour, {
        donePicks: visibleDone,
        totalPicks: visiblePicks.length,
        dismissed: middayDismissed,
    });

    const handleToggle = (task: Task) => {
        if (!task.completed) celebrate(task.id);
        void toggleTask(task.id);
    };

    const handleDismissMidday = () => {
        dismissMidday(dateKey);
        setMiddayDismissed(true);
    };

    // Until the close-day overlay lands (Phase 4), closing routes to the
    // existing reflection close-day surface.
    const openCloseDay = () => onNavigate('reflection');

    return (
        <div className="cove-fadeslide flex flex-col">
            <div className="flex items-end gap-3.5 px-1 pt-1.5">
                <Whale size="hero" />
                <SpeechBubble title={copy.greeting} line={copy.status} className="mb-2" />
            </div>

            <div className="flex flex-wrap gap-2 px-0.5 pt-3.5">
                {streak > 0 ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-[7px] text-[12.5px] font-extrabold text-cove-streak-deep shadow-[0_2px_8px_rgba(40,90,130,0.08)]">
                        <span className="h-[9px] w-[9px] rotate-45 rounded-[2px] bg-cove-streak" />
                        {streak}-day streak
                    </span>
                ) : null}
                <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-[7px] text-[12.5px] font-extrabold text-cove-success-deep shadow-[0_2px_8px_rgba(40,90,130,0.08)]">
                    <span className="h-[9px] w-[9px] rounded-full bg-cove-success" />
                    {completedCount} done today
                </span>
            </div>

            {showMidday ? (
                <div className="cove-fadeslide mt-3.5 rounded-card-lg bg-cove-tint-amber p-4 shadow-[0_3px_12px_rgba(40,90,130,0.07)]">
                    <div className="text-[14.5px] font-extrabold text-[#8a5c14]">
                        Midday reset — how’s it going?
                    </div>
                    <div className="mt-0.5 text-[12.5px] font-semibold leading-normal text-[#a87a2e]">
                        {middayLine(visibleDone, visiblePicks.length)} Adjust if today changed shape
                        — that’s allowed.
                    </div>
                    <div className="mt-[11px] flex gap-2">
                        <button
                            type="button"
                            onClick={handleDismissMidday}
                            className="flex-1 rounded-xl bg-cove-ink py-[11px] text-[13px] font-extrabold text-white"
                        >
                            All good ✓
                        </button>
                        <button
                            type="button"
                            onClick={() => onNavigate('tasks')}
                            className="flex-1 rounded-xl bg-white py-[11px] text-[13px] font-extrabold text-[#8a5c14]"
                        >
                            Adjust picks
                        </button>
                    </div>
                </div>
            ) : null}

            <div className="app-label px-1 pb-2.5 pt-5">
                {survival ? 'Just one today' : 'Today’s three'}
            </div>

            <div className="flex flex-col gap-2.5">
                {visiblePicks.length === 0 ? (
                    <div className="rounded-card-lg bg-white/60 p-4 text-[13.5px] font-bold text-cove-muted">
                        No picks yet — the morning check-in sets them up, or grab something from
                        Tasks.
                    </div>
                ) : (
                    visiblePicks.map((task) => (
                        <PickCard
                            key={task.id}
                            task={task}
                            bursting={burstId === task.id}
                            onToggle={handleToggle}
                        />
                    ))
                )}
            </div>

            {allDone ? (
                <button
                    type="button"
                    onClick={openCloseDay}
                    className="cove-fadeslide mt-3.5 rounded-card-lg bg-cove-ink py-[17px] text-base font-extrabold text-white shadow-[0_6px_18px_rgba(29,58,77,0.25)]"
                >
                    Close the day with Buddy ✓
                </button>
            ) : visiblePicks.length > 0 ? (
                <button
                    type="button"
                    onClick={openCloseDay}
                    className="mt-3.5 rounded-card-lg border-2 border-cove-border bg-transparent py-3.5 text-sm font-extrabold text-cove-muted transition-colors hover:bg-white"
                >
                    Close the day anyway — we’ll sort the rest together
                </button>
            ) : null}

            <button
                type="button"
                onClick={() => onNavigate('assistant')}
                className="mt-3.5 flex w-full items-center gap-2.5 rounded-full bg-white px-[18px] py-3.5 text-left text-sm font-bold text-cove-soft shadow-cove"
            >
                <span className="text-lg font-extrabold leading-none text-cove-accent">+</span>
                Tell Buddy anything…
            </button>

            <MoreFold dateKey={dateKey} streak={streak} />
        </div>
    );
};

export default NowPage;
