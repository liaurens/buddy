import React, { useEffect, useMemo, useState } from 'react';
import type { Task, TaskFlag, TaskEnergy, RecurrencePattern } from '../../tasks/types';
import { TASK_FLAG_META, TASK_FLAG_ORDER, deriveTaskFlag } from '../../tasks/utils/taskFlags';
import { useTaskTypes } from '../../tasks/hooks/useTaskTypes';

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

interface TaskDetailSheetProps {
    task: Task;
    onSave: (task: Task) => void | Promise<void>;
    onDelete: (id: string) => void | Promise<void>;
    onClose: () => void;
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

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="pb-1.5 pt-3.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-cove-faint">
        {children}
    </div>
);

const inputClass =
    'w-full rounded-xl border border-cove-border bg-white px-3 py-2.5 text-[14.5px] font-bold text-cove-ink outline-none placeholder:text-cove-faint focus:border-cove-accent';

const chipClass = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-[12.5px] font-extrabold transition-colors ${
        active ? 'bg-cove-ink text-white' : 'bg-cove-tint-blue text-cove-muted'
    }`;

/**
 * The task editor — a bottom sheet, reachable from every task row.
 *
 * Everything a task can be is here: what kind of thing it is, when it happens,
 * how big it is, whether it nags. Saving goes through useTasks.updateTask →
 * persistTaskUpdate, so the flag contract, reminders and the calendar mirror
 * stay consistent with every other write path.
 */
const TaskDetailSheet: React.FC<TaskDetailSheetProps> = ({ task, onSave, onDelete, onClose }) => {
    const { taskTypes } = useTaskTypes();
    const [draft, setDraft] = useState<Task>(task);
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => setDraft(task), [task]);

    const flag = deriveTaskFlag(draft);
    const blocker = useMemo(() => missingRequirement(draft), [draft]);
    const patch = (p: Partial<Task>) => setDraft((d) => ({ ...d, ...p }));

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
                    <Label>Task</Label>
                    <input
                        value={draft.title}
                        onChange={(e) => patch({ title: e.target.value })}
                        className={inputClass}
                        placeholder="What is it?"
                    />

                    <Label>What kind of thing is this?</Label>
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

                    {flag === 'waiting' ? (
                        <>
                            <Label>Waiting on</Label>
                            <input
                                value={draft.waitingOn ?? ''}
                                onChange={(e) => patch({ waitingOn: e.target.value })}
                                className={inputClass}
                                placeholder="e.g. Alex, the insurer"
                            />
                        </>
                    ) : null}

                    {flag === 'routine' ? (
                        <>
                            <Label>Repeats</Label>
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

                    <Label>Do it on</Label>
                    <div className="flex gap-2">
                        <input
                            type="date"
                            value={draft.plannedFor ?? ''}
                            onChange={(e) => patch({ plannedFor: e.target.value || undefined })}
                            className={inputClass}
                        />
                        <input
                            type="time"
                            value={draft.dueTime ?? ''}
                            onChange={(e) => patch({ dueTime: e.target.value || undefined })}
                            className={`${inputClass} max-w-[8rem]`}
                        />
                    </div>

                    <Label>Actually due {flag === 'deadline' ? '(required)' : '(optional)'}</Label>
                    <input
                        type="date"
                        value={draft.dueDate ?? ''}
                        onChange={(e) => patch({ dueDate: e.target.value || undefined })}
                        className={inputClass}
                    />

                    {taskTypes.length > 0 ? (
                        <>
                            <Label>Type</Label>
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

                    <Label>How long?</Label>
                    <div className="flex flex-wrap gap-1.5">
                        {ESTIMATES.map((m) => (
                            <button
                                key={m}
                                type="button"
                                onClick={() =>
                                    patch({
                                        estimatedTime: draft.estimatedTime === m ? undefined : m,
                                    })
                                }
                                className={chipClass(draft.estimatedTime === m)}
                            >
                                {m} min
                            </button>
                        ))}
                    </div>

                    <Label>Energy</Label>
                    <div className="flex flex-wrap gap-1.5">
                        {ENERGIES.map((e) => (
                            <button
                                key={e.value}
                                type="button"
                                onClick={() =>
                                    patch({
                                        energy: draft.energy === e.value ? undefined : e.value,
                                    })
                                }
                                className={chipClass(draft.energy === e.value)}
                            >
                                {e.label}
                            </button>
                        ))}
                    </div>

                    <Label>Reminders</Label>
                    <div className="flex flex-wrap gap-1.5">
                        <button
                            type="button"
                            onClick={() => patch({ reminderEnabled: !draft.reminderEnabled })}
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
