import React, { useMemo, useState } from 'react';
import type { Task, TaskFlag, TaskEnergy, RecurrencePattern, Subtask } from '../../tasks/types';
import { TASK_FLAG_META, TASK_FLAG_ORDER, deriveTaskFlag } from '../../tasks/utils/taskFlags';
import { useTaskTypes } from '../../tasks/hooks/useTaskTypes';
import { subtaskProgress } from '../../tasks/utils/subtasks';
import { Fold } from '../components';
import SheetWhenSection from './SheetWhenSection';
import SheetStepsSection from './SheetStepsSection';
import { chipClass, inputClass, labelClass } from './sheetStyles';

const ENERGIES: Array<{ value: TaskEnergy; label: string }> = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
];

const CADENCES: Array<{ value: RecurrencePattern; label: string }> = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekdays', label: 'Weekdays' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
];

const ESTIMATES = [5, 15, 30, 60, 120];

/** Which fold opens first. `'steps'` also expands the splitter. */
export type SheetSection = 'when' | 'steps';

interface TaskDetailSheetProps {
    task: Task;
    onSave: (task: Task) => void | Promise<void>;
    onDelete: (id: string) => void | Promise<void>;
    onClose: () => void;
    /** Where the caller wants attention — "Feeling stuck? Split it" passes `'steps'`. */
    focusSection?: SheetSection;
}

/** The one missing input for a flag, if any. Mirrors applyTaskFlag's contract. */
function missingRequirement(draft: Task): string | null {
    const flag = deriveTaskFlag(draft);
    const needs = TASK_FLAG_META[flag].needs;
    if (needs === 'dueDate' && !draft.dueDate) return 'A deadline needs a real due date.';
    if (needs === 'waitingOn' && !draft.waitingOn?.trim())
        return 'Say who or what you are waiting on.';
    if (needs === 'cadence' && (!draft.recurrence || draft.recurrence === 'none'))
        return 'A routine needs a cadence.';
    return null;
}

/** The fold label for "When", so the section says what it holds while closed. */
function whenSummary(draft: Task): string {
    const parts = [
        draft.plannedFor ? `do ${draft.plannedFor}` : null,
        draft.dueDate ? `due ${draft.dueDate}` : null,
    ].filter(Boolean);
    return parts.length ? `When — ${parts.join(', ')}` : 'When — no date yet';
}

/**
 * The task editor — a bottom sheet, reachable from every task row.
 *
 * Everything a task can be is here, but folded: only "what is this" is open on
 * arrival, because a flat nine-field form is the thing nobody scrolls. Saving
 * goes through useTasks.updateTask → persistTaskUpdate, so the flag contract,
 * reminders and the calendar mirror stay consistent with every other write path.
 */
