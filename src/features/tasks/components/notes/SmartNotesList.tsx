import React, { useState } from 'react';
import { Trash2, Check, MoveRight, Inbox, Edit2, X, Save, ListChecks } from 'lucide-react';
import { useNotes as useSmartNotes } from '../../hooks/useNotes';
import type { SmartNote, NoteCategory } from '../../types';

interface SmartNotesListProps {
    categoryId?: string | null; // null = inbox, undefined = all notes
    showCategoryBadge?: boolean;
}

export const SmartNotesList: React.FC<SmartNotesListProps> = ({
    categoryId,
    showCategoryBadge = true,
}) => {
    const {
        notes,
        categories,
        deleteNote,
        markProcessed,
        moveToCategory,
        updateNote,
        convertNoteToTask,
    } = useSmartNotes();
    const todoCategory = categories.find((c) => c.flag === 'todo');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [movingId, setMovingId] = useState<string | null>(null);

    // Filter notes based on categoryId
    const filteredNotes = notes.filter((note) => {
        if (categoryId === undefined) return true; // Show all
        if (categoryId === null) return !note.categoryId; // Show inbox (no category)
        return note.categoryId === categoryId;
    });

    const getCategoryById = (id?: string): NoteCategory | undefined => {
        return categories.find((c) => c.id === id);
    };

    const handleEdit = (note: SmartNote) => {
        setEditingId(note.id);
        setEditContent(note.content);
    };

    const handleSaveEdit = async (note: SmartNote) => {
        if (!editContent.trim()) return;
        await updateNote({ ...note, content: editContent.trim() });
        setEditingId(null);
        setEditContent('');
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditContent('');
    };

    const handleMoveToCategory = async (noteId: string, newCategoryId: string | null) => {
        await moveToCategory(noteId, newCategoryId);
        setMovingId(null);
    };

    if (filteredNotes.length === 0) {
        return (
            <div className="text-center py-8 text-slate-500">
                <Inbox className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No notes here</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {filteredNotes.map((note) => {
                const category = getCategoryById(note.categoryId);
                const isEditing = editingId === note.id;
                const isMoving = movingId === note.id;

                return (
                    <div
                        key={note.id}
                        className={`bg-white rounded-lg p-3 border shadow-sm transition-colors ${
                            note.processed ? 'border-slate-200 opacity-60' : 'border-slate-200'
                        }`}
                    >
                        {isEditing ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    className="flex-1 bg-white border border-slate-200 text-slate-800 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveEdit(note);
                                        if (e.key === 'Escape') handleCancelEdit();
                                    }}
                                />
                                <button
                                    onClick={() => handleSaveEdit(note)}
                                    className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                                >
                                    <Save className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={handleCancelEdit}
                                    className="p-1.5 text-slate-600 hover:bg-slate-100 rounded"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-start justify-between gap-2">
                                    <p
                                        className={`text-sm flex-1 ${note.processed ? 'line-through text-slate-400' : 'text-slate-800'}`}
                                    >
                                        {note.content}
                                    </p>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        {!note.processed &&
                                            todoCategory &&
                                            note.categoryId === todoCategory.id && (
                                                <button
                                                    onClick={() => convertNoteToTask(note)}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                                    title="Convert to Task"
                                                >
                                                    <ListChecks className="w-4 h-4" />
                                                </button>
                                            )}
                                        {!note.processed && (
                                            <button
                                                onClick={() => markProcessed(note.id)}
                                                className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                                                title="Mark as done"
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleEdit(note)}
                                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded"
                                            title="Edit"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setMovingId(isMoving ? null : note.id)}
                                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"
                                            title="Move to category"
                                        >
                                            <MoveRight className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => deleteNote(note.id)}
                                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Category badge and timestamp */}
                                <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                                    {showCategoryBadge && category && (
                                        <span
                                            className="px-2 py-0.5 rounded-full text-white"
                                            style={{ backgroundColor: category.color || '#6366f1' }}
                                        >
                                            {category.emoji} {category.name}
                                        </span>
                                    )}
                                    {showCategoryBadge && !category && (
                                        <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                                            Inbox
                                        </span>
                                    )}
                                    <span>{new Date(note.createdAt).toLocaleString()}</span>
                                </div>

                                {/* Move dropdown */}
                                {isMoving && (
                                    <div className="mt-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                                        <p className="text-xs text-slate-600 mb-2">Move to:</p>
                                        <div className="flex flex-wrap gap-1">
                                            <button
                                                onClick={() => handleMoveToCategory(note.id, null)}
                                                className={`px-2 py-1 rounded text-xs ${
                                                    !note.categoryId
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                                }`}
                                            >
                                                Inbox
                                            </button>
                                            {categories.map((cat) => (
                                                <button
                                                    key={cat.id}
                                                    onClick={() =>
                                                        handleMoveToCategory(note.id, cat.id)
                                                    }
                                                    className={`px-2 py-1 rounded text-xs ${
                                                        note.categoryId === cat.id
                                                            ? 'text-white'
                                                            : 'text-white hover:opacity-80'
                                                    }`}
                                                    style={{
                                                        backgroundColor:
                                                            note.categoryId === cat.id
                                                                ? cat.color || '#6366f1'
                                                                : cat.color
                                                                  ? `${cat.color}80`
                                                                  : '#6366f180',
                                                    }}
                                                >
                                                    {cat.emoji} {cat.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
