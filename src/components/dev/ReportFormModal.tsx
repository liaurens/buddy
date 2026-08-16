import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { saveFeedback } from '../../services/supabase/operations/site-feedback';

interface ReportFormModalProps {
    html: string;
    selector: string | null;
    onClose: () => void;
    onSuccess?: () => void;
}

export function ReportFormModal({ html, selector, onClose, onSuccess }: ReportFormModalProps) {
    const [description, setDescription] = useState('');
    const [type, setType] = useState<'bug' | 'feature' | 'note'>('bug');
    const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!description.trim()) return;

        setStatus('submitting');
        try {
            await saveFeedback({
                type,
                description,
                html_snippet: html,
                selector: selector || '',
                pathname: window.location.pathname,
            });

            setStatus('success');
            setTimeout(() => {
                onSuccess?.();
                onClose();
            }, 1500);
        } catch (err) {
            console.error(err);
            setStatus('error');
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 dev-portal-ui">
            <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-cove-border bg-[color:var(--buddy-surface-soft)]">
                    <h2 className="text-xl font-semibold text-cove-ink">Add Feedback or Note</h2>
                    <button
                        onClick={onClose}
                        className="p-1 text-cove-faint hover:text-cove-muted rounded-full hover:bg-cove-track transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="p-6 overflow-y-auto space-y-6">
                        {/* Type Selection */}
                        <div>
                            <label className="block text-sm font-bold text-cove-muted mb-2">
                                Category
                            </label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        checked={type === 'bug'}
                                        onChange={() => setType('bug')}
                                        className="text-cove-accent focus:ring-cove-accent"
                                    />
                                    <span className="text-sm text-cove-muted">Bug</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        checked={type === 'feature'}
                                        onChange={() => setType('feature')}
                                        className="text-cove-accent focus:ring-cove-accent"
                                    />
                                    <span className="text-sm text-cove-muted">Change Request</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        checked={type === 'note'}
                                        onChange={() => setType('note')}
                                        className="text-cove-accent focus:ring-cove-accent"
                                    />
                                    <span className="text-sm text-cove-muted">
                                        Spatial Sticky Note
                                    </span>
                                </label>
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-bold text-cove-muted mb-2">
                                Details / Note Content
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder={
                                    type === 'note'
                                        ? 'Write a sticky note to attach to this element...'
                                        : 'What needs to be fixed or changed here?'
                                }
                                rows={4}
                                className="w-full rounded-xl border-cove-border shadow-cove focus:border-cove-accent focus:ring-cove-accent p-3 border resize-none outline-none focus:ring-2"
                                required
                                autoFocus
                            />
                        </div>

                        {/* Code Snippet Preview */}
                        <div>
                            <label className="block text-sm font-bold text-cove-muted mb-2">
                                Selected Element
                            </label>
                            {selector && (
                                <div className="mb-2 text-xs font-mono bg-cove-tint-blue text-cove-ink p-2 rounded border border-cove-accent-pale">
                                    Selector: {selector}
                                </div>
                            )}
                            <div className="bg-cove-ink rounded-xl p-4 overflow-x-auto">
                                <pre className="text-xs text-cove-faint font-mono">
                                    <code>{html}</code>
                                </pre>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-cove-border px-6 py-4 bg-[color:var(--buddy-surface-soft)] flex justify-end gap-3 mt-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-bold text-cove-muted bg-white border border-cove-border rounded-xl shadow-cove hover:bg-[color:var(--buddy-surface-soft)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cove-accent"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={
                                status === 'submitting' ||
                                status === 'success' ||
                                !description.trim()
                            }
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold text-white border border-transparent rounded-xl shadow-cove focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${type === 'note' ? 'bg-cove-streak hover:bg-cove-streak-deep focus:ring-cove-streak' : 'bg-cove-accent hover:bg-[#3a8dc7] focus:ring-cove-accent'}`}
                        >
                            {status === 'submitting' ? (
                                'Saving...'
                            ) : status === 'success' ? (
                                <>
                                    <Check size={16} /> Saved
                                </>
                            ) : type === 'note' ? (
                                'Stick Note'
                            ) : (
                                'Submit Report'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
