import React, { useState } from 'react';
import {
    CalendarDays,
    CheckSquare,
    FileText,
    Loader2,
    Plus,
    Sparkles,
    Trash2,
    X,
} from 'lucide-react';
import {
    commitImport,
    extractFromDocuments,
    type CourseImportAssignment,
    type CourseImportCheckpoint,
    type CourseImportCounts,
    type CourseImportPayload,
    type CourseImportSession,
} from '../services/school-import.service';

interface ImportPreviewDialogProps {
    classId: string;
    initialPayload: CourseImportPayload;
    documentIds: string[];
    initialExtraInstructions?: string;
    onClose: () => void;
    onCommitted: (counts: CourseImportCounts) => void;
    onReanalyzed: (payload: CourseImportPayload) => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toLocalInput(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string {
    return value ? new Date(value).toISOString() : '';
}

const emptyCheckpoint = (): CourseImportCheckpoint => ({
    number: 1,
    title: '',
    subitems: [],
    notes: '',
});

export const ImportPreviewDialog: React.FC<ImportPreviewDialogProps> = ({
    classId,
    initialPayload,
    documentIds,
    initialExtraInstructions = '',
    onClose,
    onCommitted,
    onReanalyzed,
}) => {
    const [payload, setPayload] = useState<CourseImportPayload>(initialPayload);
    const [extraInstructions, setExtraInstructions] = useState(initialExtraInstructions);
    const [busy, setBusy] = useState<'commit' | 'analyze' | null>(null);
    const [error, setError] = useState<string | null>(null);

    const includedAssignments = payload.assignments.filter((item) => item.include !== false).length;
    const includedSessions = payload.sessions.filter((item) => item.include !== false).length;
    const checkpointCount = payload.assignments.reduce(
        (sum, assignment) => sum + (assignment.checkpoints?.length ?? 0),
        0,
    );

    const updateAssignment = (index: number, patch: Partial<CourseImportAssignment>) => {
        setPayload((prev) => ({
            ...prev,
            assignments: prev.assignments.map((item, i) =>
                i === index ? { ...item, ...patch } : item,
            ),
        }));
    };

    const removeAssignment = (index: number) => {
        setPayload((prev) => ({
            ...prev,
            assignments: prev.assignments.filter((_, i) => i !== index),
        }));
    };

    const clearAssignments = () => {
        if (payload.assignments.length === 0) return;
        if (!confirm('Remove all assignments from this import preview?')) return;
        setPayload((prev) => ({ ...prev, assignments: [] }));
    };

    const updateCheckpoint = (
        assignmentIndex: number,
        checkpointIndex: number,
        patch: Partial<CourseImportCheckpoint>,
    ) => {
        setPayload((prev) => ({
            ...prev,
            assignments: prev.assignments.map((assignment, i) => {
                if (i !== assignmentIndex) return assignment;
                const checkpoints = assignment.checkpoints ?? [];
                return {
                    ...assignment,
                    checkpoints: checkpoints.map((checkpoint, ci) =>
                        ci === checkpointIndex ? { ...checkpoint, ...patch } : checkpoint,
                    ),
                };
            }),
        }));
    };

    const addCheckpoint = (assignmentIndex: number) => {
        setPayload((prev) => ({
            ...prev,
            assignments: prev.assignments.map((assignment, i) => {
                if (i !== assignmentIndex) return assignment;
                const checkpoints = assignment.checkpoints ?? [];
                return {
                    ...assignment,
                    checkpoints: [
                        ...checkpoints,
                        { ...emptyCheckpoint(), number: checkpoints.length + 1 },
                    ],
                };
            }),
        }));
    };

    const removeCheckpoint = (assignmentIndex: number, checkpointIndex: number) => {
        setPayload((prev) => ({
            ...prev,
            assignments: prev.assignments.map((assignment, i) =>
                i === assignmentIndex
                    ? {
                          ...assignment,
                          checkpoints: (assignment.checkpoints ?? []).filter(
                              (_, ci) => ci !== checkpointIndex,
                          ),
                      }
                    : assignment,
            ),
        }));
    };

    const updateSession = (index: number, patch: Partial<CourseImportSession>) => {
        setPayload((prev) => ({
            ...prev,
            sessions: prev.sessions.map((item, i) => (i === index ? { ...item, ...patch } : item)),
        }));
    };

    const removeSession = (index: number) => {
        setPayload((prev) => ({
            ...prev,
            sessions: prev.sessions.filter((_, i) => i !== index),
        }));
    };

    const clearSessions = () => {
        if (payload.sessions.length === 0) return;
        if (!confirm('Remove all weekly sessions from this import preview?')) return;
        setPayload((prev) => ({ ...prev, sessions: [] }));
    };

    const clearPreview = () => {
        if (
            payload.assignments.length === 0 &&
            payload.sessions.length === 0 &&
            !payload.summary.trim()
        )
            return;
        if (!confirm('Clear the full AI import preview? This does not delete uploaded PDFs.'))
            return;
        setPayload((prev) => ({ ...prev, summary: '', assignments: [], sessions: [] }));
    };

    const reAnalyze = async () => {
        setBusy('analyze');
        setError(null);
        try {
            const next = await extractFromDocuments(classId, documentIds, extraInstructions);
            setPayload(next);
            onReanalyzed(next);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(null);
        }
    };

    const accept = async () => {
        setBusy('commit');
        setError(null);
        try {
            const counts = await commitImport(classId, payload);
            onCommitted(counts);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
            <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl flex flex-col max-h-[92vh]">
                <div className="flex items-start justify-between gap-3 p-5 border-b border-cove-border">
                    <div>
                        <h2 className="text-lg font-semibold text-cove-ink">Import preview</h2>
                        <p className="text-xs text-cove-soft">
                            Review and edit before writing to school.
                        </p>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={clearPreview}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-cove-danger-deep hover:bg-cove-tint-danger"
                            title="Clear full import preview"
                        >
                            <Trash2 size={14} /> Clear all
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 text-cove-faint hover:text-cove-muted"
                            title="Close"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 p-5 space-y-5">
                    <section className="rounded-xl border border-cove-accent-pale bg-cove-tint-blue/40 p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2 min-w-0">
                                <Sparkles
                                    size={18}
                                    className="mt-0.5 text-cove-accent flex-shrink-0"
                                />
                                <div className="min-w-0">
                                    <h3 className="text-sm font-semibold text-cove-ink">
                                        General summary
                                    </h3>
                                    <p className="text-xs text-cove-soft">
                                        The AI's course-level read before the extracted items below.
                                    </p>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5 text-center">
                                <div className="rounded-xl bg-white px-2 py-1 border border-cove-accent-pale">
                                    <p className="text-sm font-semibold text-cove-ink">
                                        {includedAssignments}
                                    </p>
                                    <p className="text-[10px] text-cove-soft">assignments</p>
                                </div>
                                <div className="rounded-xl bg-white px-2 py-1 border border-cove-accent-pale">
                                    <p className="text-sm font-semibold text-cove-ink">
                                        {checkpointCount}
                                    </p>
                                    <p className="text-[10px] text-cove-soft">steps</p>
                                </div>
                                <div className="rounded-xl bg-white px-2 py-1 border border-cove-accent-pale">
                                    <p className="text-sm font-semibold text-cove-ink">
                                        {includedSessions}
                                    </p>
                                    <p className="text-[10px] text-cove-soft">sessions</p>
                                </div>
                            </div>
                        </div>
                        <textarea
                            value={payload.summary}
                            onChange={(e) =>
                                setPayload((prev) => ({ ...prev, summary: e.target.value }))
                            }
                            rows={4}
                            placeholder="No summary returned yet."
                            className="w-full px-3 py-2 border border-cove-accent-pale rounded-xl text-sm resize-none bg-white focus:outline-none focus:ring-2 focus:ring-cove-accent-pale"
                        />
                    </section>

                    <section className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <CheckSquare size={16} className="text-cove-accent" />
                                <div>
                                    <h3 className="text-sm font-semibold text-cove-ink">
                                        Assignments
                                    </h3>
                                    <p className="text-xs text-cove-soft">
                                        {includedAssignments} included, {payload.assignments.length}{' '}
                                        found
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={clearAssignments}
                                disabled={payload.assignments.length === 0}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-cove-soft hover:bg-[color:var(--buddy-surface-soft)] hover:text-cove-danger-deep disabled:opacity-40"
                            >
                                <Trash2 size={13} /> Delete all
                            </button>
                        </div>
                        {payload.assignments.length === 0 ? (
                            <p className="text-sm text-cove-faint">No assignments found.</p>
                        ) : (
                            payload.assignments.map((assignment, index) => (
                                <div
                                    key={index}
                                    className={`rounded-xl border p-3 space-y-3 ${assignment.include === false ? 'border-cove-border bg-[color:var(--buddy-surface-soft)] opacity-75' : 'border-cove-border bg-white'}`}
                                >
                                    <div className="flex items-start gap-2">
                                        <label className="mt-2 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center">
                                            <input
                                                type="checkbox"
                                                checked={assignment.include !== false}
                                                onChange={(e) =>
                                                    updateAssignment(index, {
                                                        include: e.target.checked,
                                                    })
                                                }
                                                className="h-4 w-4 rounded border-cove-border text-cove-accent"
                                                title="Include assignment"
                                            />
                                        </label>
                                        <input
                                            value={assignment.title}
                                            onChange={(e) =>
                                                updateAssignment(index, { title: e.target.value })
                                            }
                                            className="flex-1 px-3 py-2 border border-cove-border rounded-xl text-sm font-bold"
                                        />
                                        <button
                                            onClick={() => removeAssignment(index)}
                                            className="p-2 text-cove-faint hover:text-cove-danger-deep"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <label className="block sm:col-span-2">
                                            <span className="text-xs font-bold text-cove-muted">
                                                Deadline
                                            </span>
                                            <input
                                                type="datetime-local"
                                                value={toLocalInput(assignment.deadline)}
                                                onChange={(e) =>
                                                    updateAssignment(index, {
                                                        deadline: fromLocalInput(e.target.value),
                                                    })
                                                }
                                                className="app-input mt-1"
                                            />
                                        </label>
                                        <label className="block">
                                            <span className="text-xs font-bold text-cove-muted">
                                                Est. minutes
                                            </span>
                                            <input
                                                type="number"
                                                min={0}
                                                value={assignment.estimatedMinutes ?? ''}
                                                onChange={(e) =>
                                                    updateAssignment(index, {
                                                        estimatedMinutes: e.target.value
                                                            ? Number(e.target.value)
                                                            : undefined,
                                                    })
                                                }
                                                className="app-input mt-1"
                                            />
                                        </label>
                                    </div>
                                    <label className="block">
                                        <span className="text-xs font-bold text-cove-muted">
                                            Notes
                                        </span>
                                        <textarea
                                            value={assignment.description ?? ''}
                                            onChange={(e) =>
                                                updateAssignment(index, {
                                                    description: e.target.value,
                                                })
                                            }
                                            rows={2}
                                            className="app-textarea mt-1 resize-none"
                                        />
                                    </label>
                                    <div className="rounded-xl border border-cove-border bg-[color:var(--buddy-surface-soft)]/70 p-2.5 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-bold text-cove-muted">
                                                Checkpoints{' '}
                                                <span className="text-cove-faint">
                                                    ({assignment.checkpoints?.length ?? 0})
                                                </span>
                                            </p>
                                            <button
                                                onClick={() => addCheckpoint(index)}
                                                className="flex items-center gap-1 text-xs font-bold text-cove-accent hover:text-cove-ink"
                                            >
                                                <Plus size={12} /> Add
                                            </button>
                                        </div>
                                        {(assignment.checkpoints ?? []).length === 0 && (
                                            <p className="text-xs text-cove-faint">
                                                No checkpoints for this assignment.
                                            </p>
                                        )}
                                        {(assignment.checkpoints ?? []).map(
                                            (checkpoint, checkpointIndex) => (
                                                <div
                                                    key={checkpointIndex}
                                                    className="grid grid-cols-[56px_1fr_auto] gap-2 items-start rounded-xl bg-white border border-cove-border p-2"
                                                >
                                                    <input
                                                        value={checkpoint.number}
                                                        onChange={(e) =>
                                                            updateCheckpoint(
                                                                index,
                                                                checkpointIndex,
                                                                { number: e.target.value },
                                                            )
                                                        }
                                                        className="px-2 py-1.5 border border-cove-border rounded-xl text-xs"
                                                    />
                                                    <div className="space-y-1">
                                                        <input
                                                            value={checkpoint.title}
                                                            onChange={(e) =>
                                                                updateCheckpoint(
                                                                    index,
                                                                    checkpointIndex,
                                                                    { title: e.target.value },
                                                                )
                                                            }
                                                            className="w-full px-2 py-1.5 border border-cove-border rounded-xl text-xs"
                                                        />
                                                        <input
                                                            value={(checkpoint.subitems ?? []).join(
                                                                ', ',
                                                            )}
                                                            onChange={(e) =>
                                                                updateCheckpoint(
                                                                    index,
                                                                    checkpointIndex,
                                                                    {
                                                                        subitems: e.target.value
                                                                            .split(',')
                                                                            .map((s) => s.trim())
                                                                            .filter(Boolean),
                                                                    },
                                                                )
                                                            }
                                                            placeholder="Subitems, comma separated"
                                                            className="w-full px-2 py-1.5 border border-cove-border rounded-xl text-xs"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() =>
                                                            removeCheckpoint(index, checkpointIndex)
                                                        }
                                                        className="p-1.5 text-cove-faint hover:text-cove-danger-deep"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ),
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </section>

                    <section className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <CalendarDays size={16} className="text-cove-accent" />
                                <div>
                                    <h3 className="text-sm font-semibold text-cove-ink">
                                        Weekly sessions
                                    </h3>
                                    <p className="text-xs text-cove-soft">
                                        {includedSessions} included, {payload.sessions.length} found
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={clearSessions}
                                disabled={payload.sessions.length === 0}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-cove-soft hover:bg-[color:var(--buddy-surface-soft)] hover:text-cove-danger-deep disabled:opacity-40"
                            >
                                <Trash2 size={13} /> Delete all
                            </button>
                        </div>
                        {payload.sessions.length === 0 ? (
                            <p className="text-sm text-cove-faint">No weekly sessions found.</p>
                        ) : (
                            payload.sessions.map((session, index) => (
                                <div
                                    key={index}
                                    className={`grid grid-cols-2 sm:grid-cols-[auto_90px_90px_1fr_auto] gap-2 items-center rounded-xl border p-3 ${session.include === false ? 'border-cove-border bg-[color:var(--buddy-surface-soft)] opacity-75' : 'border-cove-border bg-white'}`}
                                >
                                    <label className="flex items-center gap-2 text-xs text-cove-muted">
                                        <input
                                            type="checkbox"
                                            checked={session.include !== false}
                                            onChange={(e) =>
                                                updateSession(index, { include: e.target.checked })
                                            }
                                        />
                                        <select
                                            value={session.dayOfWeek}
                                            onChange={(e) =>
                                                updateSession(index, {
                                                    dayOfWeek: Number(e.target.value),
                                                })
                                            }
                                            className="px-2 py-1.5 border border-cove-border rounded-xl text-xs bg-white"
                                        >
                                            {DAYS.map((day, dayIndex) => (
                                                <option key={day} value={dayIndex}>
                                                    {day}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <input
                                        type="time"
                                        value={session.startTime}
                                        onChange={(e) =>
                                            updateSession(index, { startTime: e.target.value })
                                        }
                                        className="px-2 py-1.5 border border-cove-border rounded-xl text-xs"
                                    />
                                    <input
                                        type="time"
                                        value={session.endTime}
                                        onChange={(e) =>
                                            updateSession(index, { endTime: e.target.value })
                                        }
                                        className="px-2 py-1.5 border border-cove-border rounded-xl text-xs"
                                    />
                                    <input
                                        value={session.location ?? ''}
                                        onChange={(e) =>
                                            updateSession(index, { location: e.target.value })
                                        }
                                        placeholder="Location"
                                        className="col-span-2 sm:col-span-1 px-2 py-1.5 border border-cove-border rounded-xl text-xs"
                                    />
                                    <button
                                        onClick={() => removeSession(index)}
                                        className="p-1.5 text-cove-faint hover:text-cove-danger-deep"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))
                        )}
                    </section>

                    <label className="block rounded-xl border border-cove-border bg-[color:var(--buddy-surface-soft)]/70 p-3">
                        <span className="flex items-center gap-2 text-xs font-bold text-cove-muted">
                            <FileText size={14} className="text-cove-soft" />
                            Extra context for re-analyze
                        </span>
                        <textarea
                            value={extraInstructions}
                            onChange={(e) => setExtraInstructions(e.target.value)}
                            rows={2}
                            className="mt-2 w-full px-3 py-2 border border-cove-border rounded-xl text-sm resize-none bg-white"
                        />
                    </label>

                    {error && <p className="text-sm text-cove-danger-deep">{error}</p>}
                </div>

                <div className="flex gap-2 p-4 border-t border-cove-border">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-sm font-bold text-cove-muted hover:bg-[color:var(--buddy-surface-soft)]"
                    >
                        Close
                    </button>
                    <button
                        onClick={reAnalyze}
                        disabled={busy !== null || documentIds.length === 0}
                        className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-cove-accent hover:bg-cove-tint-blue disabled:opacity-50"
                    >
                        {busy === 'analyze' && <Loader2 size={16} className="animate-spin" />}
                        Re-analyze
                    </button>
                    <button
                        onClick={accept}
                        disabled={busy !== null}
                        className="ml-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-cove-accent text-white hover:bg-[#3a8dc7] disabled:opacity-50"
                    >
                        {busy === 'commit' && <Loader2 size={16} className="animate-spin" />}
                        Accept
                    </button>
                </div>
            </div>
        </div>
    );
};
