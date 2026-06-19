import React, { useMemo, useState } from 'react';
import { Sparkles, Calendar as CalendarIcon, Plus } from 'lucide-react';
import type { TaskType, TaskKind } from '../types';
import { parseQuickCapture } from '../utils/quickCaptureParser';
import { deriveTaskKind, TASK_KIND_META, TASK_KIND_ORDER } from '../utils/taskKind';

interface QuickCaptureProps {
    taskTypes: TaskType[];
    onSubmit: (draft: ReturnType<typeof parseQuickCapture>) => Promise<void> | void;
}

type KindChoice = TaskKind | 'auto';

const QuickCapture: React.FC<QuickCaptureProps> = ({ taskTypes, onSubmit }) => {
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [kindChoice, setKindChoice] = useState<KindChoice>('auto');

    const parsed = useMemo(() => parseQuickCapture(text, taskTypes), [text, taskTypes]);
    // Explicit button choice wins; otherwise use whatever the text implied.
    const draft = useMemo(
        () => (kindChoice === 'auto' ? parsed : { ...parsed, kind: kindChoice }),
        [parsed, kindChoice],
    );
    const matchedType = draft.taskTypeId ? taskTypes.find(t => t.id === draft.taskTypeId) : undefined;
    const effectiveKind = draft.kind ?? deriveTaskKind(draft);

    const submit = async () => {
        if (!draft.title.trim() || busy) return;
        setBusy(true);
        try {
            await onSubmit(draft);
            setText('');
            setKindChoice('auto');
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
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => {
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
                    disabled={!draft.title.trim() || busy}
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
                    hint={kindChoice === 'auto' ? `→ ${TASK_KIND_META[effectiveKind].label}` : undefined}
                    onClick={() => setKindChoice('auto')}
                />
                {TASK_KIND_ORDER.map(k => (
                    <KindButton
                        key={k}
                        label={`${TASK_KIND_META[k].emoji} ${TASK_KIND_META[k].label}`}
                        active={kindChoice === k}
                        onClick={() => setKindChoice(prev => (prev === k ? 'auto' : k))}
                    />
                ))}
            </div>

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
                    {draft.energy && (
                        <span className="app-chip">
                            {draft.energy} energy
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

const KindButton: React.FC<{ label: string; active: boolean; hint?: string; onClick: () => void }> = ({ label, active, hint, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            active
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300'
        }`}
    >
        {label}{hint ? <span className="ml-1 opacity-70">{hint}</span> : null}
    </button>
);

export default QuickCapture;
