import React, { useState } from 'react';
import { Inbox, Settings, ChevronDown, ChevronRight } from 'lucide-react';
import { QuickNoteInput } from '../features/smartnotes/QuickNoteInput';
import { SmartNotesList } from '../features/smartnotes/SmartNotesList';
import { CategoryManager } from '../features/smartnotes/CategoryManager';
import { useSmartNotes } from '../context/SmartNotesContext';

type ViewMode = 'inbox' | 'category' | 'all' | 'settings';

const SmartNotesPage: React.FC = () => {
    const { categories, notes } = useSmartNotes();
    const [viewMode, setViewMode] = useState<ViewMode>('inbox');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

    const inboxCount = notes.filter(n => !n.categoryId && !n.processed).length;

    const toggleCategory = (categoryId: string) => {
        const newExpanded = new Set(expandedCategories);
        if (newExpanded.has(categoryId)) {
            newExpanded.delete(categoryId);
        } else {
            newExpanded.add(categoryId);
        }
        setExpandedCategories(newExpanded);
    };

    const getNotesCount = (categoryId: string | null, processedOnly = false) => {
        return notes.filter(n => {
            const matchesCategory = categoryId === null ? !n.categoryId : n.categoryId === categoryId;
            if (processedOnly) return matchesCategory && !n.processed;
            return matchesCategory;
        }).length;
    };

    return (
        <div className="min-h-screen bg-slate-900 p-4 pb-24">
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-white">Quick Notes</h1>
                    <button
                        onClick={() => setViewMode(viewMode === 'settings' ? 'inbox' : 'settings')}
                        className={`p-2 rounded-lg transition-colors ${
                            viewMode === 'settings'
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                </div>

                {/* Quick Input */}
                <div className="mb-8">
                    <QuickNoteInput autoFocus />
                    <p className="text-xs text-slate-500 mt-2">
                        Use <code className="bg-slate-800 px-1 rounded">-flag</code> to auto-sort.
                        Example: "Buy milk -boodschap"
                    </p>
                </div>

                {viewMode === 'settings' ? (
                    <CategoryManager />
                ) : (
                    <>
                        {/* Navigation Tabs */}
                        <div className="flex gap-2 border-b border-slate-700 pb-2">
                            <button
                                onClick={() => {
                                    setViewMode('inbox');
                                    setSelectedCategoryId(null);
                                }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                                    viewMode === 'inbox'
                                        ? 'bg-slate-800 text-white border-b-2 border-indigo-500'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                <Inbox className="w-4 h-4" />
                                Inbox
                                {inboxCount > 0 && (
                                    <span className="bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                                        {inboxCount}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setViewMode('all')}
                                className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                                    viewMode === 'all'
                                        ? 'bg-slate-800 text-white border-b-2 border-indigo-500'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                All Notes
                            </button>
                        </div>

                        {/* Content */}
                        {viewMode === 'inbox' && (
                            <div>
                                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <Inbox className="w-5 h-5 text-amber-400" />
                                    Inbox
                                    <span className="text-sm font-normal text-slate-400">
                                        (unsorted notes)
                                    </span>
                                </h2>
                                <SmartNotesList categoryId={null} showCategoryBadge={false} />
                            </div>
                        )}

                        {viewMode === 'all' && (
                            <div className="space-y-4">
                                {/* Inbox Section */}
                                <div className="bg-slate-800 rounded-lg overflow-hidden">
                                    <button
                                        onClick={() => toggleCategory('inbox')}
                                        className="w-full flex items-center justify-between p-3 hover:bg-slate-700 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            {expandedCategories.has('inbox') ? (
                                                <ChevronDown className="w-4 h-4 text-slate-400" />
                                            ) : (
                                                <ChevronRight className="w-4 h-4 text-slate-400" />
                                            )}
                                            <Inbox className="w-5 h-5 text-amber-400" />
                                            <span className="font-medium text-white">Inbox</span>
                                        </div>
                                        <span className="text-sm text-slate-400">
                                            {getNotesCount(null)} notes
                                        </span>
                                    </button>
                                    {expandedCategories.has('inbox') && (
                                        <div className="p-3 pt-0 border-t border-slate-700">
                                            <SmartNotesList categoryId={null} showCategoryBadge={false} />
                                        </div>
                                    )}
                                </div>

                                {/* Category Sections */}
                                {categories.map(category => (
                                    <div key={category.id} className="bg-slate-800 rounded-lg overflow-hidden">
                                        <button
                                            onClick={() => toggleCategory(category.id)}
                                            className="w-full flex items-center justify-between p-3 hover:bg-slate-700 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                {expandedCategories.has(category.id) ? (
                                                    <ChevronDown className="w-4 h-4 text-slate-400" />
                                                ) : (
                                                    <ChevronRight className="w-4 h-4 text-slate-400" />
                                                )}
                                                <span
                                                    className="w-8 h-8 rounded flex items-center justify-center text-lg"
                                                    style={{ backgroundColor: category.color || '#6366f1' }}
                                                >
                                                    {category.emoji}
                                                </span>
                                                <span className="font-medium text-white">{category.name}</span>
                                                <span className="text-xs text-slate-500">-{category.flag}</span>
                                            </div>
                                            <span className="text-sm text-slate-400">
                                                {getNotesCount(category.id)} notes
                                            </span>
                                        </button>
                                        {expandedCategories.has(category.id) && (
                                            <div className="p-3 pt-0 border-t border-slate-700">
                                                <SmartNotesList categoryId={category.id} showCategoryBadge={false} />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {viewMode === 'category' && selectedCategoryId && (
                            <div>
                                {(() => {
                                    const category = categories.find(c => c.id === selectedCategoryId);
                                    if (!category) return null;
                                    return (
                                        <>
                                            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                                <span
                                                    className="w-8 h-8 rounded flex items-center justify-center text-lg"
                                                    style={{ backgroundColor: category.color || '#6366f1' }}
                                                >
                                                    {category.emoji}
                                                </span>
                                                {category.name}
                                            </h2>
                                            <SmartNotesList categoryId={selectedCategoryId} showCategoryBadge={false} />
                                        </>
                                    );
                                })()}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default SmartNotesPage;
