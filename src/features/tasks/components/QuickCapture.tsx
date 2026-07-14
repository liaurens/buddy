import React, { useMemo, useState } from 'react';
import { addDays, format } from 'date-fns';
import { Sparkles, Calendar as CalendarIcon, Plus } from 'lucide-react';
import type { TaskType, TaskKind } from '../types';
import { parseQuickCapture } from '../utils/quickCaptureParser';
import { deriveTaskKind, TASK_KIND_META, PICKABLE_TASK_KINDS } from '../utils/taskKind';
import { suggestedDeadlineStart } from '../utils/taskContracts';

interface QuickCaptureProps {
    taskTypes: TaskType[];
    onSubmit: (draft: ReturnType<typeof parseQuickCapture>) => Promise<void> | void;
}

type KindChoice = TaskKind | 'auto';

const QuickCapture: React.FC<QuickCaptureProps> = ({ taskTypes, onSubmit }) => {
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [kindChoice, setKindChoice] = useState<KindChoice>('auto');
    const [waitingOn, setWaitingOn] = useState('');
    const [chaseDate, setChaseDate] = useState('');
    const [startDate, setStartDate] = useState('');
    const [contractNote, setContractNote] = useState('');

    const parsed = useMemo(() => parseQuickCapture(text, taskTypes), [text, taskTypes]);
    const deadlineStart =
        startDate || (parsed.dueDate ? suggestedDeadlineStart(parsed.dueDate, new Date()) : '');
    // Explicit button choice wins; otherwise use whatever the text implied.
    const draft = useMemo(() => {
        if (kindChoice === 'auto') return parsed;
        if (kindChoice === 'waiting') {
            return {
                ...parsed,
                kind: kindChoice,
                waitingOn: waitingOn.trim() || undefined,
                dueDate: chaseDate || parsed.dueDate,
                notes: contractNote.trim() || undefined,
            };
        }
        if (kindChoice === 'deadline') {
            return { ...parsed, kind: kindChoice, startDate: deadlineStart || undefined };
        }
        return { ...parsed, kind: kindChoice };
    }, [parsed, kindChoice, waitingOn, chaseDate, contractNote, deadlineStart]);
    const matchedType = draft.taskTypeId
        ? taskTypes.find((t) => t.id === draft.taskTypeId)
        : undefined;
    const effectiveKind = draft.kind ?? deriveTaskKind(draft);
    const contractReady =
        (kindChoice !== 'waiting' || Boolean(draft.waitingOn)) &&
        (kindChoice !== 'deadline' || Boolean(draft.dueDate && draft.startDate));

    const submit = async () => {
        if (!draft.title.trim() || busy) return;
        setBusy(true);
        try {
            await onSubmit(draft);
            setText('');
            setKindChoice('auto');
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
                    placeholder="Add task… try 'email mom tomorrow 2pm'"
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

            {/* Kind selector — Auto derives from the text; tap to force a kind. */}
            <div className="mt-2 flex flex-wrap gap-1 pl-6">
                <KindButton
                    label="Auto"
                    active={kindChoice === 'auto'}
                    hint={
                        kindChoice === 'auto'
                            ? `→ ${TASK_KIND_META[effectiveKind].label}`
                            : undefined
                    }
                    onClick={() => setKindChoice('auto')}
                />
                {PICKABLE_TASK_KINDS.map((k) => (
                    <KindButton
                        key={k}
                        label={`${TASK_KIND_META[k].emoji} ${TASK_KIND_META[k].label}`}
                        active={kindChoice === k}
                        onClick={() => {
                            setKindChoice((prev) => (prev === k ? 'auto' : k));
                            if (k === 'waiting' && !chaseDate) {
                                setChaseDate(format(addDays(new Date(), 3), 'yyyy-MM-dd'));
                            }
                            if (k === 'deadline' && parsed.dueDate && !startDate) {
                                setStartDate(suggestedDeadlineStart(parsed.dueDate, new Date()));
                            }
                        }}
                    />
                ))}
            </div>

            {kindChoice === 'waiting' && (
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

            {kindChoice === 'deadline' && (
                <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 pl-6 sm:grid-cols-2">
                    <label className="text-xs font-medium text-slate-600">
                        Deadline
                        <input
                            type="date"
                            value={parsed.dueDate ?? ''}
                            readOnly
                            className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm font-normal text-slate-800"
                        />
                    </label>
                    <label className="text-xs font-medium text-slate-600">
                        Start competing
                        <input
                            type="date"
                            value={deadlineStart}
                            max={parsed.dueDate}
                            onChange={(event) => setStartDate(event.target.value)}
                            className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-2 text-sm font-normal text-slate-800"
                        />
                    </label>
                    {!parsed.dueDate && (
                        <p className="text-xs text-amber-700 sm:col-span-2">
                            Add a date in the task text, for example “submit report Friday”.
                        </p>
                    )}
                </div>
            )}

            {(matchedType || draft.dueDate || draft.priority || draft.energy) && (
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs pl-6">
                    {matchedType && (
                        <span className="app-chip">
                            {matchedType.emoji} {matchedType.name}
                        </span>
                    )}
                    {draft.dueDate && (
                        <span className="app-chip">
                            <CalendarIcon size={11} /> {draft.dueDate}
                            {draft.dueTime && ` ${draft.dueTime}`}
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
