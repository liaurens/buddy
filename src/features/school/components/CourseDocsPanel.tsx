import React, { useMemo, useState } from 'react';
import {
    Check,
    ExternalLink,
    FileText,
    Loader2,
    Pencil,
    Search,
    Sparkles,
    Trash2,
    Upload,
    X,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { ClassDocument } from '../../../services/supabase/converters/school';
import { useClassDocuments } from '../hooks/useClassDocuments';
import {
    extractFromDocuments,
    getDocumentDownloadUrl,
    type CourseImportCounts,
    type CourseImportPayload,
} from '../services/school-import.service';
import { UploadDocsDialog } from './UploadDocsDialog';
import { ImportPreviewDialog } from './ImportPreviewDialog';

interface CourseDocsPanelProps {
    classId: string;
}

const KIND_LABELS: Record<string, string> = {
    cursushandleiding: 'Manual',
    instructions: 'Instructions',
    other: 'Other',
};

function asPayload(document: ClassDocument): CourseImportPayload | null {
    const summary = document.extractedSummary;
    if (!summary || typeof summary !== 'object') return null;
    return {
        summary: typeof summary.summary === 'string' ? summary.summary : '',
        sourceDocumentId:
            typeof summary.sourceDocumentId === 'string' ? summary.sourceDocumentId : document.id,
        assignments: Array.isArray(summary.assignments)
            ? (summary.assignments as CourseImportPayload['assignments'])
            : [],
        sessions: Array.isArray(summary.sessions)
            ? (summary.sessions as CourseImportPayload['sessions'])
            : [],
    };
}

export const CourseDocsPanel: React.FC<CourseDocsPanelProps> = ({ classId }) => {
    const queryClient = useQueryClient();
    const { documents, isLoading, updateDocument, deleteDocument, refreshDocuments } =
        useClassDocuments(classId);
    const [showUpload, setShowUpload] = useState(false);
    const [query, setQuery] = useState('');
    const [folderFilter, setFolderFilter] = useState('all');
    const [kindFilter, setKindFilter] = useState('all');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState({
        name: '',
        kind: 'other',
        folder: 'General',
        tags: '',
        notes: '',
    });
    const [preview, setPreview] = useState<{
        payload: CourseImportPayload;
        documentIds: string[];
        extraInstructions: string;
    } | null>(null);
    const [busyDocId, setBusyDocId] = useState<string | null>(null);
    const [deletingAll, setDeletingAll] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const extractedPayloads = useMemo(
        () =>
            documents
                .map(asPayload)
                .filter((payload): payload is CourseImportPayload => Boolean(payload)),
        [documents],
    );
    const latestSummary =
        extractedPayloads.find((payload) => payload.summary.trim())?.summary.trim() ?? '';
    const extractedAssignmentCount = extractedPayloads.reduce(
        (sum, payload) => sum + payload.assignments.length,
        0,
    );
    const extractedSessionCount = extractedPayloads.reduce(
        (sum, payload) => sum + payload.sessions.length,
        0,
    );
    const folders = useMemo(() => {
        const unique = Array.from(
            new Set(documents.map((document) => document.folder || 'General')),
        );
        return unique.sort((a, b) => a.localeCompare(b));
    }, [documents]);
    const filteredDocuments = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        return documents.filter((document) => {
            if (folderFilter !== 'all' && (document.folder || 'General') !== folderFilter)
                return false;
            if (kindFilter !== 'all' && document.kind !== kindFilter) return false;
            if (!normalized) return true;
            const haystack = [
                document.name,
                document.folder,
                document.notes ?? '',
                ...document.tags,
            ]
                .join(' ')
                .toLowerCase();
            return haystack.includes(normalized);
        });
    }, [documents, folderFilter, kindFilter, query]);

    const startEdit = (document: ClassDocument) => {
        setEditingId(document.id);
        setEditDraft({
            name: document.name,
            kind: document.kind,
            folder: document.folder || 'General',
            tags: document.tags.join(', '),
            notes: document.notes ?? '',
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditDraft({ name: '', kind: 'other', folder: 'General', tags: '', notes: '' });
    };

    const saveEdit = async (document: ClassDocument) => {
        setError(null);
        try {
            await updateDocument(document, {
                name: editDraft.name,
                kind: editDraft.kind as ClassDocument['kind'],
                folder: editDraft.folder,
                tags: editDraft.tags
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                notes: editDraft.notes,
            });
            cancelEdit();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    const openDocument = async (document: ClassDocument) => {
        try {
            const url = await getDocumentDownloadUrl(document.storagePath);
            window.open(url, '_blank', 'noopener,noreferrer');
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    const analyzeDocument = async (document: ClassDocument) => {
        setBusyDocId(document.id);
        setError(null);
        setMessage(null);
        try {
            const payload = await extractFromDocuments(classId, [document.id]);
            refreshDocuments();
            setPreview({ payload, documentIds: [document.id], extraInstructions: '' });
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusyDocId(null);
        }
    };

    const removeDocument = async (document: ClassDocument) => {
        if (!confirm(`Delete "${document.name}"?`)) return;
        setError(null);
        try {
            await deleteDocument(document);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    const removeAllDocuments = async () => {
        if (documents.length === 0) return;
        if (
            !confirm(
                `Delete all ${documents.length} uploaded course PDFs? Imported school assignments will stay in your school list.`,
            )
        )
            return;
        setDeletingAll(true);
        setError(null);
        setMessage(null);
        try {
            await Promise.all(documents.map((document) => deleteDocument(document)));
            setMessage('Deleted all uploaded course PDFs.');
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setDeletingAll(false);
        }
    };

    const onCommitted = (counts: CourseImportCounts) => {
        setPreview(null);
        setMessage(
            `Imported ${counts.assignments} assignments and ${counts.sessions} sessions into school.`,
        );
        queryClient.invalidateQueries({ queryKey: ['assignments'] });
        queryClient.invalidateQueries({ queryKey: ['classSessions'] });
        refreshDocuments();
    };

    return (
        <div className="space-y-4 rounded-2xl border border-cove-border/80 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-cove-ink">Course documents</h3>
                    <p className="mt-1 text-sm leading-5 text-cove-soft">
                        Upload PDFs and import deadlines, checkpoints, and sessions.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {documents.length > 0 && (
                        <button
                            type="button"
                            onClick={removeAllDocuments}
                            disabled={deletingAll}
                            className="flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-cove-danger-deep transition-colors hover:bg-cove-tint-danger disabled:opacity-50"
                            title="Delete all uploaded PDFs"
                        >
                            {deletingAll ? (
                                <Loader2 size={15} className="animate-spin" />
                            ) : (
                                <Trash2 size={15} />
                            )}
                            Delete all
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setShowUpload(true)}
                        className="flex min-h-10 items-center gap-2 rounded-xl bg-cove-accent px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#3a8dc7]"
                    >
                        <Upload size={15} /> Upload
                    </button>
                </div>
            </div>

            {latestSummary && (
                <section className="space-y-2 rounded-xl border border-cove-accent-pale bg-cove-tint-blue/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                            <Sparkles size={16} className="flex-shrink-0 text-cove-ink" />
                            <p className="text-sm font-semibold text-cove-ink">General summary</p>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2 text-xs font-bold text-cove-muted">
                            <span>{extractedAssignmentCount} assignments</span>
                            <span>{extractedSessionCount} sessions</span>
                        </div>
                    </div>
                    <p className="text-sm leading-6 text-cove-muted">{latestSummary}</p>
                </section>
            )}

            {documents.length > 0 && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
                    <label className="relative block">
                        <Search
                            size={15}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-cove-faint"
                        />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search documents"
                            className="min-h-11 w-full rounded-xl border border-cove-border py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-cove-accent-pale"
                        />
                    </label>
                    <select
                        value={folderFilter}
                        onChange={(e) => setFolderFilter(e.target.value)}
                        className="min-h-11 rounded-xl border border-cove-border bg-white px-3 py-2 text-sm text-cove-muted"
                    >
                        <option value="all">All folders</option>
                        {folders.map((folder) => (
                            <option key={folder} value={folder}>
                                {folder}
                            </option>
                        ))}
                    </select>
                    <select
                        value={kindFilter}
                        onChange={(e) => setKindFilter(e.target.value)}
                        className="min-h-11 rounded-xl border border-cove-border bg-white px-3 py-2 text-sm text-cove-muted"
                    >
                        <option value="all">All types</option>
                        {Object.entries(KIND_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-cove-soft">
                    <Loader2 size={16} className="animate-spin" /> Loading documents
                </div>
            ) : documents.length === 0 ? (
                <p className="rounded-xl border border-dashed border-cove-border bg-[color:var(--buddy-surface-soft)]/70 px-3 py-4 text-sm text-cove-soft">
                    No course PDFs uploaded yet.
                </p>
            ) : filteredDocuments.length === 0 ? (
                <p className="rounded-xl border border-dashed border-cove-border bg-[color:var(--buddy-surface-soft)]/70 px-3 py-4 text-sm text-cove-soft">
                    No documents match those filters.
                </p>
            ) : (
                <ul className="space-y-2">
                    {filteredDocuments.map((document) => {
                        const extracted = asPayload(document);
                        const editing = editingId === document.id;
                        return (
                            <li
                                key={document.id}
                                className="rounded-xl border border-cove-border/80 px-3 py-3"
                            >
                                {editing ? (
                                    <div className="space-y-2">
                                        <input
                                            value={editDraft.name}
                                            onChange={(e) =>
                                                setEditDraft((prev) => ({
                                                    ...prev,
                                                    name: e.target.value,
                                                }))
                                            }
                                            className="min-h-10 w-full rounded-xl border border-cove-border px-3 py-2 text-sm font-bold"
                                        />
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                            <select
                                                value={editDraft.kind}
                                                onChange={(e) =>
                                                    setEditDraft((prev) => ({
                                                        ...prev,
                                                        kind: e.target.value,
                                                    }))
                                                }
                                                className="min-h-10 rounded-xl border border-cove-border bg-white px-3 py-2 text-sm"
                                            >
                                                {Object.entries(KIND_LABELS).map(
                                                    ([value, label]) => (
                                                        <option key={value} value={value}>
                                                            {label}
                                                        </option>
                                                    ),
                                                )}
                                            </select>
                                            <input
                                                value={editDraft.folder}
                                                onChange={(e) =>
                                                    setEditDraft((prev) => ({
                                                        ...prev,
                                                        folder: e.target.value,
                                                    }))
                                                }
                                                placeholder="Folder"
                                                className="min-h-10 rounded-xl border border-cove-border px-3 py-2 text-sm"
                                            />
                                            <input
                                                value={editDraft.tags}
                                                onChange={(e) =>
                                                    setEditDraft((prev) => ({
                                                        ...prev,
                                                        tags: e.target.value,
                                                    }))
                                                }
                                                placeholder="Tags"
                                                className="min-h-10 rounded-xl border border-cove-border px-3 py-2 text-sm"
                                            />
                                        </div>
                                        <textarea
                                            value={editDraft.notes}
                                            onChange={(e) =>
                                                setEditDraft((prev) => ({
                                                    ...prev,
                                                    notes: e.target.value,
                                                }))
                                            }
                                            rows={2}
                                            placeholder="Notes"
                                            className="w-full resize-none rounded-xl border border-cove-border px-3 py-2 text-sm"
                                        />
                                        <div className="flex justify-end gap-1">
                                            <button
                                                type="button"
                                                onClick={cancelEdit}
                                                className="flex h-10 w-10 items-center justify-center rounded-xl text-cove-soft hover:bg-[color:var(--buddy-surface-soft)] hover:text-cove-ink"
                                                title="Cancel"
                                            >
                                                <X size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => saveEdit(document)}
                                                className="flex h-10 w-10 items-center justify-center rounded-xl text-cove-success-deep hover:bg-cove-tint-green"
                                                title="Save"
                                            >
                                                <Check size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                        <FileText
                                            size={18}
                                            className="flex-shrink-0 text-cove-accent"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="truncate text-sm font-semibold text-cove-ink">
                                                {document.name}
                                            </p>
                                            <p className="mt-0.5 truncate text-sm text-cove-soft">
                                                {document.folder || 'General'} ·{' '}
                                                {KIND_LABELS[document.kind]} ·{' '}
                                                {Math.max(1, Math.round(document.sizeBytes / 1024))}{' '}
                                                KB
                                                {document.tags.length > 0 &&
                                                    ` · ${document.tags.join(', ')}`}
                                            </p>
                                            {document.notes && (
                                                <p className="mt-0.5 truncate text-sm text-cove-muted">
                                                    {document.notes}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-end gap-1">
                                            {extracted ? (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setPreview({
                                                            payload: extracted,
                                                            documentIds: [document.id],
                                                            extraInstructions: '',
                                                        })
                                                    }
                                                    className="flex h-10 w-10 items-center justify-center rounded-xl text-cove-soft hover:bg-cove-tint-blue hover:text-cove-ink"
                                                    title="Open preview"
                                                >
                                                    <Sparkles size={16} />
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => analyzeDocument(document)}
                                                    disabled={busyDocId === document.id}
                                                    className="flex h-10 w-10 items-center justify-center rounded-xl text-cove-soft hover:bg-cove-tint-blue hover:text-cove-ink disabled:opacity-50"
                                                    title="Analyze"
                                                >
                                                    {busyDocId === document.id ? (
                                                        <Loader2
                                                            size={16}
                                                            className="animate-spin"
                                                        />
                                                    ) : (
                                                        <Sparkles size={16} />
                                                    )}
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => startEdit(document)}
                                                className="flex h-10 w-10 items-center justify-center rounded-xl text-cove-soft hover:bg-cove-tint-blue hover:text-cove-ink"
                                                title="Edit metadata"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => openDocument(document)}
                                                className="flex h-10 w-10 items-center justify-center rounded-xl text-cove-soft hover:bg-[color:var(--buddy-surface-soft)] hover:text-cove-ink"
                                                title="Open PDF"
                                            >
                                                <ExternalLink size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => removeDocument(document)}
                                                className="flex h-10 w-10 items-center justify-center rounded-xl text-cove-soft hover:bg-cove-tint-danger hover:text-cove-danger-deep"
                                                title="Delete PDF"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {message && <p className="text-sm font-bold text-cove-success-deep">{message}</p>}
            {error && <p className="text-sm font-bold text-cove-danger-deep">{error}</p>}

            {showUpload && (
                <UploadDocsDialog
                    classId={classId}
                    onClose={() => setShowUpload(false)}
                    onUploaded={() => {
                        setMessage('Uploaded course PDF(s).');
                        refreshDocuments();
                    }}
                    onAnalyzed={(payload, documentIds, extraInstructions) => {
                        setShowUpload(false);
                        setMessage(null);
                        setPreview({ payload, documentIds, extraInstructions });
                    }}
                />
            )}

            {preview && (
                <ImportPreviewDialog
                    classId={classId}
                    initialPayload={preview.payload}
                    documentIds={preview.documentIds}
                    initialExtraInstructions={preview.extraInstructions}
                    onClose={() => setPreview(null)}
                    onCommitted={onCommitted}
                    onReanalyzed={(payload) =>
                        setPreview((prev) => (prev ? { ...prev, payload } : prev))
                    }
                />
            )}
        </div>
    );
};
