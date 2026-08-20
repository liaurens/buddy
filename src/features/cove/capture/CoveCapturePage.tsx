import React, { useMemo, useState } from 'react';
import { isSameDay } from 'date-fns';
import { useTasks } from '../../tasks/hooks/useTasks';
import { useTaskTypes } from '../../tasks/hooks/useTaskTypes';
import { parseQuickCapture } from '../../tasks/utils/quickCaptureParser';
import { CAPTURE_DRAFT_KEY } from '../../assistant/constants';
import { useToast } from '../../../components/ui/Toast';
import { TagChip, captureTagFor } from '../components';
import { useAutoSortReview } from '../tasks/useAutoSortReview';
import TaskDetailSheet from '../tasks/TaskDetailSheet';

/**
 * Capture — dump it here, Buddy sorts it. The AI categorization runs
 * invisibly (eagerTriageTask fires inside useTasks.addTaskFull); there is no
 * chat UI on the daily path.
 */
const CoveCapturePage: React.FC = () => {
    const { tasks, addTaskFull, updateTask, deleteTask } = useTasks();
    const { taskTypes } = useTaskTypes();
    const autoSort = useAutoSortReview();
    const toast = useToast();
    const [text, setText] = useState<string>(() => {
        try {
            const draft = sessionStorage.getItem(CAPTURE_DRAFT_KEY) ?? '';
            sessionStorage.removeItem(CAPTURE_DRAFT_KEY);
            return draft;
        } catch {
            return '';
        }
    });
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Derived from the live list, so the sheet shows the task as it is now
    // (the eager sort lands a flag on it seconds after capture).
    const editing = useMemo(
        () => (editingId ? (tasks.find((t) => t.id === editingId) ?? null) : null),
        [editingId, tasks],
    );

    const capturedToday = useMemo(() => {
        const now = new Date();
        return tasks
            .filter((t) => isSameDay(new Date(t.createdAt), now))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }, [tasks]);

    const submit = async () => {
        const trimmed = text.trim();
        if (!trimmed || saving) return;
        setError(null);
        const draft = parseQuickCapture(trimmed, taskTypes, new Date());
        if (draft.errors?.length) {
            setError(draft.errors[0]);
            return;
        }
        setSaving(true);
        try {
            await addTaskFull({
                title: draft.title,
                taskTypeId: draft.taskTypeId,
                dueDate: draft.dueDate,
                plannedFor: draft.plannedFor,
                dueTime: draft.dueTime,
                priority: draft.priority || 'medium',
                energy: draft.energy,
                flag: draft.flag,
                recurrence: draft.recurrence,
                waitingOn: draft.waitingOn,
                notes: draft.notes,
                triageSource: draft.triageSource,
                // An explicit flag means the user already sorted it; a bare
                // capture stays untriaged for Buddy to sort.
                triagedAt: draft.flag ? new Date().toISOString() : undefined,
            });
            setText('');
            // Capturing used to be silent — the input cleared and that was the
            // only sign it worked, which reads as "did that go anywhere?".
            toast.success('Got it — Buddy will sort it.');
        } catch (err) {
            console.error('Capture failed:', err);
            setError('Could not save that — try again.');
        } finally {
            setSaving(false);
        }
    };

    /**
     * A parser error is a dead end otherwise: "#deadline" with no date refuses
     * to save and there is nothing to do but retype. The thought is worth more
     * than the syntax, so save the raw text untriaged and let Buddy sort it.
     */
    const captureAnyway = async () => {
        const trimmed = text.trim();
        if (!trimmed || saving) return;
        setSaving(true);
        try {
            await addTaskFull({ title: trimmed, priority: 'medium' });
            setText('');
            setError(null);
            toast.success('Got it — Buddy will sort it.');
        } catch (err) {
            console.error('Capture failed:', err);
            setError('Could not save that — try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="cove-fadeslide flex flex-1 flex-col">
            <div className="px-1 pb-1 pt-1.5 text-[22px] font-black text-cove-ink">Capture</div>
            <div className="px-1 pb-[18px] text-[13.5px] font-semibold text-cove-muted">
                Dump it here. Buddy sorts it — you don’t have to decide now.
            </div>

            <div className="rounded-card-xl bg-white p-4 shadow-cove">
                <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') void submit();
                    }}
                    placeholder="e.g. ‘dentist friday’ or ‘idea: gift for mom’"
                    className="w-full border-0 bg-transparent px-0.5 py-1 text-[15px] font-bold text-cove-ink outline-none placeholder:text-cove-faint"
                />
                <div className="mt-3 flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => void submit()}
                        disabled={saving || !text.trim()}
                        className="rounded-xl bg-cove-accent px-5 py-2.5 text-[13.5px] font-extrabold text-white disabled:opacity-50"
                    >
                        Capture it
                    </button>
                </div>
                {error ? (
                    <div className="mt-3 flex items-center gap-3">
                        <span className="app-field-error mt-0 flex-1">{error}</span>
                        <button
                            type="button"
                            onClick={() => void captureAnyway()}
                            disabled={saving || !text.trim()}
                            className="app-secondary-button shrink-0 px-3.5 py-2 text-[12.5px]"
                        >
                            Capture anyway
                        </button>
                    </div>
                ) : null}
            </div>

            {autoSort.count > 0 ? (
                <>
                    <div className="app-label px-1 pb-2.5 pt-5">Sorted by Buddy — tap to fix</div>
                    <div className="flex flex-col gap-2">{autoSort.rows}</div>
                </>
            ) : null}

            {capturedToday.length > 0 ? (
                <>
                    <div className="app-label px-1 pb-2.5 pt-5">Captured today</div>
                    <div className="flex flex-col gap-2">
                        {capturedToday.map((task) => (
                            <button
                                key={task.id}
                                type="button"
                                onClick={() => setEditingId(task.id)}
                                className="cove-fadeslide flex items-center gap-3 rounded-2xl bg-white px-4 py-[13px] text-left shadow-cove"
                            >
                                <span className="min-w-0 flex-1 truncate text-sm font-extrabold leading-[1.3] text-cove-ink">
                                    {task.title}
                                </span>
                                <TagChip tag={captureTagFor(task)} />
                            </button>
                        ))}
                    </div>
                </>
            ) : null}

            {autoSort.sheet}

            {editing ? (
                <TaskDetailSheet
                    // Keyed by id — the draft seeds once per task and survives
                    // the refetch the eager sort triggers under it.
                    key={editing.id}
                    task={editing}
                    onSave={async (t) => {
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

export default CoveCapturePage;
