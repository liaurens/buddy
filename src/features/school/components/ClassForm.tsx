import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { SchoolClass } from '../../../services/supabase/converters/school';

const COLOR_OPTIONS = [
    '#6366f1',
    '#0ea5e9',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#ec4899',
    '#8b5cf6',
    '#14b8a6',
];

interface ClassFormProps {
    initial?: SchoolClass | null;
    onClose: () => void;
    onSubmit: (params: {
        name: string;
        instructor?: string;
        term?: string;
        color?: string;
    }) => Promise<void>;
}

export const ClassForm: React.FC<ClassFormProps> = ({ initial, onClose, onSubmit }) => {
    const [name, setName] = useState(initial?.name ?? '');
    const [instructor, setInstructor] = useState(initial?.instructor ?? '');
    const [term, setTerm] = useState(initial?.term ?? '');
    const [color, setColor] = useState(initial?.color ?? COLOR_OPTIONS[0]);
    const [busy, setBusy] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        setBusy(true);
        try {
            await onSubmit({
                name: name.trim(),
                instructor: instructor.trim() || undefined,
                term: term.trim() || undefined,
                color,
            });
            onClose();
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
            <form
                onSubmit={submit}
                className="w-full max-w-md bg-white rounded-2xl p-5 space-y-4 shadow-xl"
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">
                        {initial ? 'Edit class' : 'New class'}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600"
                    >
                        <X size={20} />
                    </button>
                </div>

                <label className="block">
                    <span className="text-xs font-medium text-slate-600">Name</span>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        autoFocus
                        className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                </label>

                <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                        <span className="text-xs font-medium text-slate-600">Instructor</span>
                        <input
                            value={instructor}
                            onChange={(e) => setInstructor(e.target.value)}
                            className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        />
                    </label>
                    <label className="block">
                        <span className="text-xs font-medium text-slate-600">Term</span>
                        <input
                            value={term}
                            onChange={(e) => setTerm(e.target.value)}
                            placeholder="Spring 2026"
                            className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        />
                    </label>
                </div>

                <div>
                    <span className="text-xs font-medium text-slate-600">Color</span>
                    <div className="mt-1 flex gap-2 flex-wrap">
                        {COLOR_OPTIONS.map((c) => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setColor(c)}
                                className={`w-8 h-8 rounded-full border-2 ${color === c ? 'border-slate-900' : 'border-transparent'}`}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                    </div>
                </div>

                <div className="flex gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={busy || !name.trim()}
                        className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {initial ? 'Save' : 'Create'}
                    </button>
                </div>
            </form>
        </div>
    );
};
