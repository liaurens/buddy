import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTaskTypes } from '../hooks/useTaskTypes';
import { AVAILABLE_TYPE_COLORS, getTypeColors } from '../utils/typeColors';
import type { TaskType } from '../types';

const TaskTypeManager: React.FC = () => {
    const { taskTypes, addTaskType, updateTaskType, deleteTaskType } = useTaskTypes();
    const [newName, setNewName] = useState('');
    const [newEmoji, setNewEmoji] = useState('');
    const [newColor, setNewColor] = useState(AVAILABLE_TYPE_COLORS[0]);
    const [editing, setEditing] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState<TaskType | null>(null);

    const handleAdd = async () => {
        if (!newName.trim()) return;
        await addTaskType({ name: newName.trim(), emoji: newEmoji || undefined, color: newColor });
        setNewName('');
        setNewEmoji('');
    };

    const handleSaveEdit = async () => {
        if (editDraft) {
            await updateTaskType(editDraft);
            setEditing(null);
            setEditDraft(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this type? Tasks using it will become uncategorized.')) return;
        await deleteTaskType(id);
    };

    return (
        <div className="space-y-3">
            <p className="text-sm text-slate-500">
                Categories help organize your tasks. Presets are seeded for you; add your own or rename anything.
            </p>

            {/* Existing types */}
            <div className="space-y-1.5">
                {taskTypes.map(type => {
                    const colors = getTypeColors(type.color);
                    const isEditing = editing === type.id && editDraft;
                    return (
                        <div key={type.id} className={`rounded-lg border p-2.5 flex items-center gap-2 ${colors.bg}`}>
                            {isEditing && editDraft ? (
                                <>
                                    <input
                                        type="text"
                                        value={editDraft.emoji || ''}
                                        onChange={e => setEditDraft({ ...editDraft, emoji: e.target.value })}
                                        placeholder="😀"
                                        className="w-12 text-center rounded border border-slate-200 px-1 py-1"
                                    />
                                    <input
                                        type="text"
                                        value={editDraft.name}
                                        onChange={e => setEditDraft({ ...editDraft, name: e.target.value })}
                                        className="flex-1 rounded border border-slate-200 px-2 py-1"
                                    />
                                    <select
                                        value={editDraft.color || ''}
                                        onChange={e => setEditDraft({ ...editDraft, color: e.target.value })}
                                        className="rounded border border-slate-200 px-2 py-1 text-sm"
                                    >
                                        {AVAILABLE_TYPE_COLORS.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                    <button onClick={handleSaveEdit} className="text-sm font-medium text-indigo-600 px-2 py-1">Save</button>
                                    <button onClick={() => { setEditing(null); setEditDraft(null); }} className="text-sm text-slate-400 px-2 py-1">Cancel</button>
                                </>
                            ) : (
                                <>
                                    <span className="text-xl">{type.emoji || '•'}</span>
                                    <span className={`flex-1 font-medium ${colors.text}`}>{type.name}</span>
                                    <span className={`w-3 h-3 rounded-full ${colors.dot}`} title={type.color || ''} />
                                    <button
                                        onClick={() => { setEditing(type.id); setEditDraft(type); }}
                                        className="text-xs text-slate-600 hover:text-indigo-600 px-2 py-1"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(type.id)}
                                        className="text-slate-400 hover:text-rose-500 p-1"
                                        title="Delete"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Add new */}
            <div className="border-t border-slate-200 pt-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Add new</p>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newEmoji}
                        onChange={e => setNewEmoji(e.target.value)}
                        placeholder="😀"
                        className="w-12 text-center rounded-md border border-slate-300 px-1 py-2"
                    />
                    <input
                        type="text"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
                        placeholder="Name (e.g. Errands, Side project)"
                        className="flex-1 rounded-md border border-slate-300 px-3 py-2"
                    />
                    <select
                        value={newColor}
                        onChange={e => setNewColor(e.target.value)}
                        className="rounded-md border border-slate-300 px-2 py-2 text-sm"
                    >
                        {AVAILABLE_TYPE_COLORS.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                    <button
                        onClick={handleAdd}
                        disabled={!newName.trim()}
                        className="bg-indigo-600 text-white rounded-md px-3 py-2 hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-1"
                    >
                        <Plus size={16} /> Add
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TaskTypeManager;
