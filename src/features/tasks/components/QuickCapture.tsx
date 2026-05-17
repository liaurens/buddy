import React, { useMemo, useState } from 'react';
import { Sparkles, Calendar as CalendarIcon, Plus } from 'lucide-react';
import type { TaskType } from '../types';
import { parseQuickCapture } from '../utils/quickCaptureParser';

interface QuickCaptureProps {
    taskTypes: TaskType[];
    onSubmit: (draft: ReturnType<typeof parseQuickCapture>) => Promise<void> | void;
}

const QuickCapture: React.FC<QuickCaptureProps> = ({ taskTypes, onSubmit }) => {
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);

    const draft = useMemo(() => parseQuickCapture(text, taskTypes), [text, taskTypes]);
    const matchedType = draft.taskTypeId ? taskTypes.find(t => t.id === draft.taskTypeId) : undefined;

    const submit = async () => {
        if (!draft.title.trim() || busy) return;
        setBusy(true);
        try {
            await onSubmit(draft);
            setText('');
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

export default QuickCapture;
