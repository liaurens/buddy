import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { Assignment, SchoolClass, AssignmentStatus } from '../../../services/supabase/converters/school';

interface AssignmentFormProps {
    initial?: Assignment | null;
    classes: SchoolClass[];
    defaultClassId?: string;
    onClose: () => void;
    onSubmit: (params: {
        classId: string;
        title: string;
        description?: string;
        deadline: string;
        estimatedMinutes?: number;
        status?: AssignmentStatus;
    }) => Promise<void>;
}

function toLocalInput(iso: string | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const AssignmentForm: React.FC<AssignmentFormProps> = ({ initial, classes, defaultClassId, onClose, onSubmit }) => {
    const [classId, setClassId] = useState(initial?.classId ?? defaultClassId ?? classes[0]?.id ?? '');
    const [title, setTitle] = useState(initial?.title ?? '');
    const [description, setDescription] = useState(initial?.description ?? '');
    const [deadlineLocal, setDeadlineLocal] = useState(toLocalInput(initial?.deadline));
    const [estimated, setEstimated] = useState<string>(initial?.estimatedMinutes != null ? String(initial.estimatedMinutes) : '');
    const [status, setStatus] = useState<AssignmentStatus>(initial?.status ?? 'pending');
    const [busy, setBusy] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!classId || !title.trim() || !deadlineLocal) return;
        setBusy(true);
        try {
            await onSubmit({
                classId,
                title: title.trim(),
                description: description.trim() || undefined,
                deadline: new Date(deadlineLocal).toISOString(),
                estimatedMinutes: estimated ? Number(estimated) : undefined,
                status: initial ? status : undefined,
            });
            onClose();
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
            <form onSubmit={submit} className="w-full max-w-md bg-white rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">{initial ? 'Edit assignment' : 'New assignment'}</h2>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                <label className="block">
                    <span className="text-xs font-medium text-slate-600">Class</span>
                    <select value={classId} onChange={e => setClassId(e.target.value)} required
                        className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </label>

                <label className="block">
                    <span className="text-xs font-medium text-slate-600">Title</span>
                    <input value={title} onChange={e => setTitle(e.target.value)} required autoFocus
                        className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </label>

                <label className="block">
                    <span className="text-xs font-medium text-slate-600">Deadline</span>
                    <input type="datetime-local" value={deadlineLocal} onChange={e => setDeadlineLocal(e.target.value)} required
                        className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </label>

                <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                        <span className="text-xs font-medium text-slate-600">Est. minutes</span>
                        <input type="number" min={0} value={estimated} onChange={e => setEstimated(e.target.value)}
                            className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                    </label>
                    {initial && (
                        <label className="block">
                            <span className="text-xs font-medium text-slate-600">Status</span>
                            <select value={status} onChange={e => setStatus(e.target.value as AssignmentStatus)}
                                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                                <option value="pending">Pending</option>
                                <option value="in_progress">In progress</option>
                                <option value="submitted">Submitted</option>
                                <option value="graded">Graded</option>
                            </select>
                        </label>
                    )}
                </div>

                <label className="block">
                    <span className="text-xs font-medium text-slate-600">Notes</span>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                        className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </label>

                <div className="flex gap-2 pt-2">
                    <button type="button" onClick={onClose}
                        className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">
                        Cancel
                    </button>
                    <button type="submit" disabled={busy || !classId || !title.trim() || !deadlineLocal}
                        className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                        {initial ? 'Save' : 'Create'}
                    </button>
                </div>
            </form>
        </div>
    );
};
