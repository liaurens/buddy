import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Tag } from 'lucide-react';
import { useSmartNotes } from '../../../../context/SmartNotesContext';
import type { NoteCategory } from '../../../../types';

const PRESET_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#84cc16',
    '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
    '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
];

const PRESET_EMOJIS = ['📝', '✅', '💡', '🛒', '💼', '📁', '🏠', '💪', '📚', '🎯', '⭐', '🔔'];

interface CategoryFormProps {
    formData: {
        name: string;
        flag: string;
        emoji: string;
        color: string;
    };
    setFormData: React.Dispatch<React.SetStateAction<{
        name: string;
        flag: string;
        emoji: string;
        color: string;
    }>>;
    onSave: () => void;
    onCancel: () => void;
}

const CategoryForm: React.FC<CategoryFormProps> = ({ formData, setFormData, onSave, onCancel }) => (
        <div className="bg-slate-50 rounded-lg p-4 space-y-3 border border-slate-200">
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs text-slate-600 mb-1">Name</label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                        placeholder="Groceries"
                        className="w-full bg-white border border-slate-200 text-slate-800 rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        autoFocus
                    />
                </div>
                <div>
                    <label className="block text-xs text-slate-600 mb-1">Flag (trigger word)</label>
                    <input
                        type="text"
                        value={formData.flag}
                        onChange={(e) => setFormData(f => ({ ...f, flag: e.target.value.toLowerCase() }))}
                        placeholder="boodschap"
                        className="w-full bg-white border border-slate-200 text-slate-800 rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs text-slate-600 mb-1">Emoji</label>
                <div className="flex flex-wrap gap-1">
                    {PRESET_EMOJIS.map(emoji => (
                        <button
                            key={emoji}
                            type="button"
                            onClick={() => setFormData(f => ({ ...f, emoji }))}
                            className={`w-8 h-8 rounded flex items-center justify-center text-lg ${
                                formData.emoji === emoji
                                    ? 'bg-indigo-600 ring-2 ring-indigo-400'
                                    : 'bg-white border border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <label className="block text-xs text-slate-600 mb-1">Color</label>
                <div className="flex flex-wrap gap-1">
                    {PRESET_COLORS.map(color => (
                        <button
                            key={color}
                            type="button"
                            onClick={() => setFormData(f => ({ ...f, color }))}
                            className={`w-8 h-8 rounded ${
                                formData.color === color ? 'ring-2 ring-slate-800' : ''
                            }`}
                            style={{ backgroundColor: color }}
                        />
                    ))}
                </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
                <button
                    onClick={onCancel}
                    className="px-3 py-1.5 text-slate-600 hover:text-slate-800 text-sm"
                >
                    Cancel
                </button>
                <button
                    onClick={onSave}
                    disabled={!formData.name.trim() || !formData.flag.trim()}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
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
        const category = categories.find(c => c.id === categoryId);
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
        return notes.filter(n => n.categoryId === categoryId).length;
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <Tag className="w-5 h-5" />
                    Categories
                </h3>
                {!isAdding && !editingId && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
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
                {categories.map(category => (
                    <div key={category.id}>
                        {editingId === category.id ? (
                            <CategoryForm
                                formData={formData}
                                setFormData={setFormData}
                                onSave={() => handleSaveEdit(category.id)}
                                onCancel={resetForm}
                            />
                        ) : (
                            <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-slate-200 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <span
                                        className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                                        style={{ backgroundColor: category.color || '#6366f1' }}
                                    >
                                        {category.emoji}
                                    </span>
                                    <div>
                                        <p className="text-slate-800 font-medium">{category.name}</p>
                                        <p className="text-xs text-slate-500">
                                            -{category.flag} | {getNotesCount(category.id)} notes
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handleEdit(category)}
                                        className="p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => deleteCategory(category.id)}
                                        className="p-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded"
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
                <div className="text-center py-8 text-slate-500">
                    <Tag className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No categories yet</p>
                    <p className="text-sm">Add categories to auto-sort your notes</p>
                </div>
            )}
        </div>
    );
};
