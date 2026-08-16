import React, { useState } from 'react';
import { X } from 'lucide-react';
import type {
    Assignment,
    SchoolClass,
    AssignmentStatus,
} from '../../../services/supabase/converters/school';

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

export const AssignmentForm: React.FC<AssignmentFormProps> = ({
    initial,
    classes,
    defaultClassId,
    onClose,
    onSubmit,
}) => {
    const [classId, setClassId] = useState(
        initial?.classId ?? defaultClassId ?? classes[0]?.id ?? '',
    );
    const [title, setTitle] = useState(initial?.title ?? '');
    const [description, setDescription] = useState(initial?.description ?? '');
    const [deadlineLocal, setDeadlineLocal] = useState(toLocalInput(initial?.deadline));
    const [estimated, setEstimated] = useState<string>(
        initial?.estimatedMinutes != null ? String(initial.estimatedMinutes) : '',
    );
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
            <form
                onSubmit={submit}
                className="w-full max-w-md bg-white rounded-2xl p-5 space-y-4 shadow-xl"
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-cove-ink">
                        {initial ? 'Edit assignment' : 'New assignment'}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-cove-faint hover:text-cove-muted"
                    >
                        <X size={20} />
                    </button>
                </div>

                <label className="block">
                    <span className="text-xs font-bold text-cove-muted">Class</span>
                    <select
                        value={classId}
                        onChange={(e) => setClassId(e.target.value)}
                        required
                        className="app-input mt-1"
                    >
                        {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="block">
                    <span className="text-xs font-bold text-cove-muted">Title</span>
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        autoFocus
                        className="app-input mt-1"
                    />
                </label>

                <label className="block">
                    <span className="text-xs font-bold text-cove-muted">Deadline</span>
                    <input
                        type="datetime-local"
                        value={deadlineLocal}
                        onChange={(e) => setDeadlineLocal(e.target.value)}
                        required
                        className="app-input mt-1"
                    />
                </label>

                <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                        <span className="text-xs font-bold text-cove-muted">Est. minutes</span>
                        <input
                            type="number"
                            min={0}
                            value={estimated}
                            onChange={(e) => setEstimated(e.target.value)}
                            className="app-input mt-1"
                        />
                    </label>
                    {initial && (
                        <label className="block">
                            <span className="text-xs font-bold text-cove-muted">Status</span>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value as AssignmentStatus)}
                                className="app-input mt-1"
                            >
                                <option value="pending">Pending</option>
                                <option value="in_progress">In progress</option>
                                <option value="submitted">Submitted</option>
                                <option value="graded">Graded</option>
                            </select>
                        </label>
                    )}
                </div>

                <label className="block">
                    <span className="text-xs font-bold text-cove-muted">Notes</span>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        className="app-input mt-1"
                    />
                </label>

                <div className="flex gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2 rounded-xl text-sm font-bold text-cove-muted hover:bg-[color:var(--buddy-surface-soft)]"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={busy || !classId || !title.trim() || !deadlineLocal}
                        className="flex-1 px-4 py-2 rounded-xl text-sm font-bold bg-cove-accent text-white hover:bg-[#3a8dc7] disabled:opacity-50"
                    >
                        {initial ? 'Save' : 'Create'}
                    </button>
                </div>
            </form>
        </div>
    );
};
