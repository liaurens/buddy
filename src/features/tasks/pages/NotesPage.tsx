import React, { useState } from 'react';
import { Inbox, Settings, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { QuickNoteInput } from '../components/notes/QuickNoteInput';
import { SmartNotesList } from '../components/notes/SmartNotesList';
import { CategoryManager } from '../components/notes/CategoryManager';
import ProjectDocView from '../components/notes/ProjectDocView';
import NoteSettingsModal from '../components/notes/NoteSettingsModal';
import { useNotes as useSmartNotes } from '../hooks/useNotes';

type ViewMode = 'inbox' | 'category' | 'all' | 'project' | 'settings';

const SmartNotesPage: React.FC = () => {
    const { categories, notes, isLoading } = useSmartNotes();
    const [viewMode, setViewMode] = useState<ViewMode>('inbox');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
        <div className="app-page-readable">
                {/* Header */}
                <div className="flex items-center justify-end lg:justify-between">
                    <div className="hidden lg:block">
                        <h1 className="app-title">Quick Notes</h1>
                        <p className="app-subtitle">Capture and sort ideas without clutter.</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="app-icon-button"
                            title="Settings"
                        >
                            <Settings className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Settings Modal */}
                <NoteSettingsModal
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                />

                {/* Quick Input */}
                <div className="mb-8">
                    <QuickNoteInput autoFocus />
                    <p className="text-xs text-slate-500 mt-2">
                        Use <code className="bg-slate-100 px-1 rounded">-flag</code> to auto-sort.
                        Example: "Buy milk -boodschap"
                    </p>
                </div>

                {viewMode === 'settings' ? (
                    <CategoryManager />
                ) : isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="bg-slate-100 h-24 rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <>
                        {/* Navigation Tabs */}
                        <div className="app-segmented">
                            <button
                                onClick={() => {
                                    setViewMode('inbox');
                                    setSelectedCategoryId(null);
                                }}
                                className={`app-segment ${
                                    viewMode === 'inbox'
                                        ? 'app-segment-active'
                                        : ''
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
                                className={`app-segment ${
                                    viewMode === 'all'
                                        ? 'app-segment-active'
                                        : ''
                                }`}
                            >
                                All Notes
                            </button>
                            <button
                                onClick={() => setViewMode('project')}
                                className={`app-segment ${
                                    viewMode === 'project'
                                        ? 'app-segment-active'
                                        : ''
                                }`}
                            >
                                <FileText className="w-4 h-4" />
                                Project doc
                            </button>
                        </div>

                        {/* Content */}
                        {viewMode === 'inbox' && (
                            <div>
                                <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                    <Inbox className="w-5 h-5 text-amber-600" />
                                    Inbox
                                    <span className="text-sm font-normal text-slate-500">
                                        (unsorted notes)
                                    </span>
                                </h2>
                                <SmartNotesList categoryId={null} showCategoryBadge={false} />
                            </div>
                        )}

                        {viewMode === 'all' && (
                            <div className="space-y-4">
                                {/* Inbox Section */}
                                <div className="app-surface overflow-hidden">
                                    <button
                                        onClick={() => toggleCategory('inbox')}
                                        className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            {expandedCategories.has('inbox') ? (
                                                <ChevronDown className="w-4 h-4 text-slate-600" />
                                            ) : (
                                                <ChevronRight className="w-4 h-4 text-slate-600" />
                                            )}
                                            <Inbox className="w-5 h-5 text-amber-600" />
                                            <span className="font-medium text-slate-800">Inbox</span>
                                        </div>
                                        <span className="text-sm text-slate-500">
                                            {getNotesCount(null)} notes
                                        </span>
                                    </button>
                                    {expandedCategories.has('inbox') && (
                                        <div className="p-3 pt-0 border-t border-slate-100">
                                            <SmartNotesList categoryId={null} showCategoryBadge={false} />
                                        </div>
                                    )}
                                </div>

                                {/* Category Sections */}
                                {categories.map(category => (
                                    <div key={category.id} className="app-surface overflow-hidden">
                                        <button
                                            onClick={() => toggleCategory(category.id)}
                                            className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                {expandedCategories.has(category.id) ? (
                                                    <ChevronDown className="w-4 h-4 text-slate-600" />
                                                ) : (
                                                    <ChevronRight className="w-4 h-4 text-slate-600" />
                                                )}
                                                <span
                                                    className="w-8 h-8 rounded flex items-center justify-center text-lg"
                                                    style={{ backgroundColor: category.color || '#6366f1' }}
                                                >
                                                    {category.emoji}
                                                </span>
                                                <span className="font-medium text-slate-800">{category.name}</span>
                                                <span className="text-xs text-slate-500">-{category.flag}</span>
                                            </div>
                                            <span className="text-sm text-slate-500">
                                                {getNotesCount(category.id)} notes
                                            </span>
                                        </button>
                                        {expandedCategories.has(category.id) && (
                                            <div className="p-3 pt-0 border-t border-slate-100">
                                                <SmartNotesList categoryId={category.id} showCategoryBadge={false} />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {viewMode === 'project' && <ProjectDocView />}

                        {viewMode === 'category' && selectedCategoryId && (
                            <div>
                                {(() => {
                                    const category = categories.find(c => c.id === selectedCategoryId);
                                    if (!category) return null;
                                    return (
                                        <>
                                            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
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
    );
};

export default SmartNotesPage;
