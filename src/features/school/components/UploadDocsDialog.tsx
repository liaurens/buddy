import React, { useState } from 'react';
import { FileUp, Loader2, X } from 'lucide-react';
import type { ClassDocumentKind } from '../../../services/supabase/converters/school';
import { useClassDocuments } from '../hooks/useClassDocuments';
import { extractFromDocuments, type CourseImportPayload } from '../services/school-import.service';

interface UploadDocsDialogProps {
    classId: string;
    onClose: () => void;
    onUploaded?: () => void;
    onAnalyzed: (
        payload: CourseImportPayload,
        documentIds: string[],
        extraInstructions: string,
    ) => void;
}

interface PickedFile {
    id: string;
    file: File;
    kind: ClassDocumentKind;
}

const KIND_LABELS: Record<ClassDocumentKind, string> = {
    cursushandleiding: 'Cursushandleiding',
    instructions: 'Instructions',
    other: 'Other',
};

function parseTags(value: string): string[] {
    return value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
}

export const UploadDocsDialog: React.FC<UploadDocsDialogProps> = ({
    classId,
    onClose,
    onUploaded,
    onAnalyzed,
}) => {
    const { uploadDocument, refreshDocuments } = useClassDocuments(classId);
    const [files, setFiles] = useState<PickedFile[]>([]);
    const [folder, setFolder] = useState('General');
    const [tags, setTags] = useState('');
    const [notes, setNotes] = useState('');
    const [extraInstructions, setExtraInstructions] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const addFiles = (list: FileList | null) => {
        if (!list) return;
        const picked = Array.from(list).map((file, index) => ({
            id: crypto.randomUUID(),
            file,
            kind:
                index === 0 && files.length === 0
                    ? ('cursushandleiding' as ClassDocumentKind)
                    : ('other' as ClassDocumentKind),
        }));
        setFiles((prev) => [...prev, ...picked]);
        setError(null);
    };

    const updateKind = (id: string, kind: ClassDocumentKind) => {
        setFiles((prev) => prev.map((item) => (item.id === id ? { ...item, kind } : item)));
    };

    const removeFile = (id: string) => {
        setFiles((prev) => prev.filter((item) => item.id !== id));
    };

    const validateFiles = (): boolean => {
        const nonPdf = files.find(
            (item) =>
                item.file.type !== 'application/pdf' &&
                !item.file.name.toLowerCase().endsWith('.pdf'),
        );
        if (nonPdf) {
            setError(`Only PDF files are supported: ${nonPdf.file.name}`);
            return false;
        }
        return true;
    };

    const uploadAll = async () => {
        const uploaded = [];
        const metadata = {
            folder,
            tags: parseTags(tags),
            notes,
        };
        for (const item of files) {
            uploaded.push(await uploadDocument(item.file, item.kind, metadata));
        }
        refreshDocuments();
        return uploaded;
    };

    const uploadOnly = async () => {
        if (!validateFiles()) return;
        setBusy(true);
        setError(null);
        try {
            await uploadAll();
            onUploaded?.();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    };

    const analyze = async () => {
        if (!validateFiles()) return;
        setBusy(true);
        setError(null);
        try {
            const uploaded = await uploadAll();
            const documentIds = uploaded.map((doc) => doc.id);
            const payload = await extractFromDocuments(classId, documentIds, extraInstructions);
            refreshDocuments();
            onAnalyzed(payload, documentIds, extraInstructions);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
            <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-5 border-b border-cove-border">
                    <h2 className="text-lg font-semibold text-cove-ink">Upload course PDFs</h2>
                    <button onClick={onClose} className="text-cove-faint hover:text-cove-muted">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <label className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-cove-accent-pale bg-cove-tint-blue/40 px-4 py-6 text-center cursor-pointer hover:bg-cove-tint-blue">
                        <FileUp size={24} className="text-cove-accent" />
                        <span className="text-sm font-bold text-cove-ink">Choose PDF files</span>
                        <span className="text-xs text-cove-soft">
                            Cursushandleiding plus optional extra documents
                        </span>
                        <input
                            type="file"
                            accept="application/pdf,.pdf"
                            multiple
                            onChange={(e) => addFiles(e.target.files)}
                            className="hidden"
                        />
                    </label>

                    {files.length > 0 && (
                        <ul className="space-y-2">
                            {files.map((item) => (
                                <li
                                    key={item.id}
                                    className="flex items-center gap-2 rounded-xl border border-cove-border p-2"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-cove-ink truncate">
                                            {item.file.name}
                                        </p>
                                        <p className="text-xs text-cove-faint">
                                            {Math.max(1, Math.round(item.file.size / 1024))} KB
                                        </p>
                                    </div>
                                    <select
                                        value={item.kind}
                                        onChange={(e) =>
                                            updateKind(item.id, e.target.value as ClassDocumentKind)
                                        }
                                        className="px-2 py-1.5 rounded-xl border border-cove-border text-xs bg-white"
                                    >
                                        {Object.entries(KIND_LABELS).map(([value, label]) => (
                                            <option key={value} value={value}>
                                                {label}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => removeFile(item.id)}
                                        className="p-1.5 text-cove-faint hover:text-cove-danger-deep"
                                    >
                                        <X size={16} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    <label className="block">
                        <span className="text-xs font-bold text-cove-muted">Folder</span>
                        <input
                            value={folder}
                            onChange={(e) => setFolder(e.target.value)}
                            placeholder="General"
                            className="app-input mt-1"
                        />
                    </label>

                    <label className="block">
                        <span className="text-xs font-bold text-cove-muted">Tags</span>
                        <input
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            placeholder="exam, week 1, slides"
                            className="app-input mt-1"
                        />
                    </label>

                    <label className="block">
                        <span className="text-xs font-bold text-cove-muted">Notes</span>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            placeholder="Why this document matters or where it belongs."
                            className="app-textarea mt-1 resize-none"
                        />
                    </label>

                    <label className="block">
                        <span className="text-xs font-bold text-cove-muted">Extra context</span>
                        <textarea
                            value={extraInstructions}
                            onChange={(e) => setExtraInstructions(e.target.value)}
                            rows={3}
                            placeholder="Anything the AI should know about this course or date interpretation."
                            className="app-textarea mt-1 resize-none"
                        />
                    </label>

                    <p className="text-xs text-cove-soft">
                        Anthropic usually handles course PDFs best. Other configured providers are
                        supported when their selected model accepts PDF input.
                    </p>

                    {error && <p className="text-sm text-cove-danger-deep">{error}</p>}
                </div>

                <div className="flex gap-2 p-4 border-t border-cove-border">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 rounded-xl text-sm font-bold text-cove-muted hover:bg-[color:var(--buddy-surface-soft)]"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={uploadOnly}
                        disabled={busy || files.length === 0}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-cove-accent-pale text-cove-ink hover:bg-cove-tint-blue disabled:opacity-50"
                    >
                        {busy && <Loader2 size={16} className="animate-spin" />}
                        Upload only
                    </button>
                    <button
                        onClick={analyze}
                        disabled={busy || files.length === 0}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-cove-accent text-white hover:bg-[#3a8dc7] disabled:opacity-50"
                    >
                        {busy && <Loader2 size={16} className="animate-spin" />}
                        {busy ? 'Working...' : 'Upload + analyze'}
                    </button>
                </div>
            </div>
        </div>
    );
};
