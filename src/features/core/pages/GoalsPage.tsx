import React, { useState } from 'react';
import { Target, Plus, Flame, Clock, CheckSquare, TrendingUp, Trash2, X } from 'lucide-react';
import { useGoals } from '../hooks/useGoals';
import type { GoalType } from '../hooks/useGoals';

const PRESET_CATEGORIES = ['Health', 'Work', 'Learning', 'Habits', 'Personal'];

const TYPE_CONFIG: Record<GoalType, { label: string; Icon: typeof Target; color: string; description: string }> = {
    time:     { label: 'Time',     Icon: Clock,       color: 'text-blue-600 bg-blue-50',    description: 'Spend X minutes on this daily' },
    action:   { label: 'Action',   Icon: CheckSquare, color: 'text-green-600 bg-green-50',  description: 'Do this specific thing today' },
    progress: { label: 'Progress', Icon: TrendingUp,  color: 'text-indigo-600 bg-indigo-50',description: 'Track ongoing progress (0–100%)' },
    habit:    { label: 'Habit',    Icon: Flame,       color: 'text-orange-600 bg-orange-50',description: 'Build a daily streak' },
};

interface AddGoalModalProps {
    onClose: () => void;
    onAdd: (params: { title: string; goalType: GoalType; category: string; description?: string; targetMinutes?: number }) => Promise<void>;
}

const AddGoalModal: React.FC<AddGoalModalProps> = ({ onClose, onAdd }) => {
    const [title, setTitle] = useState('');
    const [goalType, setGoalType] = useState<GoalType>('habit');
    const [category, setCategory] = useState('Habits');
    const [customCategory, setCustomCategory] = useState('');
    const [description, setDescription] = useState('');
    const [targetMinutes, setTargetMinutes] = useState('');
    const [saving, setSaving] = useState(false);

    const finalCategory = category === '__custom' ? customCategory : category;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;
        setSaving(true);
        try {
            await onAdd({
                title: title.trim(),
                goalType,
                category: finalCategory || 'Personal',
                description: description || undefined,
                targetMinutes: goalType === 'time' && targetMinutes ? Number(targetMinutes) : undefined,
            });
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <h2 className="font-semibold text-slate-900">Add goal</h2>
                    <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Goal title</label>
                        <input value={title} onChange={e => setTitle(e.target.value)} required
                            placeholder="e.g. Read every day"
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-2">Type</label>
                        <div className="grid grid-cols-2 gap-2">
                            {(Object.entries(TYPE_CONFIG) as [GoalType, typeof TYPE_CONFIG[GoalType]][]).map(([type, cfg]) => (
                                <button key={type} type="button" onClick={() => setGoalType(type)}
                                    className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-colors ${
                                        goalType === type ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'
                                    }`}>
                                    <cfg.Icon size={16} className={goalType === type ? 'text-indigo-600' : 'text-slate-400'} />
                                    <div>
                                        <p className="text-xs font-medium text-slate-800">{cfg.label}</p>
                                        <p className="text-[10px] text-slate-400 leading-tight">{cfg.description}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {goalType === 'time' && (
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Target minutes per day</label>
                            <input type="number" value={targetMinutes} onChange={e => setTargetMinutes(e.target.value)}
                                min={1} placeholder="e.g. 30"
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-2">Category</label>
                        <div className="flex flex-wrap gap-1.5">
                            {PRESET_CATEGORIES.map(cat => (
                                <button key={cat} type="button" onClick={() => setCategory(cat)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                        category === cat ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}>
                                    {cat}
                                </button>
                            ))}
                            <button type="button" onClick={() => setCategory('__custom')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                    category === '__custom' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}>
                                Custom…
                            </button>
                        </div>
                        {category === '__custom' && (
                            <input value={customCategory} onChange={e => setCustomCategory(e.target.value)}
                                placeholder="Category name"
                                className="mt-2 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Description (optional)</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
                            placeholder="Why this goal matters…"
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
                    </div>

                    <button type="submit" disabled={saving || !title.trim()}
                        className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                        {saving ? 'Adding…' : 'Add goal'}
                    </button>
                </form>
            </div>
        </div>
    );
};

const GoalsPage: React.FC = () => {
    const { goals, isLoading, addGoal, updateGoalStatus, deleteGoal } = useGoals('all');
    const [showAdd, setShowAdd] = useState(false);
    const [filterStatus, setFilterStatus] = useState<'active' | 'all'>('active');

    const displayed = filterStatus === 'active' ? goals.filter(g => g.status === 'active') : goals;

    const byCategory = displayed.reduce<Record<string, typeof displayed>>((acc, goal) => {
        const cat = goal.category || 'Personal';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(goal);
        return acc;
    }, {});

    return (
        <div className="max-w-2xl mx-auto pb-24 space-y-5">
            <header className="flex items-center justify-between pt-2">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Target size={24} className="text-indigo-600" /> Goals
                    </h1>
                    <p className="text-sm text-slate-500">Track what you're working towards.</p>
                </div>
                <button
                    onClick={() => setShowAdd(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                    <Plus size={16} /> Add goal
                </button>
            </header>

            <div className="flex gap-2">
                {(['active', 'all'] as const).map(s => (
                    <button key={s} onClick={() => setFilterStatus(s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            filterStatus === s ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}>
                        {s === 'active' ? 'Active' : 'All goals'}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="text-center py-8 text-sm text-slate-400">Loading goals…</div>
            ) : displayed.length === 0 ? (
                <div className="text-center py-12">
                    <Target size={40} className="text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">No goals yet</p>
                    <p className="text-sm text-slate-400 mt-1">Add your first goal to start tracking.</p>
                </div>
            ) : (
                Object.entries(byCategory).map(([category, catGoals]) => (
                    <div key={category} className="space-y-2">
                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">{category}</h2>
                        {catGoals.map(goal => {
                            const { Icon, color } = TYPE_CONFIG[goal.goalType];
                            return (
                                <div key={goal.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                                    <div className="flex items-start gap-3">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                                            <Icon size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-semibold text-slate-800 truncate">{goal.title}</p>
                                                {goal.goalType === 'habit' && goal.streakCount > 0 && (
                                                    <span className="flex items-center gap-0.5 text-xs text-orange-600 font-medium flex-shrink-0">
                                                        <Flame size={12} /> {goal.streakCount}
                                                    </span>
                                                )}
                                            </div>
                                            {goal.description && (
                                                <p className="text-xs text-slate-500 mt-0.5 truncate">{goal.description}</p>
                                            )}
                                            {goal.goalType === 'time' && goal.targetMinutes && (
                                                <p className="text-xs text-slate-400 mt-0.5">{goal.targetMinutes} min/day</p>
                                            )}
                                            {(goal.goalType === 'progress' || goal.goalType === 'habit') && (
                                                <div className="mt-2">
                                                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                                                        <span>Progress</span><span>{goal.progress}%</span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-indigo-500 rounded-full transition-all"
                                                            style={{ width: `${goal.progress}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {goal.status === 'active' && (
                                                <button
                                                    onClick={() => updateGoalStatus(goal.id, 'completed')}
                                                    className="text-xs px-2 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                                                >
                                                    Done
                                                </button>
                                            )}
                                            <button
                                                onClick={() => deleteGoal(goal.id)}
                                                className="p-1 text-slate-300 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))
            )}

            {showAdd && (
                <AddGoalModal
                    onClose={() => setShowAdd(false)}
                    onAdd={addGoal}
                />
            )}
        </div>
    );
};

export default GoalsPage;
