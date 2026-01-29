import React, { useState } from 'react';
import type { Checklist } from '../types';
import { useChecklists } from '../hooks/useChecklists';
import { ChecklistItem } from './ChecklistItem';

interface ChecklistDetailProps {
    checklist: Checklist;
    onBack: () => void;
}

export const ChecklistDetail: React.FC<ChecklistDetailProps> = ({ checklist, onBack }) => {
    const { toggleItem, addItem, deleteItem, resetChecklist, deleteChecklist, updateChecklist } = useChecklists();
    const [newItemText, setNewItemText] = useState('');
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editName, setEditName] = useState(checklist.name);

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemText.trim()) return;
        await addItem(checklist, newItemText);
        setNewItemText('');
    };

    const handleUpdateTitle = async () => {
        if (editName.trim() !== checklist.name) {
            await updateChecklist({ ...checklist, name: editName });
        }
        setIsEditingTitle(false);
    };

    const sortedItems = [...checklist.items].sort((a, b) => {
        if (a.isChecked === b.isChecked) return 0;
        return a.isChecked ? 1 : -1;
    });

    return (
        <div className="space-y-6 animate-fadeIn">
            <button
                onClick={onBack}
                className="flex items-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
                Back to Checklists
            </button>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <span className="text-5xl">{checklist.emoji}</span>
                        <div>
                            {isEditingTitle ? (
                                <input
                                    autoFocus
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    onBlur={handleUpdateTitle}
                                    onKeyDown={(e) => e.key === 'Enter' && handleUpdateTitle()}
                                    className="text-2xl font-bold bg-transparent border-b-2 border-blue-500 focus:outline-none text-gray-900 dark:text-white w-full"
                                />
                            ) : (
                                <h1
                                    className="text-3xl font-bold text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 transition-colors"
                                    onClick={() => setIsEditingTitle(true)}
                                    title="Click to edit name"
                                >
                                    {checklist.name}
                                </h1>
                            )}
                            <p className="text-gray-500">{checklist.items.length} items</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => resetChecklist(checklist)}
                            className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                            </svg>
                            Reset
                        </button>
                        <button
                            onClick={() => {
                                if (window.confirm('Are you sure you want to delete this checklist?')) {
                                    deleteChecklist(checklist.id);
                                    onBack();
                                }
                            }}
                            className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="space-y-3 mb-6">
                    {sortedItems.map(item => (
                        <ChecklistItem
                            key={item.id}
                            item={item}
                            onToggle={() => toggleItem(checklist, item.id)}
                            onDelete={() => deleteItem(checklist, item.id)}
                        />
                    ))}

                    {checklist.items.length === 0 && (
                        <div className="text-center py-10 text-gray-500 bg-gray-50 dark:bg-gray-700/30 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-600">
                            <p>No items yet. Add one below!</p>
                        </div>
                    )}
                </div>

                <form onSubmit={handleAddItem} className="relative">
                    <input
                        type="text"
                        placeholder="Add a new item..."
                        value={newItemText}
                        onChange={(e) => setNewItemText(e.target.value)}
                        className="w-full pl-4 pr-12 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    />
                    <button
                        type="submit"
                        disabled={!newItemText.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-blue-500 text-white rounded-md disabled:opacity-50 hover:bg-blue-600 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                    </button>
                </form>
            </div>
        </div>
    );
};
