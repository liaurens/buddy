import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useTasks } from '../../tasks/hooks/useTasks';
import { useTaskTriage } from '../../tasks/hooks/useTaskTriage';
import { useTaskRecommendation } from '../../tasks/hooks/useTaskRecommendation';
import { useRoutines } from '../../tasks/hooks/useRoutines';
import { buildTaskBoard } from '../../tasks/utils/taskBoard';
import { rotateQueue } from '../../tasks/utils/inbox';
import { TASK_FLAG_META } from '../../tasks/utils/taskFlags';
import type { TriageDestination, TriageDetail } from '../../tasks/utils/triageRouting';
import { useToast } from '../../../components/ui/Toast';
import { Fold } from '../components';
import TaskRow from './TaskRow';
import NextUpCard from './NextUpCard';
import TriageCard from './TriageCard';
import TaskDetailSheet from './TaskDetailSheet';
import RoutinePicker from '../../tasks/components/RoutinePicker';
import { useAutoSortReview } from './useAutoSortReview';
import type { Task } from '../../tasks/types';

/**
 * Tasks — two tiers.
 *
 * "Needs you now" is a short ranked list of what is actually pressing.
 * Everything else lives in a folded section per flag, with its count always
 * visible so the overview stays complete without being a wall of text.
 * Both come from `buildTaskBoard`, so this file stays presentational.
 */
