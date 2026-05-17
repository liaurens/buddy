import React, { useState } from 'react';
import { FileUp, Loader2, X } from 'lucide-react';
import type { ClassDocumentKind } from '../../../services/supabase/converters/school';
import { useClassDocuments } from '../hooks/useClassDocuments';
import {
    extractFromDocuments,
    type CourseImportPayload,
} from '../services/school-import.service';

interface UploadDocsDialogProps {
    classId: string;
    onClose: () => void;
    onUploaded?: () => void;
    onAnalyzed: (payload: CourseImportPayload, documentIds: string[], extraInstructions: string) => void;
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
        .map(tag => tag.trim())
        .filter(Boolean);
}

export const UploadDocsDialog: React.FC<UploadDocsDialogProps> = ({ classId, onClose, onUploaded, onAnalyzed }) => {
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
            kind: index === 0 && files.length === 0 ? 'cursushandleiding' as ClassDocumentKind : 'other' as ClassDocumentKind,
        }));
        setFiles(prev => [...prev, ...picked]);
        setError(null);
    };

    const updateKind = (id: string, kind: ClassDocumentKind) => {
        setFiles(prev => prev.map(item => item.id === id ? { ...item, kind } : item));
    };

    const removeFile = (id: string) => {
        setFiles(prev => prev.filter(item => item.id !== id));
    };

    const validateFiles = (): boolean => {
        const nonPdf = files.find(item => item.file.type !== 'application/pdf' && !item.file.name.toLowerCase().endsWith('.pdf'));
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
            const documentIds = uploaded.map(doc => doc.id);
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
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <h2 className="text-lg font-semibold text-slate-900">Upload course PDFs</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <label className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 px-4 py-6 text-center cursor-pointer hover:bg-indigo-50">
                        <FileUp size={24} className="text-indigo-600" />
                        <span className="text-sm font-medium text-indigo-700">Choose PDF files</span>
                        <span className="text-xs text-slate-500">Cursushandleiding plus optional extra documents</span>
                        <input
                            type="file"
                            accept="application/pdf,.pdf"
                            multiple
                            onChange={e => addFiles(e.target.files)}
                            className="hidden"
                        />
                    </label>

                    {files.length > 0 && (
                        <ul className="space-y-2">
                            {files.map(item => (
                                <li key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-800 truncate">{item.file.name}</p>
                                        <p className="text-xs text-slate-400">{Math.max(1, Math.round(item.file.size / 1024))} KB</p>
                                    </div>
                                    <select
                                        value={item.kind}
                                        onChange={e => updateKind(item.id, e.target.value as ClassDocumentKind)}
                                        className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                                    >
                                        {Object.entries(KIND_LABELS).map(([value, label]) => (
                                            <option key={value} value={value}>{label}</option>
                                        ))}
                                    </select>
                                    <button onClick={() => removeFile(item.id)} className="p-1.5 text-slate-400 hover:text-red-600">
                                        <X size={16} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    <label className="block">
                        <span className="text-xs font-medium text-slate-600">Folder</span>
                        <input
                            value={folder}
                            onChange={e => setFolder(e.target.value)}
                            placeholder="General"
                            className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        />
                    </label>

                    <label className="block">
                        <span className="text-xs font-medium text-slate-600">Tags</span>
                        <input
                            value={tags}
                            onChange={e => setTags(e.target.value)}
                            placeholder="exam, week 1, slides"
                            className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        />
                    </label>

                    <label className="block">
                        <span className="text-xs font-medium text-slate-600">Notes</span>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={2}
                            placeholder="Why this document matters or where it belongs."
                            className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"
                        />
                    </label>

                    <label className="block">
                        <span className="text-xs font-medium text-slate-600">Extra context</span>
                        <textarea
                            value={extraInstructions}
                            onChange={e => setExtraInstructions(e.target.value)}
                            rows={3}
                            placeholder="Anything the AI should know about this course or date interpretation."
                            className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"
                        />
                    </label>

                    <p className="text-xs text-slate-500">
                        Anthropic usually handles course PDFs best. Other configured providers are supported when their selected model accepts PDF input.
                    </p>

                    {error && <p className="text-sm text-red-600">{error}</p>}
                </div>

                <div className="flex gap-2 p-4 border-t border-slate-100">
                    <button onClick={onClose}
                        className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">
                        Cancel
                    </button>
                    <button
                        onClick={uploadOnly}
                        disabled={busy || files.length === 0}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                    >
                        {busy && <Loader2 size={16} className="animate-spin" />}
                        Upload only
                    </button>
                    <button
                        onClick={analyze}
                        disabled={busy || files.length === 0}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {busy && <Loader2 size={16} className="animate-spin" />}
                        {busy ? 'Working...' : 'Upload + analyze'}
                    </button>
                </div>
            </div>
        </div>
    );
};
