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
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3">
            <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-indigo-400 flex-shrink-0" />
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
                    className="flex-1 bg-transparent outline-none text-slate-800 placeholder:text-slate-300"
                />
                <button
                    onClick={() => void submit()}
                    disabled={!draft.title.trim() || busy}
                    className="bg-indigo-600 text-white rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                >
                    <Plus size={14} /> Add
                </button>
            </div>

            {(matchedType || draft.dueDate || draft.priority || draft.energy) && (
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs pl-6">
                    {matchedType && (
                        <span className="flex items-center gap-1 bg-slate-50 text-slate-700 rounded px-2 py-0.5">
                            {matchedType.emoji} {matchedType.name}
                        </span>
                    )}
                    {draft.dueDate && (
                        <span className="flex items-center gap-1 bg-slate-50 text-slate-700 rounded px-2 py-0.5">
                            <CalendarIcon size={11} /> {draft.dueDate}
                            {draft.dueTime && ` ${draft.dueTime}`}
                        </span>
                    )}
                    {draft.priority && (
                        <span className="bg-rose-50 text-rose-700 rounded px-2 py-0.5 font-bold uppercase tracking-wider">
                            {draft.priority}
                        </span>
                    )}
                    {draft.energy && (
                        <span className="bg-slate-50 text-slate-700 rounded px-2 py-0.5">
                            {draft.energy} energy
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

export default QuickCapture;
