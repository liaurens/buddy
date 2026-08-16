import React, { lazy, Suspense, useMemo, useState } from 'react';
import { format } from 'date-fns';
import type { AppRoute } from '../../../constants/routes';
import { useTasks } from '../../tasks/hooks/useTasks';
import { useTaskTriage } from '../../tasks/hooks/useTaskTriage';
import { getRankedTasks } from '../../tasks/utils/taskRecommender';
import { buildTaskBoard } from '../../tasks/utils/taskBoard';
import { TASK_FLAG_META } from '../../tasks/utils/taskFlags';
import type { TriageDestination, TriageDetail } from '../../tasks/utils/triageRouting';
import { useToast } from '../../../components/ui/Toast';
import { Fold } from '../components';
import TaskRow from './TaskRow';
import TriageCard from './TriageCard';

const LegacyTodoPage = lazy(() => import('../../tasks/pages/TodoPage'));

interface CoveTasksPageProps {
    onNavigate: (tab: AppRoute, params?: Record<string, unknown>) => void;
}

/**
 * Tasks — two tiers.
 *
 * "Needs you now" is a short ranked list of what is actually pressing.
 * Everything else lives in a folded section per flag, with its count always
 * visible so the overview stays complete without being a wall of text.
 * Both come from `buildTaskBoard`, so this file stays presentational.
 */
const CoveTasksPage: React.FC<CoveTasksPageProps> = ({ onNavigate }) => {
    const toast = useToast();
    const today = format(new Date(), 'yyyy-MM-dd');
    const { tasks, toggleTask } = useTasks();
    const { reviewInbox, suggestions, applyRoutes, isFetching } = useTaskTriage();
    const [routing, setRouting] = useState(false);
    const [showOverflow, setShowOverflow] = useState(false);
    const [showTools, setShowTools] = useState(false);

    const current = reviewInbox[0];
    const currentSuggestion = useMemo(
        () => (current ? suggestions?.find((s) => s.id === current.id) : undefined),
        [current, suggestions],
    );

    const board = useMemo(() => {
        const active = tasks.filter((t) => !t.completed);
        const scoreById = new Map(getRankedTasks(active).map((r) => [r.task.id, r.score] as const));
        return buildTaskBoard(tasks, scoreById, { today });
    }, [tasks, today]);

    const route = async (destination: TriageDestination, detail: TriageDetail) => {
        if (!current || routing) return;
        setRouting(true);
        try {
            await applyRoutes([
                {
                    taskId: current.id,
                    destination,
                    detail,
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

    // Opening a task is Phase 5a (TaskDetailSheet); until then the legacy tools
    // page owns editing, so point there rather than doing nothing on tap.
    const openTask = () => setShowTools(true);

    return (
        <div className="cove-fadeslide flex flex-col">
            <div className="px-1 pb-1 pt-1.5 text-[22px] font-black text-cove-ink">Tasks</div>
            <div className="px-1 pb-4 text-[13.5px] font-semibold text-cove-muted">
                Only what needs you. The rest is parked safely.
            </div>

            {current ? (
                <TriageCard
                    task={current}
                    remaining={reviewInbox.length}
                    suggestion={currentSuggestion}
                    thinking={isFetching}
                    busy={routing}
                    onRoute={(d, detail) => void route(d, detail)}
                />
            ) : (
                <div className="cove-fadeslide mb-3.5 rounded-card-lg bg-cove-tint-green p-4 text-sm font-extrabold text-cove-success-deep">
                    Inbox empty — everything is sorted ✓
                </div>
            )}

            <div className="app-label px-1 pb-2.5 pt-1.5">Needs you now</div>
            <div className="flex flex-col gap-2.5">
                {board.now.length === 0 ? (
                    <div className="rounded-2xl bg-white/60 p-4 text-[13.5px] font-bold text-cove-muted">
                        {board.activeCount === 0
                            ? 'Nothing on your plate at all. Enjoy it.'
                            : 'Nothing needs you right now — the rest is parked below.'}
                    </div>
                ) : (
                    board.now.map((task) => (
                        <TaskRow
                            key={task.id}
                            task={task}
                            showFlag
                            onToggle={(t) => void toggleTask(t.id)}
                            onOpen={openTask}
                        />
                    ))
                )}
            </div>

            {board.nowOverflow.length > 0 ? (
                showOverflow ? (
                    <div className="cove-fadeslide mt-2.5 flex flex-col gap-2.5">
                        {board.nowOverflow.map((task) => (
                            <TaskRow
                                key={task.id}
                                task={task}
                                showFlag
                                onToggle={(t) => void toggleTask(t.id)}
                                onOpen={openTask}
                            />
                        ))}
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setShowOverflow(true)}
                        className="mt-2 bg-transparent p-1.5 text-left text-[13px] font-extrabold text-cove-faint transition-colors hover:text-cove-muted"
                    >
                        +{board.nowOverflow.length} more pressing ⌄
                    </button>
                )
            ) : null}

            <div className="mt-[18px] flex flex-col gap-0.5">
                {board.sections.map((section) => {
                    const meta = TASK_FLAG_META[section.flag];
                    const label = `${meta.emoji} ${meta.plural} (${section.tasks.length})`;
                    if (section.tasks.length === 0) {
                        // Kept visible on purpose: a count of zero is information.
                        return (
                            <div
                                key={section.flag}
                                className="p-1.5 text-[13px] font-extrabold text-cove-faint/60"
                            >
                                {label}
                            </div>
                        );
                    }
                    return (
                        <Fold key={section.flag} label={label} openLabel={label}>
                            <div className="flex flex-col gap-2 pb-2">
                                {section.tasks.map((task) => (
                                    <TaskRow
                                        key={task.id}
                                        task={task}
                                        quiet={section.flag === 'someday'}
                                        onToggle={(t) => void toggleTask(t.id)}
                                        onOpen={openTask}
                                    />
                                ))}
                            </div>
                        </Fold>
                    );
                })}
            </div>

            <button
                type="button"
                onClick={() => setShowTools((v) => !v)}
                className="mt-5 bg-transparent p-1.5 text-center text-[13px] font-extrabold text-cove-faint transition-colors hover:text-cove-muted"
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
