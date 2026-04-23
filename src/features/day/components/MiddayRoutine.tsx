import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { ChevronUp, ChevronDown, Trash2, ArrowRight, Plus, Save, Clock } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { loadPlanForDate, updateBlock, deleteBlock, moveBlockToTomorrow, addBlockToPlan } from '../../planning/services/planning.service';
import type { DailyPlan, TimeBlock } from '../../../types/planning';

const STATUS_COLORS: Record<TimeBlock['status'], string> = {
    pending: 'bg-slate-100 text-slate-600',
    active: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    skipped: 'bg-slate-100 text-slate-400 line-through',
    rescheduled: 'bg-amber-100 text-amber-700',
};

const MiddayRoutine: React.FC = () => {
    const { user } = useAuth();
    const today = format(new Date(), 'yyyy-MM-dd');

    const [plan, setPlan] = useState<DailyPlan | null>(null);
    const [blocks, setBlocks] = useState<TimeBlock[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [pendingEdits, setPendingEdits] = useState<Record<string, Partial<TimeBlock>>>({});
    const [showAddForm, setShowAddForm] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newStart, setNewStart] = useState('');
    const [newEnd, setNewEnd] = useState('');
    const [newEstimate, setNewEstimate] = useState('');

    const loadPlan = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const data = await loadPlanForDate(user.id, today);
            setPlan(data);
            if (data) {
                setBlocks([...data.blocks].sort((a, b) => a.sortOrder - b.sortOrder));
            }
        } finally {
            setLoading(false);
        }
    }, [user?.id, today]);

    useEffect(() => { loadPlan(); }, [loadPlan]);

    const updateLocal = (blockId: string, field: keyof TimeBlock, value: string | number) => {
        setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, [field]: value } : b));
        setPendingEdits(prev => ({
            ...prev,
            [blockId]: { ...prev[blockId], [field]: value },
        }));
    };

    const moveUp = (index: number) => {
        if (index === 0) return;
        setBlocks(prev => {
            const next = [...prev];
            [next[index - 1], next[index]] = [next[index], next[index - 1]];
            return next.map((b, i) => ({ ...b, sortOrder: i }));
        });
        setPendingEdits(prev => {
            const updated = { ...prev };
            blocks.slice(Math.max(0, index - 1), index + 1).forEach((b, i) => {
                const newOrder = index - 1 + i;
                updated[b.id] = { ...updated[b.id], sortOrder: newOrder };
            });
            return updated;
        });
    };

    const moveDown = (index: number) => {
        if (index === blocks.length - 1) return;
        setBlocks(prev => {
            const next = [...prev];
            [next[index], next[index + 1]] = [next[index + 1], next[index]];
            return next.map((b, i) => ({ ...b, sortOrder: i }));
        });
    };

    const handleDelete = async (block: TimeBlock) => {
        if (!user?.id) return;
        setBlocks(prev => prev.filter(b => b.id !== block.id));
        setPendingEdits(prev => { const next = { ...prev }; delete next[block.id]; return next; });
        await deleteBlock(user.id, block.id);
    };

    const handleMoveToTomorrow = async (block: TimeBlock) => {
        if (!user?.id) return;
        setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, status: 'skipped' as const } : b));
        await moveBlockToTomorrow(user.id, block.id, block);
    };

    const handleSave = async () => {
        if (!user?.id) return;
        setSaving(true);
        try {
            await Promise.all(
                Object.entries(pendingEdits).map(([blockId, edits]) =>
                    updateBlock(user.id!, blockId, edits)
                )
            );
            setPendingEdits({});
        } finally {
            setSaving(false);
        }
    };

    const handleAddBlock = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.id || !plan || !newTitle.trim() || !newStart || !newEnd) return;
        const estimate = Number(newEstimate) || 30;
        const sortOrder = blocks.length;
        await addBlockToPlan(user.id, plan.id, {
            title: newTitle.trim(),
            startTime: newStart,
            endTime: newEnd,
            estimatedMinutes: estimate,
            sortOrder,
        });
        setNewTitle(''); setNewStart(''); setNewEnd(''); setNewEstimate('');
        setShowAddForm(false);
        await loadPlan();
    };

    const hasPendingEdits = Object.keys(pendingEdits).length > 0;

    if (loading) return <div className="text-center py-8 text-sm text-slate-400">Loading plan…</div>;

    if (!plan) {
        return (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
                <Clock size={32} className="text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">No plan found for today</p>
                <p className="text-sm text-slate-400 mt-1">Go to Morning to create one first.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-semibold text-slate-900">Midday replan</h2>
                    <p className="text-sm text-slate-500">Adjust your afternoon — reorder, edit times, add or remove blocks.</p>
                </div>
                {hasPendingEdits && (
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                        <Save size={15} /> {saving ? 'Saving…' : 'Save changes'}
                    </button>
                )}
            </div>

            <ul className="space-y-2">
                {blocks.map((block, index) => (
                    <li key={block.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                        <div className="flex items-start gap-3">
                            {/* Reorder */}
                            <div className="flex flex-col gap-0.5 pt-1">
                                <button onClick={() => moveUp(index)} disabled={index === 0} className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20 transition-colors">
                                    <ChevronUp size={16} />
                                </button>
                                <button onClick={() => moveDown(index)} disabled={index === blocks.length - 1} className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20 transition-colors">
                                    <ChevronDown size={16} />
                                </button>
                            </div>

                            <div className="flex-1 space-y-2 min-w-0">
                                {/* Title */}
                                <input
                                    value={block.title}
                                    onChange={e => updateLocal(block.id, 'title', e.target.value)}
                                    className="w-full text-sm font-medium text-slate-800 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-300 focus:outline-none pb-0.5 transition-colors"
                                />

                                {/* Time fields */}
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <input
                                        type="time"
                                        value={block.startTime}
                                        onChange={e => updateLocal(block.id, 'startTime', e.target.value)}
                                        className="border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                                    />
                                    <span>–</span>
                                    <input
                                        type="time"
                                        value={block.endTime}
                                        onChange={e => updateLocal(block.id, 'endTime', e.target.value)}
                                        className="border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                                    />
                                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[block.status]}`}>
                                        {block.status}
                                    </span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-1 flex-shrink-0">
                                <button
                                    onClick={() => handleMoveToTomorrow(block)}
                                    title="Move to tomorrow"
                                    className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                >
                                    <ArrowRight size={15} />
                                </button>
                                <button
                                    onClick={() => handleDelete(block)}
                                    title="Delete block"
                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>

            {/* Add block */}
            {showAddForm ? (
                <form onSubmit={handleAddBlock} className="bg-white rounded-2xl border border-indigo-200 shadow-sm p-4 space-y-3">
                    <p className="text-sm font-medium text-slate-800">New block</p>
                    <input
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        placeholder="Block title…"
                        required
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                    <div className="flex gap-2 items-center text-xs text-slate-500">
                        <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)} required
                            className="border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                        <span>–</span>
                        <input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} required
                            className="border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                        <input type="number" value={newEstimate} onChange={e => setNewEstimate(e.target.value)}
                            placeholder="Est. min" min={1}
                            className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                    </div>
                    <div className="flex gap-2">
                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">Add</button>
                        <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50 transition-colors">Cancel</button>
                    </div>
                </form>
            ) : (
                <button
                    onClick={() => setShowAddForm(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 rounded-2xl text-sm text-slate-400 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                >
                    <Plus size={16} /> Add block
                </button>
            )}
        </div>
    );
};

export default MiddayRoutine;
