import React, { useState } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';
import { useRoutines } from '../hooks/useRoutines';
import { useTaskTypes } from '../hooks/useTaskTypes';
import type { Routine, RoutineItem, TaskEnergy } from '../types';

type DraftItem = Omit<RoutineItem, 'id' | 'routineId'>;

const RoutineEditor: React.FC = () => {
    const { routines, addRoutine } = useRoutines();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const createNew = async () => {
        setCreating(true);
        setCreateError(null);
        try {
            const r = await addRoutine({ name: 'New routine', emoji: '🔁' });
            setSelectedId(r.id);
        } catch (err: unknown) {
            setCreateError(err instanceof Error ? err.message : 'Failed to create routine');
        } finally {
            setCreating(false);
        }
    };

    const selected = routines.find((r) => r.id === selectedId) || null;

    return (
        <div className="space-y-3">
            <p className="text-sm text-slate-500">
                Routines are reusable batches. Run "Morning emails" or "Sunday reset" to drop a
                checklist of tasks onto today.
            </p>

            <div className="flex flex-wrap gap-2">
                {routines.map((r) => (
                    <button
                        key={r.id}
                        onClick={() => setSelectedId(r.id)}
                        className={`px-3 py-1.5 rounded-full text-sm border ${
                            r.id === selectedId
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                    >
                        {r.emoji || '🔁'} {r.name}{' '}
                        <span className="text-xs opacity-70">({r.items.length})</span>
                    </button>
                ))}
                <button
                    onClick={createNew}
                    disabled={creating}
                    className="px-3 py-1.5 rounded-full text-sm border border-dashed border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 flex items-center gap-1 disabled:opacity-50"
                >
                    <Plus size={14} /> {creating ? 'Creating…' : 'New routine'}
                </button>
            </div>
            {createError && (
                <p className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">
                    {createError}
                </p>
            )}

            {selected && (
                <RoutineForm
                    key={selected.id}
                    routine={selected}
                    onDeleted={() => setSelectedId(null)}
                />
            )}
        </div>
    );
};

interface RoutineFormProps {
    routine: Routine;
    onDeleted: () => void;
}

const RoutineForm: React.FC<RoutineFormProps> = ({ routine, onDeleted }) => {
    const { updateRoutine, deleteRoutine, setRoutineItems } = useRoutines();
    const { taskTypes } = useTaskTypes();

    const [name, setName] = useState(routine.name);
    const [emoji, setEmoji] = useState(routine.emoji || '');
    const [description, setDescription] = useState(routine.description || '');
    const [items, setItems] = useState<DraftItem[]>(
        routine.items.map((i) => ({
            title: i.title,
            taskTypeId: i.taskTypeId,
            energy: i.energy,
            estimatedTime: i.estimatedTime,
            sortOrder: i.sortOrder,
        })),
    );
    const [newItemTitle, setNewItemTitle] = useState('');

    const handleSave = async () => {
        await updateRoutine({
            id: routine.id,
            name,
            emoji,
            description,
            createdAt: routine.createdAt,
        });
        await setRoutineItems(
            routine.id,
            items.map((it, idx) => ({ ...it, sortOrder: idx })),
        );
    };

    const handleDelete = async () => {
        if (!confirm(`Delete routine "${routine.name}"?`)) return;
        await deleteRoutine(routine.id);
        onDeleted();
    };

    const addItem = () => {
        if (!newItemTitle.trim()) return;
        setItems((prev) => [...prev, { title: newItemTitle.trim(), sortOrder: prev.length }]);
        setNewItemTitle('');
    };

    const updateItem = (idx: number, patch: Partial<DraftItem>) => {
        setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
    };

    const removeItem = (idx: number) => {
        setItems((prev) => prev.filter((_, i) => i !== idx));
    };

    return (
        <div className="border-t border-slate-200 pt-3 space-y-3">
            <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
                <input
                    type="text"
                    value={emoji}
                    onChange={(e) => setEmoji(e.target.value)}
                    placeholder="🔁"
                    className="w-14 text-center rounded-md border border-slate-300 px-1 py-2"
                />
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Routine name"
                    className="rounded-md border border-slate-300 px-3 py-2 font-medium"
                />
            </div>
            <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description (optional)"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />

            <div className="space-y-1.5">
                {items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-50 rounded-md p-2">
                        <span className="text-xs font-mono text-slate-400 w-5">{idx + 1}</span>
                        <input
                            type="text"
                            value={item.title}
                            onChange={(e) => updateItem(idx, { title: e.target.value })}
                            className="flex-1 bg-white rounded border border-slate-200 px-2 py-1 text-sm"
                        />
                        <select
                            value={item.taskTypeId || ''}
                            onChange={(e) =>
                                updateItem(idx, { taskTypeId: e.target.value || undefined })
                            }
                            className="bg-white rounded border border-slate-200 px-2 py-1 text-xs"
                        >
                            <option value="">— type —</option>
                            {taskTypes.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.emoji} {t.name}
                                </option>
                            ))}
                        </select>
                        <select
                            value={item.energy || ''}
                            onChange={(e) =>
                                updateItem(idx, {
                                    energy: (e.target.value || undefined) as TaskEnergy | undefined,
                                })
                            }
                            className="bg-white rounded border border-slate-200 px-2 py-1 text-xs"
                        >
                            <option value="">— energy —</option>
                            <option value="low">low</option>
                            <option value="medium">medium</option>
                            <option value="high">high</option>
                        </select>
                        <input
                            type="number"
                            value={item.estimatedTime ?? ''}
                            onChange={(e) =>
                                updateItem(idx, {
                                    estimatedTime: e.target.value
                                        ? parseInt(e.target.value, 10)
                                        : undefined,
                                })
                            }
                            placeholder="min"
                            className="w-14 bg-white rounded border border-slate-200 px-2 py-1 text-xs"
                        />
                        <button
                            onClick={() => removeItem(idx)}
                            className="text-slate-400 hover:text-rose-500 p-1"
                        >
                            <X size={14} />
                        </button>
                    </div>
                ))}
            </div>

            <div className="flex gap-2">
                <input
                    type="text"
                    value={newItemTitle}
                    onChange={(e) => setNewItemTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addItem())}
                    placeholder="Add step (e.g. Check inbox)"
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                    onClick={addItem}
                    disabled={!newItemTitle.trim()}
                    className="bg-indigo-600 text-white rounded-md px-3 py-2 hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-1"
                >
                    <Plus size={14} /> Add
                </button>
            </div>

            <div className="flex justify-between items-center border-t border-slate-200 pt-3">
                <button
                    onClick={handleDelete}
                    className="text-sm text-rose-500 hover:text-rose-600 flex items-center gap-1"
                >
                    <Trash2 size={14} /> Delete routine
                </button>
                <button
                    onClick={handleSave}
                    className="bg-indigo-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-indigo-700"
                >
                    Save
                </button>
            </div>
        </div>
    );
};

export default RoutineEditor;
