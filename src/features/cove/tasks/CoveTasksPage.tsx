import React, { lazy, Suspense, useMemo, useState } from 'react';
import { format, isSameDay } from 'date-fns';
import type { AppRoute } from '../../../constants/routes';
import { useTasks } from '../../tasks/hooks/useTasks';
import { useTaskTriage } from '../../tasks/hooks/useTaskTriage';
import { useTodayItems } from '../../day/hooks/useTodayItems';
import { suggestionToDetail } from '../../tasks/utils/triageConfidence';
import type { TriageDestination } from '../../tasks/utils/triageRouting';
import { getRankedTasks } from '../../tasks/utils/taskRecommender';
import { sortTasksCanonical } from '../../tasks/utils/taskOrdering';
import { useToast } from '../../../components/ui/Toast';
import type { Task } from '../../tasks/types';
import { Fold, PickCircle } from '../components';

const LegacyTodoPage = lazy(() => import('../../tasks/pages/TodoPage'));

interface CoveTasksPageProps {
    onNavigate: (tab: AppRoute, params?: Record<string, unknown>) => void;
}

/**
 * Tasks — only what needs you. One-at-a-time inbox triage, the TODAY list,
 * a folded Someday, and the full legacy task tooling behind "⋯ tools".
 */
const CoveTasksPage: React.FC<CoveTasksPageProps> = ({ onNavigate }) => {
    const toast = useToast();
    const dateKey = format(new Date(), 'yyyy-MM-dd');
    const { tasks, toggleTask } = useTasks();
    const { picks } = useTodayItems(dateKey);
    const { reviewInbox, suggestions, applyRoutes, isFetching } = useTaskTriage();
    const [routing, setRouting] = useState(false);
    const [showTools, setShowTools] = useState(false);

    const current = reviewInbox[0];
    const currentSuggestion = useMemo(
        () => (current ? suggestions?.find((s) => s.id === current.id) : undefined),
        [current, suggestions],
    );

    const route = async (destination: TriageDestination) => {
        if (!current || routing) return;
        setRouting(true);
        try {
            const matches = currentSuggestion?.destination === destination;
            await applyRoutes([
                {
                    taskId: current.id,
                    destination,
                    detail:
                        matches && currentSuggestion ? suggestionToDetail(currentSuggestion) : {},
                    aiDestination: currentSuggestion?.destination ?? destination,
                },
            ]);
        } catch (err) {
            console.error('Failed to sort task:', err);
            toast.error('Could not sort that — try again.');
        } finally {
            setRouting(false);
        }
    };

    const todayList = useMemo(() => {
        const scoreById = new Map(getRankedTasks(picks).map((r) => [r.task.id, r.score] as const));
        return sortTasksCanonical(picks, scoreById);
    }, [picks]);

    const somedayTasks = useMemo(
        () => tasks.filter((t) => !t.completed && t.flag === 'someday' && t.triagedAt),
        [tasks],
    );

    const isNewToday = (task: Task) =>
        !!task.triagedAt && isSameDay(new Date(task.triagedAt), new Date());

    return (
        <div className="cove-fadeslide flex flex-col">
            <div className="px-1 pb-1 pt-1.5 text-[22px] font-black text-cove-ink">Tasks</div>
            <div className="px-1 pb-4 text-[13.5px] font-semibold text-cove-muted">
                Only what needs you. The rest is parked safely.
            </div>

            {reviewInbox.length > 0 && current ? (
                <div className="mb-3.5 rounded-card-lg bg-cove-tint-amber p-4 shadow-[0_3px_12px_rgba(40,90,130,0.07)]">
                    <div className="mb-2.5 text-sm font-extrabold text-cove-streak-text">
                        {reviewInbox.length} to sort — one at a time
                        {isFetching ? ' (Buddy is thinking…)' : ''}
                    </div>
                    <div className="rounded-[14px] bg-white p-3.5 text-[14.5px] font-extrabold leading-[1.35] text-cove-ink">
                        {current.title}
                    </div>
                    <div className="mt-2.5 flex gap-2">
                        <button
                            type="button"
                            disabled={routing}
                            onClick={() => void route('today')}
                            className="flex-1 rounded-xl bg-cove-ink py-[11px] text-[13px] font-extrabold text-white disabled:opacity-60"
                        >
                            Today
                        </button>
                        <button
                            type="button"
                            disabled={routing}
                            onClick={() => void route('someday')}
                            className="flex-1 rounded-xl bg-white py-[11px] text-[13px] font-extrabold text-cove-ink disabled:opacity-60"
                        >
                            Later
                        </button>
                        <button
                            type="button"
                            disabled={routing}
                            onClick={() => void route('school')}
                            className="flex-1 rounded-xl bg-white py-[11px] text-[13px] font-extrabold text-[#3a7fb0] disabled:opacity-60"
                        >
                            School
                        </button>
                    </div>
                    {currentSuggestion?.destination === 'urgent' ? (
                        <button
                            type="button"
                            disabled={routing}
                            onClick={() => void route('urgent')}
                            className="mt-2 w-full rounded-xl bg-cove-streak py-[11px] text-[13px] font-extrabold text-white disabled:opacity-60"
                        >
                            Urgent — schedule it now
                        </button>
                    ) : null}
                </div>
            ) : (
                <div className="cove-fadeslide mb-3.5 rounded-card-lg bg-cove-tint-green p-4 text-sm font-extrabold text-cove-success-deep">
                    Inbox empty — everything is sorted ✓
                </div>
            )}

            <div className="app-label px-1 pb-2.5 pt-1.5">Today</div>
            <div className="flex flex-col gap-2.5">
                {todayList.length === 0 ? (
                    <div className="rounded-2xl bg-white/60 p-4 text-[13.5px] font-bold text-cove-muted">
                        Nothing planned for today yet.
                    </div>
                ) : (
                    todayList.map((task) => (
                        <button
                            key={task.id}
                            type="button"
                            onClick={() => void toggleTask(task.id)}
                            className="flex w-full items-center gap-3.5 rounded-card bg-white px-4 py-3.5 text-left shadow-cove"
                        >
                            <PickCircle done={task.completed} size={28} />
                            <span
                                className="flex-1 text-[14.5px] font-extrabold leading-[1.3]"
                                style={{ color: task.completed ? '#9cb9c9' : '#1d3a4d' }}
                            >
                                {task.title}
                            </span>
                            {isNewToday(task) && !task.completed ? (
                                <span className="rounded-[7px] bg-cove-tint-blue px-2 py-0.5 text-[10.5px] font-extrabold text-[#3a7fb0]">
                                    new
                                </span>
                            ) : task.dueTime ? (
                                <span className="text-[11.5px] font-bold text-cove-faint">
                                    {task.dueTime}
                                </span>
                            ) : task.estimatedTime ? (
                                <span className="text-[11.5px] font-bold text-cove-faint">
                                    {task.estimatedTime} min
                                </span>
                            ) : null}
                        </button>
                    ))
                )}
            </div>

            {somedayTasks.length > 0 ? (
                <Fold
                    label={`Someday (${somedayTasks.length}) — parked safely`}
                    openLabel={`Hide someday (${somedayTasks.length})`}
                    className="mt-[18px]"
                >
                    <div className="flex flex-col gap-2">
                        {somedayTasks.map((task) => (
                            <div
                                key={task.id}
                                className="flex items-center gap-3 rounded-2xl bg-white/60 px-4 py-3 text-[13.5px] font-bold text-cove-muted"
                            >
                                {task.title}
                            </div>
                        ))}
                    </div>
                </Fold>
            ) : null}

            <button
                type="button"
                onClick={() => setShowTools((v) => !v)}
                className="mt-5 p-1.5 text-center text-[13px] font-extrabold text-cove-faint transition-colors hover:text-cove-muted"
            >
                {showTools ? 'Hide tools ⌃' : '⋯ tools — the full task manager'}
            </button>
            {showTools ? (
                <div className="cove-fadeslide mt-2">
                    <Suspense
                        fallback={
                            <div className="p-4 text-center text-sm font-bold text-cove-faint">
                                Loading tools…
                            </div>
                        }
                    >
                        <LegacyTodoPage onNavigate={onNavigate} />
                    </Suspense>
                </div>
            ) : null}
        </div>
    );
};

export default CoveTasksPage;