const TaskDetailSheet: React.FC<TaskDetailSheetProps> = ({
    task,
    onSave,
    onDelete,
    onClose,
    focusSection,
}) => {
    const { taskTypes } = useTaskTypes();
    // Callers key this sheet by task id, so the draft seeds once per task and
    // survives background query refetches. Syncing draft←task on every change
    // used to wipe unsaved edits whenever a refetch landed mid-edit.
    const [draft, setDraft] = useState<Task>(task);
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const flag = deriveTaskFlag(draft);
    const blocker = useMemo(() => missingRequirement(draft), [draft]);
    const patch = (p: Partial<Task>) => setDraft((d) => ({ ...d, ...p }));
    const setSubtasks = (subtasks: Subtask[]) => patch({ subtasks });

    const steps = subtaskProgress(draft.subtasks);
    const stepsLabel = steps ? `Steps — ${steps.done}/${steps.total}` : 'Steps';

    const save = async () => {
        if (saving || blocker || !draft.title.trim()) return;
        setSaving(true);
        try {
            await onSave({ ...draft, title: draft.title.trim() });
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[120] flex items-end justify-center bg-cove-overlay/40"
            onClick={onClose}
            role="presentation"
        >
            <div
                className="cove-fadeslide flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[22px] bg-cove-bg shadow-cove-strong"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Edit task"
            >
                <div className="flex items-center justify-between border-b border-cove-border/60 px-5 py-3.5">
                    <span className="text-[15px] font-black text-cove-ink">Edit task</span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="bg-transparent p-1 text-[13px] font-extrabold text-cove-muted"
                    >
                        Close
                    </button>
                </div>

                {/* Bottom padding clears the iOS home indicator — this sheet is
                    fixed to the viewport, outside MainLayout's safe-area gutters. */}
                <div
                    className="flex-1 overflow-y-auto px-5 pt-1"
                    style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
                >
                    <div className={labelClass}>Task</div>
                    <input
                        value={draft.title}
                        onChange={(e) => patch({ title: e.target.value })}
                        className={inputClass}
                        placeholder="What is it?"
                        aria-label="Task"
                    />

                    <div className={labelClass}>What kind of thing is this?</div>
                    <div className="flex flex-wrap gap-1.5">
                        {TASK_FLAG_ORDER.map((f) => (
                            <button
                                key={f}
                                type="button"
                                onClick={() => patch({ flag: f as TaskFlag })}
                                className={chipClass(flag === f)}
                            >
                                {TASK_FLAG_META[f].emoji} {TASK_FLAG_META[f].label}
                            </button>
                        ))}
                    </div>
                    <div className="pt-1.5 text-[12px] font-semibold text-cove-muted">
                        {TASK_FLAG_META[flag].description}
                    </div>

                    {/* The flag's own required input stays out of the folds —
                        it's the one field Save refuses to go without. */}
                    {flag === 'waiting' ? (
                        <>
                            <div className={labelClass}>Waiting on</div>
                            <input
                                value={draft.waitingOn ?? ''}
                                onChange={(e) => patch({ waitingOn: e.target.value })}
                                className={inputClass}
                                placeholder="e.g. Alex, the insurer"
                                aria-label="Waiting on"
                            />
                        </>
                    ) : null}

                    {flag === 'routine' ? (
                        <>
                            <div className={labelClass}>Repeats</div>
                            <div className="flex flex-wrap gap-1.5">
                                {CADENCES.map((c) => (
                                    <button
                                        key={c.value}
                                        type="button"
                                        onClick={() => patch({ recurrence: c.value })}
                                        className={chipClass(draft.recurrence === c.value)}
                                    >
                                        {c.label}
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : null}

                    <div className="mt-4 flex flex-col gap-0.5 border-t border-cove-border/60 pt-2">
                        <Fold
                            label={whenSummary(draft)}
                            openLabel="When"
                            defaultOpen={focusSection !== 'steps'}
                        >
                            <SheetWhenSection draft={draft} flag={flag} patch={patch} />
                        </Fold>

                        <Fold label={stepsLabel} defaultOpen={focusSection === 'steps'}>
                            <SheetStepsSection
                                draft={draft}
                                onChange={setSubtasks}
                                autoSplit={focusSection === 'steps'}
                            />
                        </Fold>

                        <Fold label="Details">
                            {taskTypes.length > 0 ? (
                                <>
                                    <div className={labelClass}>Type</div>
                                    <div className="flex flex-wrap gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => patch({ taskTypeId: undefined })}
                                            className={chipClass(!draft.taskTypeId)}
                                        >
                                            None
                                        </button>
                                        {taskTypes.map((t) => (
                                            <button
                                                key={t.id}
                                                type="button"
                                                onClick={() => patch({ taskTypeId: t.id })}
                                                className={chipClass(draft.taskTypeId === t.id)}
                                            >
                                                {t.emoji ? `${t.emoji} ` : ''}
                                                {t.name}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            ) : null}

                            <div className={labelClass}>How long?</div>
                            <div className="flex flex-wrap gap-1.5">
                                {ESTIMATES.map((m) => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() =>
                                            patch({
                                                estimatedTime:
                                                    draft.estimatedTime === m ? undefined : m,
                                            })
                                        }
                                        className={chipClass(draft.estimatedTime === m)}
                                    >
                                        {m} min
                                    </button>
                                ))}
                            </div>

                            <div className={labelClass}>Energy</div>
                            <div className="flex flex-wrap gap-1.5">
                                {ENERGIES.map((e) => (
                                    <button
                                        key={e.value}
                                        type="button"
                                        onClick={() =>
                                            patch({
                                                energy:
                                                    draft.energy === e.value ? undefined : e.value,
                                            })
                                        }
                                        className={chipClass(draft.energy === e.value)}
                                    >
                                        {e.label}
                                    </button>
                                ))}
                            </div>

                            {/* Notes were stored and never shown — captured detail
                                that only existed in the database until now. */}
                            <div className={labelClass}>Notes</div>
                            <textarea
                                value={draft.notes ?? ''}
                                onChange={(e) => patch({ notes: e.target.value || undefined })}
                                rows={3}
                                placeholder="Anything you'd forget otherwise"
                                aria-label="Notes"
                                className={`${inputClass} resize-none`}
                            />
                        </Fold>

                        <Fold
                            label={draft.reminderEnabled ? 'Reminders — on' : 'Reminders — off'}
                            openLabel="Reminders"
                        >
                            <div className="flex flex-wrap gap-1.5 pt-1.5">
                                <button
                                    type="button"
                                    onClick={() =>
                                        patch({ reminderEnabled: !draft.reminderEnabled })
                                    }
                                    className={chipClass(!!draft.reminderEnabled)}
                                >
                                    {draft.reminderEnabled ? 'Remind me' : 'Stay quiet'}
                                </button>
                                {draft.reminderEnabled
                                    ? (['single', 'smart', 'aggressive'] as const).map((c) => (
                                          <button
                                              key={c}
                                              type="button"
                                              onClick={() => patch({ reminderCadence: c })}
                                              className={chipClass(draft.reminderCadence === c)}
                                          >
                                              {c === 'single'
                                                  ? 'Once'
                                                  : c === 'smart'
                                                    ? 'As it nears'
                                                    : 'Keep at me'}
                                          </button>
                                      ))
                                    : null}
                            </div>
                        </Fold>
                    </div>

                    {blocker ? (
                        <div className="mt-4 rounded-xl bg-cove-tint-danger px-3.5 py-2.5 text-[12.5px] font-bold text-cove-danger-deep">
                            {blocker}
                        </div>
                    ) : null}

                    <div className="mt-5 flex gap-2">
                        <button
                            type="button"
                            disabled={saving || !!blocker || !draft.title.trim()}
                            onClick={() => void save()}
                            className="flex-1 rounded-xl bg-cove-accent py-3 text-[14px] font-extrabold text-white disabled:opacity-40"
                        >
                            Save
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                confirmDelete ? void onDelete(task.id) : setConfirmDelete(true)
                            }
                            className={`rounded-xl px-4 py-3 text-[13px] font-extrabold ${
                                confirmDelete
                                    ? 'bg-cove-danger text-white'
                                    : 'bg-white text-cove-danger'
                            }`}
                        >
                            {confirmDelete ? 'Really delete' : 'Delete'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TaskDetailSheet;
