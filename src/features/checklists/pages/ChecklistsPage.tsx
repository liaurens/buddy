import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useChecklists } from '../hooks/useChecklists';
import { ChecklistCard } from '../components/ChecklistCard';
import { ChecklistDetail } from '../components/ChecklistDetail';
import type { Checklist } from '../types';

export const ChecklistsPage: React.FC = () => {
    const { checklists, isLoading, createChecklist } = useChecklists();
    const [selectedChecklist, setSelectedChecklist] = useState<Checklist | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    // New Checklist Form State
    const [newName, setNewName] = useState('');
    const [newEmoji, setNewEmoji] = useState('📝');

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;

        const newChecklist = await createChecklist({
            name: newName,
            emoji: newEmoji,
            items: [],
            isPinned: false
        });

        setIsCreating(false);
        setNewName('');
        setNewEmoji('📝');
        setSelectedChecklist(newChecklist);
    };

    if (selectedChecklist) {
        // Find the fresh version so updates propagate
        const freshChecklist = checklists.find(c => c.id === selectedChecklist.id) || selectedChecklist;
        return <ChecklistDetail checklist={freshChecklist} onBack={() => setSelectedChecklist(null)} />;
    }

    return (
        <div className="app-page animate-fadeIn">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="app-title">Checklists</h1>
                    <p className="app-subtitle">Smart lists that reset and grow with you.</p>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    className="app-primary-button self-start md:self-auto"
                >
                    <Plus size={18} />
                    New Checklist
                </button>
            </header>

            {isCreating && (
                <div className="app-surface p-5 animate-slideIn">
                    <h3 className="mb-4 text-lg font-semibold text-slate-900">Create new checklist</h3>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="flex gap-4">
                            <div className="w-16">
                                <label className="mb-1 block text-sm font-medium text-slate-700">Icon</label>
                                <input
                                    type="text"
                                    value={newEmoji}
                                    onChange={e => setNewEmoji(e.target.value)}
                                    className="w-full rounded-lg border border-slate-200 bg-white p-2 text-center text-2xl"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    placeholder="e.g. Packing List, Weekly Review..."
                                    className="w-full rounded-lg border border-slate-200 bg-white p-2.5 outline-none focus:ring-2 focus:ring-indigo-100"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setIsCreating(false)}
                                className="app-secondary-button"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!newName.trim()}
                                className="app-primary-button"
                            >
                                Create
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-40 animate-pulse rounded-xl bg-slate-100" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {checklists.map(checklist => (
                        <ChecklistCard
                            key={checklist.id}
                            checklist={checklist}
                            onClick={() => setSelectedChecklist(checklist)}
                        />
                    ))}

                    {checklists.length === 0 && !isCreating && (
                        <div className="col-span-full rounded-xl border border-dashed border-slate-200 bg-slate-50 py-20 text-center">
                            <span className="text-6xl block mb-4">📝</span>
                            <h3 className="mb-2 text-xl font-medium text-slate-900">No checklists yet</h3>
                            <p className="mb-6 text-slate-500">Create your first checklist to get started.</p>
                            <button
                                onClick={() => setIsCreating(true)}
                                className="text-sm font-medium text-indigo-700 hover:underline"
                            >
                                Create one now
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