const CoveTasksPage: React.FC = () => {
    const toast = useToast();
    const today = format(new Date(), 'yyyy-MM-dd');
    const { tasks, toggleTask, updateTask, deleteTask } = useTasks();
    const { ready, reviewInbox, suggestions, applyRoutes, undoLastBatch, canUndo, isFetching } =
        useTaskTriage();
    const [routing, setRouting] = useState(false);
    const [showOverflow, setShowOverflow] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showRoutines, setShowRoutines] = useState(false);
    const { routines } = useRoutines();
    const autoSort = useAutoSortReview();

    // "Not now" rotates the current item to the back — client-side order only,
    // nothing is written (skipping is not a classification).
    const [deferredIds, setDeferredIds] = useState<string[]>([]);
    const orderedInbox = useMemo(
        () => rotateQueue(reviewInbox, deferredIds),
        [reviewInbox, deferredIds],
    );
    const current = orderedInbox[0];
    const currentSuggestion = useMemo(
        () => (current ? suggestions?.find((s) => s.id === current.id) : undefined),
        [current, suggestions],
    );
    const skipCurrent = () => {
        if (!current) return;
        setDeferredIds((prev) => [...prev.filter((id) => id !== current.id), current.id]);
    };

    const undo = async () => {
        try {
            const restored = await undoLastBatch();
            if (restored > 0) {
                toast.success(
                    `Brought ${restored} ${restored === 1 ? 'task' : 'tasks'} back to the inbox.`,
                );
            }
        } catch (err) {
            console.error('Undo failed:', err);
            toast.error('Could not undo that — check the sections below.');
        }
    };

    // Ranked with the real context (home days, free calendar minutes) so the
    // board order and the "next up" reasons come from the same scoring pass.
    const { byId: recById, scoreById } = useTaskRecommendation();
    const board = useMemo(
        () => buildTaskBoard(tasks, scoreById, { today }),
        [tasks, scoreById, today],
    );

    const route = async (destination: TriageDestination, detail: TriageDetail) => {
        if (!current || routing) return;
        setRouting(true);
        try {
            const applied = await applyRoutes([
                {
                    taskId: current.id,
                    destination,
                    detail,
                    aiDestination: currentSuggestion?.destination ?? destination,
                },
            ]);
            if (applied > 0) {
                toast.success(`Sorted to ${TASK_FLAG_META[destination].label} ✓`, undefined, {
                    label: 'Undo',
                    onClick: () => void undo(),
                });
            }
        } catch (err) {
            console.error('Failed to sort task:', err);
            toast.error('Could not sort that — try again.');
        } finally {
            setRouting(false);
        }
    };

    // Read the task back out of the live list so the sheet reflects saves.
    const editing = useMemo(
        () => (editingId ? (tasks.find((t) => t.id === editingId) ?? null) : null),
        [editingId, tasks],
    );
    const openTask = (task: Task) => setEditingId(task.id);

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
                    aiOff={!ready}
                    busy={routing}
                    onRoute={(d, detail) => void route(d, detail)}
                    onSkip={reviewInbox.length > 1 ? skipCurrent : undefined}
                />
            ) : (
                <div className="cove-fadeslide mb-3.5 rounded-card-lg bg-cove-tint-green p-4 text-sm font-extrabold text-cove-success-deep">
                    Inbox empty — everything is sorted ✓
                </div>
            )}

            {autoSort.count > 0 ? (
                <Fold
                    label={`✨ Buddy sorted ${autoSort.count} today — tap to fix`}
                    openLabel={`✨ Buddy sorted ${autoSort.count} today`}
                    className="mb-2"
                >
                    <div className="flex flex-col gap-2 pb-2">
                        {autoSort.rows}
                        {canUndo ? (
                            <button
                                type="button"
                                onClick={() => void undo()}
                                className="bg-transparent p-1.5 text-left text-[12.5px] font-extrabold text-cove-faint transition-colors hover:text-cove-muted"
                            >
                                ↩ Undo the last sort
                            </button>
                        ) : null}
                    </div>
                </Fold>
            ) : null}

            <div className="app-label px-1 pb-2.5 pt-1.5">Needs you now</div>
            <div className="flex flex-col gap-2.5">
                {board.now.length === 0 ? (
                    <div className="rounded-2xl bg-white/60 p-4 text-[13.5px] font-bold text-cove-muted">
                        {board.activeCount === 0
                            ? 'Nothing on your plate at all. Enjoy it.'
                            : 'Nothing needs you right now — the rest is parked below.'}
                    </div>
                ) : (
                    board.now.map((task, index) => {
                        const rec = index === 0 ? recById.get(task.id) : undefined;
                        return rec ? (
                            <NextUpCard
                                key={task.id}
                                rec={rec}
                                onToggle={(t) => void toggleTask(t.id)}
                                onOpen={openTask}
                            />
                        ) : (
                            <TaskRow
                                key={task.id}
                                task={task}
                                showFlag
                                onToggle={(t) => void toggleTask(t.id)}
                                onOpen={openTask}
                            />
                        );
                    })
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
                {board.sections.every((s) => s.tasks.length === 0) ? (
                    // Five separate "(0)" lines read as clutter on a fresh
                    // account; one sentence carries the same information.
                    <div className="p-1.5 text-[13px] font-bold text-cove-faint/70">
                        Nothing parked — deadlines, waiting and someday will show here.
                    </div>
                ) : (
                    board.sections.map((section) => {
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
                    })
                )}
            </div>

            {routines.length > 0 ? (
                <button
                    type="button"
                    onClick={() => setShowRoutines(true)}
                    className="mt-4 rounded-card bg-white px-4 py-3 text-left text-[13.5px] font-extrabold text-cove-ink shadow-cove"
                >
                    ▶ Run a routine
                </button>
            ) : null}

            <RoutinePicker
                isOpen={showRoutines}
                onClose={() => setShowRoutines(false)}
                onRan={(count) =>
                    toast.success(`Added ${count} ${count === 1 ? 'task' : 'tasks'} for today`)
                }
            />

            {autoSort.sheet}

            {editing ? (
                <TaskDetailSheet
                    // Keyed by id: a *different* task remounts the sheet with a
                    // fresh draft, while background refetches of the *same* task
                    // leave in-progress edits alone.
                    key={editing.id}
                    task={editing}
                    onSave={async (t) => {
                        // Saving used to be silent: the sheet closed and the row
                        // quietly re-sorted, which reads as "nothing happened".
                        try {
                            await updateTask(t);
                            toast.success('Task updated.');
                        } catch (err) {
                            console.error('Failed to update task:', err);
                            toast.error('Could not save that — try again.');
                        }
                    }}
                    onDelete={(id) => {
                        void deleteTask(id);
                        setEditingId(null);
                        toast.success('Task deleted.');
                    }}
                    onClose={() => setEditingId(null)}
                />
            ) : null}
        </div>
    );
};

export default CoveTasksPage;
