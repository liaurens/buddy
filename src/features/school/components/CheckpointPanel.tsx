import React, { useState } from 'react';
import { X, ChevronDown, ChevronRight, Check } from 'lucide-react';
import type { Assignment, CheckpointItem } from '../../../services/supabase/converters/school';

interface CheckpointPanelProps {
    assignment: Assignment;
    onClose: () => void;
    onSave: (checkpoints: CheckpointItem[]) => Promise<void>;
}

export const CheckpointPanel: React.FC<CheckpointPanelProps> = ({
    assignment,
    onClose,
    onSave,
}) => {
    const [items, setItems] = useState<CheckpointItem[]>(assignment.checkpoints ?? []);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const updateNotes = (id: string, notes: string) => {
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, notes } : item)));
    };

    const toggleDone = (id: string) => {
        setItems((prev) =>
            prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item)),
        );
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(items);
            onClose();
        } finally {
            setSaving(false);
        }
    };

    const doneCount = items.filter((i) => i.done).length;

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-start justify-between p-5 border-b border-cove-border">
                    <div>
                        <h2 className="text-lg font-semibold text-cove-ink">{assignment.title}</h2>
                        <p className="text-sm text-cove-soft mt-0.5">
                            {doneCount}/{items.length} checkpoints klaar
                        </p>
                        {/* Progress bar */}
                        <div className="mt-2 h-1.5 w-48 bg-[color:var(--buddy-surface-soft)] rounded-full overflow-hidden">
                            <div
                                className="h-full bg-cove-accent rounded-full transition-all"
                                style={{
                                    width:
                                        items.length > 0
                                            ? `${(doneCount / items.length) * 100}%`
                                            : '0%',
                                }}
                            />
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-cove-faint hover:text-cove-muted mt-0.5"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Checkpoint list */}
                <div className="overflow-y-auto flex-1 p-4 space-y-2">
                    {items.map((item) => {
                        const expanded = expandedId === item.id;
                        return (
                            <div
                                key={item.id}
                                className={`rounded-xl border transition-colors ${item.done ? 'border-cove-success bg-cove-tint-green/50' : 'border-cove-border bg-white'}`}
                            >
                                {/* Checkpoint header */}
                                <div className="flex items-center gap-3 px-4 py-3">
                                    <button
                                        onClick={() => toggleDone(item.id)}
                                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                            item.done
                                                ? 'border-cove-success bg-cove-success'
                                                : 'border-cove-border hover:border-cove-success'
                                        }`}
                                    >
                                        {item.done && <Check size={12} className="text-white" />}
                                    </button>
                                    <button
                                        onClick={() => setExpandedId(expanded ? null : item.id)}
                                        className="flex-1 flex items-center gap-2 text-left"
                                    >
                                        <div className="flex-1">
                                            <p
                                                className={`text-sm font-bold ${item.done ? 'text-cove-faint line-through' : 'text-cove-ink'}`}
                                            >
                                                {item.title}
                                            </p>
                                            {item.subitems.length > 0 && (
                                                <p className="text-xs text-cove-faint mt-0.5">
                                                    {item.subitems.join(', ')}
                                                </p>
                                            )}
                                            {!expanded && item.notes && (
                                                <p className="text-xs text-cove-soft mt-1 italic truncate">
                                                    {item.notes}
                                                </p>
                                            )}
                                        </div>
                                        {expanded ? (
                                            <ChevronDown
                                                size={16}
                                                className="text-cove-faint flex-shrink-0"
                                            />
                                        ) : (
                                            <ChevronRight
                                                size={16}
                                                className="text-cove-faint flex-shrink-0"
                                            />
                                        )}
                                    </button>
                                </div>

                                {/* Notes area */}
                                {expanded && (
                                    <div className="px-4 pb-3 pt-1 border-t border-cove-border">
                                        <label className="block">
                                            <span className="text-xs font-bold text-cove-soft">
                                                Notities
                                            </span>
                                            <textarea
                                                value={item.notes}
                                                onChange={(e) =>
                                                    updateNotes(item.id, e.target.value)
                                                }
                                                rows={4}
                                                placeholder="Schrijf hier je notities voor dit checkpoint..."
                                                className="mt-1 w-full px-3 py-2 border border-cove-border rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-cove-accent"
                                            />
                                        </label>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="flex gap-2 p-4 border-t border-cove-border">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 rounded-xl text-sm font-bold text-cove-muted hover:bg-[color:var(--buddy-surface-soft)]"
                    >
                        Annuleren
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 px-4 py-2 rounded-xl text-sm font-bold bg-cove-accent text-white hover:bg-[#3a8dc7] disabled:opacity-50"
                    >
                        {saving ? 'Opslaan...' : 'Opslaan'}
                    </button>
                </div>
            </div>
        </div>
    );
};
