import React, { useState } from 'react';
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
        <div className="max-w-4xl mx-auto p-6 space-y-8 animate-fadeIn pb-24">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                        Checklists
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-2 text-lg">
                        Smart lists that reset and grow with you.
                    </p>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg hover:shadow-blue-500/30 transition-all transform hover:-translate-y-0.5"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    New Checklist
                </button>
            </header>

            {isCreating && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-blue-100 dark:border-blue-900 animate-slideIn">
                    <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Create New Checklist</h3>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="flex gap-4">
                            <div className="w-16">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Icon</label>
                                <input
                                    type="text"
                                    value={newEmoji}
                                    onChange={e => setNewEmoji(e.target.value)}
                                    className="w-full text-center text-2xl p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    placeholder="e.g. Packing List, Weekly Review..."
                                    className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setIsCreating(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!newName.trim()}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                        <div key={i} className="h-40 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
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
                        <div className="col-span-full text-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                            <span className="text-6xl block mb-4">📝</span>
                            <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">No checklists yet</h3>
                            <p className="text-gray-500 dark:text-gray-400 mb-6">Create your first checklist to get started!</p>
                            <button
                                onClick={() => setIsCreating(true)}
                                className="text-blue-600 font-medium hover:underline"
                            >
                                Create one now &rarr;
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
