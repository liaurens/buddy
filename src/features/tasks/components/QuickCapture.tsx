import React, { useMemo, useState } from 'react';
import { addDays, format } from 'date-fns';
import { Sparkles, Calendar as CalendarIcon, Plus } from 'lucide-react';
import type { TaskType, TaskFlag } from '../types';
import { parseQuickCapture } from '../utils/quickCaptureParser';
import { TASK_FLAGS, TASK_FLAG_META, suggestDeadlineWorkday } from '../utils/taskFlags';

interface QuickCaptureProps {
    taskTypes: TaskType[];
    onSubmit: (draft: ReturnType<typeof parseQuickCapture>) => Promise<void> | void;
}

type FlagChoice = TaskFlag | 'auto';

const QuickCapture: React.FC<QuickCaptureProps> = ({ taskTypes, onSubmit }) => {
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [flagChoice, setFlagChoice] = useState<FlagChoice>('auto');
    const [waitingOn, setWaitingOn] = useState('');
    const [chaseDate, setChaseDate] = useState('');
    const [startDate, setStartDate] = useState('');
    const [contractNote, setContractNote] = useState('');

    const parsed = useMemo(() => parseQuickCapture(text, taskTypes), [text, taskTypes]);
    const deadlineStart =
        startDate || (parsed.dueDate ? suggestDeadlineWorkday(parsed.dueDate, 30, new Date()) : '');
    // Explicit button choice wins; otherwise use whatever the text implied.
    const draft = useMemo(() => {
        if (flagChoice === 'auto') return parsed;
        if (parsed.conflictingFlags?.length) return parsed;
        if (parsed.flag && parsed.flag !== flagChoice) {
            return {
                ...parsed,
                conflictingFlags: [parsed.flag, flagChoice],
                errors: [`Choose one task flag: ${parsed.flag}, ${flagChoice}.`],
            };
        }
        if (flagChoice === 'waiting') {
            return {
                ...parsed,
                errors: undefined,
                flag: flagChoice,
                waitingOn: waitingOn.trim() || undefined,
                plannedFor: chaseDate || parsed.plannedFor,
                notes: contractNote.trim() || undefined,
                triageSource: 'explicit' as const,
            };
        }
        if (flagChoice === 'deadline') {
            return {
                ...parsed,
                errors: undefined,
                flag: flagChoice,
                dueDate: parsed.dueDate ?? parsed.plannedFor,
                plannedFor: deadlineStart || undefined,
                startDate: deadlineStart || undefined,
                triageSource: 'explicit' as const,
            };
        }
        if (flagChoice === 'routine') {
            return {
                ...parsed,
                flag: flagChoice,
                recurrence: parsed.recurrence ?? 'daily',
                triageSource: 'explicit' as const,
            };
        }
        return {
            ...parsed,
            errors: undefined,
            flag: flagChoice,
            plannedFor:
                flagChoice === 'today' ? format(new Date(), 'yyyy-MM-dd') : parsed.plannedFor,
            triageSource: 'explicit' as const,
        };
    }, [parsed, flagChoice, waitingOn, chaseDate, contractNote, deadlineStart]);
    const matchedType = draft.taskTypeId
        ? taskTypes.find((t) => t.id === draft.taskTypeId)
        : undefined;
    const effectiveFlag = draft.flag ?? 'someday';
    const contractReady =
        !draft.conflictingFlags?.length &&
        !draft.errors?.length &&
        (flagChoice !== 'waiting' || Boolean(draft.waitingOn)) &&
        (flagChoice !== 'deadline' || Boolean(draft.dueDate && draft.plannedFor));

    const submit = async () => {
        if (!draft.title.trim() || busy) return;
        setBusy(true);
        try {
            await onSubmit(draft);
            setText('');
            setFlagChoice('auto');
            setWaitingOn('');
            setChaseDate('');
            setStartDate('');
            setContractNote('');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="app-surface p-3">
            <div className="flex items-center gap-2">
                <Sparkles size={16} className="flex-shrink-0 text-indigo-600" />
                <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            void submit();
                        }
                    }}
                    placeholder="Add task… try 'email mom tomorrow #today'"
                    className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />
                <button
                    onClick={() => void submit()}
                    disabled={!draft.title.trim() || busy || !contractReady}
                    className="flex items-center gap-1 rounded-lg bg-indigo-700 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <Plus size={14} /> Add
                </button>
            </div>

            {/* One workflow flag; normal labels remain independent and multi-select. */}
            <div className="mt-2 flex flex-wrap gap-1 pl-6">
                <KindButton
                    label="Auto"
                    active={flagChoice === 'auto'}
                    hint={
                        flagChoice === 'auto'
                            ? `→ ${TASK_FLAG_META[effectiveFlag].label}`
                            : undefined
                    }
                    onClick={() => setFlagChoice('auto')}
                />
                {TASK_FLAGS.map((k) => (
                    <KindButton
                        key={k}
                        label={`${TASK_FLAG_META[k].emoji} ${TASK_FLAG_META[k].label}`}
                        active={flagChoice === k}
                        onClick={() => {
                            setFlagChoice((prev) => (prev === k ? 'auto' : k));
                            if (k === 'waiting' && !chaseDate) {
                                setChaseDate(format(addDays(new Date(), 3), 'yyyy-MM-dd'));
                            }
                            if (k === 'deadline' && parsed.dueDate && !startDate) {
                                setStartDate(
                                    suggestDeadlineWorkday(parsed.dueDate, 30, new Date()),
                                );
                            }
                        }}
                    />
                ))}
            </div>

            {flagChoice === 'waiting' && (
                <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 pl-6 sm:grid-cols-3">
                    <label className="text-xs font-medium text-slate-600">
                        Waiting on <span className="text-rose-600">*</span>
                        <input
                            value={waitingOn}
                            onChange={(event) => setWaitingOn(event.target.value)}
                            placeholder="Person or organization"
                            className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-2 text-sm font-normal text-slate-800"
                        />
                    </label>
                    <label className="text-xs font-medium text-slate-600">
                        Chase date
                        <input
                            type="date"
                            value={chaseDate}
                            onChange={(event) => setChaseDate(event.target.value)}
                            className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-2 text-sm font-normal text-slate-800"
                        />
                    </label>
                    <label className="text-xs font-medium text-slate-600">
                        Note
                        <input
                            value={contractNote}
                            onChange={(event) => setContractNote(event.target.value)}
                            placeholder="Optional context"
                            className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-2 text-sm font-normal text-slate-800"
                        />
                    </label>
                </div>
            )}

            {flagChoice === 'deadline' && (
                <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 pl-6 sm:grid-cols-2">
                    <label className="text-xs font-medium text-slate-600">
                        Deadline
                        <input
                            type="date"
                            value={draft.dueDate ?? ''}
                            readOnly
                            className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm font-normal text-slate-800"
                        />
                    </label>
                    <label className="text-xs font-medium text-slate-600">
                        Start competing
                        <input
                            type="date"
                            value={deadlineStart}
                            max={draft.dueDate}
                            onChange={(event) => setStartDate(event.target.value)}
                            className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-2 text-sm font-normal text-slate-800"
                        />
                    </label>
                    {!draft.dueDate && (
                        <p className="text-xs text-amber-700 sm:col-span-2">
                            Add a date in the task text, for example “submit report Friday”.
                        </p>
                    )}
                </div>
            )}

            {draft.errors?.length ? (
                <p className="mt-2 pl-6 text-xs font-medium text-rose-700">{draft.errors[0]}</p>
            ) : null}

            {(matchedType ||
                draft.plannedFor ||
                draft.dueDate ||
                draft.priority ||
                draft.energy) && (
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs pl-6">
                    {matchedType && (
                        <span className="app-chip">
                            {matchedType.emoji} {matchedType.name}
                        </span>
                    )}
                    {draft.plannedFor && (
                        <span className="app-chip">
                            <CalendarIcon size={11} /> Plan {draft.plannedFor}
                            {draft.dueTime && ` ${draft.dueTime}`}
                        </span>
                    )}
                    {draft.dueDate && (
                        <span className="app-chip">
                            <CalendarIcon size={11} /> Due {draft.dueDate}
                        </span>
                    )}
                    {draft.priority && (
                        <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                            {draft.priority}
                        </span>
                    )}
                    {draft.energy && <span className="app-chip">{draft.energy} energy</span>}
                </div>
            )}
        </div>
    );
};

const KindButton: React.FC<{
    label: string;
    active: boolean;
    hint?: string;
    onClick: () => void;
}> = ({ label, active, hint, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            active
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300'
        }`}
    >
        {label}
        {hint ? <span className="ml-1 opacity-70">{hint}</span> : null}
    </button>
);

export default QuickCapture;
