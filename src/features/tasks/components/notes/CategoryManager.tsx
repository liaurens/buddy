import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Tag } from 'lucide-react';
import { useNotes as useSmartNotes } from '../../hooks/useNotes';
import type { NoteCategory } from '../../types';

const PRESET_COLORS = [
    '#ef4444',
    '#f97316',
    '#f59e0b',
    '#84cc16',
    '#22c55e',
    '#14b8a6',
    '#06b6d4',
    '#3b82f6',
    '#6366f1',
    '#8b5cf6',
    '#a855f7',
    '#ec4899',
];

const PRESET_EMOJIS = ['📝', '✅', '💡', '🛒', '💼', '📁', '🏠', '💪', '📚', '🎯', '⭐', '🔔'];

interface CategoryFormProps {
    formData: {
        name: string;
        flag: string;
        emoji: string;
        color: string;
    };
    setFormData: React.Dispatch<
        React.SetStateAction<{
            name: string;
            flag: string;
            emoji: string;
            color: string;
        }>
    >;
    onSave: () => void;
    onCancel: () => void;
}

const CategoryForm: React.FC<CategoryFormProps> = ({ formData, setFormData, onSave, onCancel }) => (
    <div className="bg-[color:var(--buddy-surface-soft)] rounded-xl p-4 space-y-3 border border-cove-border">
        <div className="grid grid-cols-2 gap-3">
            <div>
                <label className="block text-xs text-cove-muted mb-1">Name</label>
                <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Groceries"
                    className="app-input"
                    autoFocus
                />
            </div>
            <div>
                <label className="block text-xs text-cove-muted mb-1">Flag (trigger word)</label>
                <input
                    type="text"
                    value={formData.flag}
                    onChange={(e) =>
                        setFormData((f) => ({ ...f, flag: e.target.value.toLowerCase() }))
                    }
                    placeholder="boodschap"
                    className="app-input"
                />
            </div>
        </div>

        <div>
            <label className="block text-xs text-cove-muted mb-1">Emoji</label>
            <div className="flex flex-wrap gap-1">
                {PRESET_EMOJIS.map((emoji) => (
                    <button
                        key={emoji}
                        type="button"
                        onClick={() => setFormData((f) => ({ ...f, emoji }))}
                        className={`w-8 h-8 rounded flex items-center justify-center text-lg ${
                            formData.emoji === emoji
                                ? 'bg-cove-accent ring-2 ring-cove-accent'
                                : 'bg-white border border-cove-border hover:bg-[color:var(--buddy-surface-soft)]'
                        }`}
                    >
                        {emoji}
                    </button>
                ))}
            </div>
        </div>

        <div>
            <label className="block text-xs text-cove-muted mb-1">Color</label>
            <div className="flex flex-wrap gap-1">
                {PRESET_COLORS.map((color) => (
                    <button
                        key={color}
                        type="button"
                        onClick={() => setFormData((f) => ({ ...f, color }))}
                        className={`w-8 h-8 rounded ${
                            formData.color === color ? 'ring-2 ring-cove-border' : ''
                        }`}
                        style={{ backgroundColor: color }}
                    />
                ))}
            </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
            <button
                onClick={onCancel}
                className="px-3 py-1.5 text-cove-muted hover:text-cove-ink text-sm"
            >
                Cancel
            </button>
            <button
                onClick={onSave}
                disabled={!formData.name.trim() || !formData.flag.trim()}
                className="px-3 py-1.5 bg-cove-accent text-white rounded text-sm hover:bg-[#3a8dc7] disabled:opacity-50"
            >
                Save
            </button>
        </div>
    </div>
);

export const CategoryManager: React.FC = () => {
    const { categories, addCategory, updateCategory, deleteCategory, notes } = useSmartNotes();
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        flag: '',
        emoji: '📝',
        color: '#6366f1',
    });

    const resetForm = () => {
        setFormData({ name: '', flag: '', emoji: '📝', color: '#6366f1' });
        setIsAdding(false);
        setEditingId(null);
    };

    const handleAdd = async () => {
        if (!formData.name.trim() || !formData.flag.trim()) return;
        await addCategory({
            name: formData.name.trim(),
            flag: formData.flag.trim().toLowerCase(),
            emoji: formData.emoji,
            color: formData.color,
        });
        resetForm();
    };

    const handleEdit = (category: NoteCategory) => {
        setEditingId(category.id);
        setFormData({
            name: category.name,
            flag: category.flag,
            emoji: category.emoji || '📝',
            color: category.color || '#6366f1',
        });
    };

    const handleSaveEdit = async (categoryId: string) => {
        if (!formData.name.trim() || !formData.flag.trim()) return;
        const category = categories.find((c) => c.id === categoryId);
        if (!category) return;

        await updateCategory({
            ...category,
            name: formData.name.trim(),
            flag: formData.flag.trim().toLowerCase(),
            emoji: formData.emoji,
            color: formData.color,
        });
        resetForm();
    };

    const getNotesCount = (categoryId: string) => {
        return notes.filter((n) => n.categoryId === categoryId).length;
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-cove-ink flex items-center gap-2">
                    <Tag className="w-5 h-5" />
                    Categories
                </h3>
                {!isAdding && !editingId && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-cove-accent text-white rounded-xl text-sm hover:bg-[#3a8dc7]"
                    >
                        <Plus className="w-4 h-4" />
                        Add
                    </button>
                )}
            </div>

            {isAdding && (
                <CategoryForm
                    formData={formData}
                    setFormData={setFormData}
                    onSave={handleAdd}
                    onCancel={resetForm}
                />
            )}

            <div className="space-y-2">
                {categories.map((category) => (
                    <div key={category.id}>
                        {editingId === category.id ? (
                            <CategoryForm
                                formData={formData}
                                setFormData={setFormData}
                                onSave={() => handleSaveEdit(category.id)}
                                onCancel={resetForm}
                            />
                        ) : (
                            <div className="flex items-center justify-between bg-white rounded-xl p-3 border border-cove-border shadow-cove">
                                <div className="flex items-center gap-3">
                                    <span
                                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                                        style={{ backgroundColor: category.color || '#6366f1' }}
                                    >
                                        {category.emoji}
                                    </span>
                                    <div>
                                        <p className="text-cove-ink font-bold">{category.name}</p>
                                        <p className="text-xs text-cove-soft">
                                            -{category.flag} | {getNotesCount(category.id)} notes
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handleEdit(category)}
                                        className="p-2 text-cove-muted hover:text-cove-ink hover:bg-[color:var(--buddy-surface-soft)] rounded"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => deleteCategory(category.id)}
                                        className="p-2 text-cove-danger-deep hover:text-cove-danger-deep hover:bg-cove-tint-danger rounded"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {categories.length === 0 && !isAdding && (
                <div className="text-center py-8 text-cove-soft">
                    <Tag className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No categories yet</p>
                    <p className="text-sm">Add categories to auto-sort your notes</p>
                </div>
            )}
        </div>
    );
};
