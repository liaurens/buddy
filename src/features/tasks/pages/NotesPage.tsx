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

    const inboxCount = notes.filter((n) => !n.categoryId && !n.processed).length;

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
        return notes.filter((n) => {
            const matchesCategory =
                categoryId === null ? !n.categoryId : n.categoryId === categoryId;
            if (processedOnly) return matchesCategory && !n.processed;
            return matchesCategory;
        }).length;
    };

    return (
        <div className="app-page-readable">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="px-1 pb-1 pt-1.5 text-[22px] font-black text-cove-ink">
                        Quick Notes
                    </div>
                    <div className="px-1 pb-4 text-[13.5px] font-semibold text-cove-muted">
                        Capture and sort ideas without clutter.
                    </div>
                </div>
                <div className="mt-1.5 flex shrink-0 gap-2">
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
            <NoteSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

            {/* Quick Input */}
            <div className="mb-8">
                <QuickNoteInput autoFocus />
                <p className="mt-2 px-1 text-xs font-semibold text-cove-soft">
                    Use{' '}
                    <code className="rounded bg-[#eef6fa] px-1 font-bold text-cove-muted">
                        -flag
                    </code>{' '}
                    to auto-sort. Example: "Buy milk -boodschap"
                </p>
            </div>

            {viewMode === 'settings' ? (
                <CategoryManager />
            ) : isLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                        <div
                            key={i}
                            className="h-24 animate-pulse rounded-[16px] bg-cove-track/50"
                        />
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
                                viewMode === 'inbox' ? 'app-segment-active' : ''
                            }`}
                        >
                            <Inbox className="w-4 h-4" />
                            Inbox
                            {inboxCount > 0 && (
                                <span className="rounded-full bg-cove-streak px-1.5 py-0.5 text-[11px] font-extrabold text-white">
                                    {inboxCount}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setViewMode('all')}
                            className={`app-segment ${
                                viewMode === 'all' ? 'app-segment-active' : ''
                            }`}
                        >
                            All Notes
                        </button>
                        <button
                            onClick={() => setViewMode('project')}
                            className={`app-segment ${
                                viewMode === 'project' ? 'app-segment-active' : ''
                            }`}
                        >
                            <FileText className="w-4 h-4" />
                            Project doc
                        </button>
                    </div>

                    {/* Content */}
                    {viewMode === 'inbox' && (
                        <div>
                            <h2 className="mb-4 flex items-center gap-2 px-1 text-[15px] font-extrabold text-cove-ink">
                                <Inbox className="w-5 h-5 text-cove-streak-deep" />
                                Inbox
                                <span className="text-[12.5px] font-semibold text-cove-soft">
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
                                    className="w-full flex items-center justify-between p-3 hover:bg-[#f3f9fc] transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        {expandedCategories.has('inbox') ? (
                                            <ChevronDown className="w-4 h-4 text-cove-soft" />
                                        ) : (
                                            <ChevronRight className="w-4 h-4 text-cove-soft" />
                                        )}
                                        <Inbox className="w-5 h-5 text-cove-streak-deep" />
                                        <span className="font-bold text-cove-ink">Inbox</span>
                                    </div>
                                    <span className="text-[12.5px] font-semibold text-cove-soft">
                                        {getNotesCount(null)} notes
                                    </span>
                                </button>
                                {expandedCategories.has('inbox') && (
                                    <div className="p-3 pt-0 border-t border-cove-border/60">
                                        <SmartNotesList
                                            categoryId={null}
                                            showCategoryBadge={false}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Category Sections */}
                            {categories.map((category) => (
                                <div key={category.id} className="app-surface overflow-hidden">
                                    <button
                                        onClick={() => toggleCategory(category.id)}
                                        className="w-full flex items-center justify-between p-3 hover:bg-[#f3f9fc] transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            {expandedCategories.has(category.id) ? (
                                                <ChevronDown className="w-4 h-4 text-cove-soft" />
                                            ) : (
                                                <ChevronRight className="w-4 h-4 text-cove-soft" />
                                            )}
                                            <span
                                                className="w-8 h-8 rounded-[10px] flex items-center justify-center text-lg"
                                                style={{
                                                    backgroundColor: category.color || '#4d9fd6',
                                                }}
                                            >
                                                {category.emoji}
                                            </span>
                                            <span className="font-bold text-cove-ink">
                                                {category.name}
                                            </span>
                                            <span className="text-[11.5px] font-bold text-cove-faint">
                                                -{category.flag}
                                            </span>
                                        </div>
                                        <span className="text-[12.5px] font-semibold text-cove-soft">
                                            {getNotesCount(category.id)} notes
                                        </span>
                                    </button>
                                    {expandedCategories.has(category.id) && (
                                        <div className="p-3 pt-0 border-t border-cove-border/60">
                                            <SmartNotesList
                                                categoryId={category.id}
                                                showCategoryBadge={false}
                                            />
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
                                const category = categories.find(
                                    (c) => c.id === selectedCategoryId,
                                );
                                if (!category) return null;
                                return (
                                    <>
                                        <h2 className="mb-4 flex items-center gap-2 px-1 text-[15px] font-extrabold text-cove-ink">
                                            <span
                                                className="w-8 h-8 rounded-[10px] flex items-center justify-center text-lg"
                                                style={{
                                                    backgroundColor: category.color || '#4d9fd6',
                                                }}
                                            >
                                                {category.emoji}
                                            </span>
                                            {category.name}
                                        </h2>
                                        <SmartNotesList
                                            categoryId={selectedCategoryId}
                                            showCategoryBadge={false}
                                        />
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
