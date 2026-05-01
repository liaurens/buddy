import React, { useState, useEffect, useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Mail, Activity, Coffee, Check, Settings, Plus } from 'lucide-react';
import { useTasks } from '../../tasks/hooks/useTasks';
import { useAuth } from '../../../hooks/useAuth';
import { getCategorySettings } from '../../../services/settings';
import type { CommsItem } from '../../../services/settings/settings.types';
import type { AppRoute } from '../../../constants/routes';
import LogYesterdayStep from './LogYesterdayStep';
import CommsSettingsModal from './CommsSettingsModal';

type Step = 0 | 1 | 2;

const STEP_LABELS = ['Comms', 'Log Yesterday', 'Pick top 3'];
const STEP_ICONS = [Mail, Activity, Coffee];

const LIGHT_MAX_PICKS = 3;
const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

interface Props {
    onNavigate?: (tab: AppRoute) => void;
}

const LightMorning: React.FC<Props> = ({ onNavigate }) => {
    const today = new Date();
    const dateKey = format(today, 'yyyy-MM-dd');
    const todayStr = dateKey;

    const { user } = useAuth();
    const { tasks, addTask, rescheduleMany } = useTasks();

    const [step, setStep] = useState<Step>(() => {
        try {
            const saved = sessionStorage.getItem(`light_morning_step_${dateKey}`);
            return (saved !== null ? (Number(saved) as Step) : 0);
        } catch { return 0; }
    });

    useEffect(() => {
        try { sessionStorage.setItem(`light_morning_step_${dateKey}`, String(step)); } catch { /* ignore */ }
    }, [step, dateKey]);

    // Comms
    const [commsItems, setCommsItems] = useState<CommsItem[]>([]);
    const [commsChecked, setCommsChecked] = useState<Record<string, boolean>>(() => {
        try {
            const saved = sessionStorage.getItem(`morning_comms_${dateKey}`);
            return saved ? (JSON.parse(saved) as Record<string, boolean>) : {};
        } catch { return {}; }
    });
    const [showCommsSettings, setShowCommsSettings] = useState(false);
    const [commsError, setCommsError] = useState<string | null>(null);

    useEffect(() => {
        try { sessionStorage.setItem(`morning_comms_${dateKey}`, JSON.stringify(commsChecked)); } catch { /* ignore */ }
    }, [commsChecked, dateKey]);

    const loadComms = () => {
        if (!user?.id) return;
        setCommsError(null);
        getCategorySettings(user.id, 'comms')
            .then(s => {
                const dayOfWeek = new Date().getDay();
                const filtered = s.items.filter(
                    item => item.daysOfWeek === null || item.daysOfWeek.includes(dayOfWeek)
                );
                setCommsItems(filtered);
            })
            .catch(err => {
                console.error('Failed to load comms items:', err);
                setCommsError('Could not load comms items. Check your connection.');
            });
    };
    useEffect(() => { loadComms(); }, [user?.id]);

    const toggleComms = (id: string) =>
        setCommsChecked(prev => ({ ...prev, [id]: !prev[id] }));

    // Pick step
    const [intention, setIntention] = useState<string>(() => {
        try { return sessionStorage.getItem(`light_intention_${dateKey}`) ?? ''; } catch { return ''; }
    });
    const [pickIds, setPickIds] = useState<Set<string>>(() => {
        try {
            const saved = sessionStorage.getItem(`light_picks_${dateKey}`);
            return saved ? new Set(JSON.parse(saved) as string[]) : new Set();
        } catch { return new Set(); }
    });
    const [locked, setLocked] = useState<boolean>(() => {
        try { return sessionStorage.getItem(`light_locked_${dateKey}`) === '1'; } catch { return false; }
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [addingTask, setAddingTask] = useState(false);
    const [addTaskError, setAddTaskError] = useState<string | null>(null);

    useEffect(() => {
        try { sessionStorage.setItem(`light_intention_${dateKey}`, intention); } catch { /* ignore */ }
    }, [intention, dateKey]);
    useEffect(() => {
        try { sessionStorage.setItem(`light_picks_${dateKey}`, JSON.stringify(Array.from(pickIds))); } catch { /* ignore */ }
    }, [pickIds, dateKey]);

    const incompleteTasks = useMemo(() => {
        return tasks
            .filter(t => !t.completed)
            .sort((a, b) => {
                const aUrgent = a.dueDate && a.dueDate <= todayStr ? 0 : 1;
                const bUrgent = b.dueDate && b.dueDate <= todayStr ? 0 : 1;
                if (aUrgent !== bUrgent) return aUrgent - bUrgent;
                const ap = PRIORITY_ORDER[a.priority ?? 'medium'] ?? 2;
                const bp = PRIORITY_ORDER[b.priority ?? 'medium'] ?? 2;
                if (ap !== bp) return ap - bp;
                if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
                if (a.dueDate) return -1;
                if (b.dueDate) return 1;
                return 0;
            });
    }, [tasks, todayStr]);

    const suggestions = useMemo(() => incompleteTasks.slice(0, 12), [incompleteTasks]);

    const togglePick = (id: string) =>
        setPickIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else if (next.size < LIGHT_MAX_PICKS) next.add(id);
            return next;
        });

    const handleLock = async () => {
        if (pickIds.size === 0 || saving) return;
        setSaving(true);
        setError(null);
        try {
            await rescheduleMany(Array.from(pickIds), todayStr);
            setLocked(true);
            try { sessionStorage.setItem(`light_locked_${dateKey}`, '1'); } catch { /* ignore */ }
        } catch (err) {
            console.error('Failed to save light day picks:', err);
            setError('Could not save. Try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleUnlock = () => {
        setLocked(false);
        try { sessionStorage.removeItem(`light_locked_${dateKey}`); } catch { /* ignore */ }
    };

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskTitle.trim() || addingTask) return;
        setAddingTask(true);
        setAddTaskError(null);
        try {
            const newId = await addTask(newTaskTitle.trim(), 'medium', undefined, todayStr);
            setPickIds(prev => {
                const next = new Set(prev);
                if (next.size < LIGHT_MAX_PICKS) next.add(newId);
                return next;
            });
            setNewTaskTitle('');
        } catch (err) {
            console.error('Failed to add task:', err);
            setAddTaskError('Could not save task. Try again.');
        } finally {
            setAddingTask(false);
        }
    };

    const pickedTasks = useMemo(
        () => Array.from(pickIds).map(id => tasks.find(t => t.id === id)).filter(Boolean) as typeof tasks,
        [pickIds, tasks]
    );

    return (
        <div className="space-y-4">
            {/* Step indicator */}
            <div className="flex items-center gap-1">
                {STEP_LABELS.map((label, i) => {
                    const Icon = STEP_ICONS[i];
                    const active = i === step;
                    const done = i < step;
                    return (
                        <React.Fragment key={i}>
                            <button
                                onClick={() => setStep(i as Step)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                    active ? 'bg-amber-500 text-white' :
                                    done ? 'bg-amber-100 text-amber-700' :
                                    'bg-slate-100 text-slate-400'
                                }`}
                            >
                                {done ? <Check size={12} /> : <Icon size={12} />}
                                <span className="hidden sm:inline">{label}</span>
                                <span className="sm:hidden">{i + 1}</span>
                            </button>
                            {i < STEP_LABELS.length - 1 && <div className="flex-1 h-px bg-slate-200" />}
                        </React.Fragment>
                    );
                })}
            </div>

            {/* Step 0 — Comms */}
            {step === 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="font-semibold text-slate-900 text-lg">Start with your comms</h2>
                        <button
                            onClick={() => setShowCommsSettings(true)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            aria-label="Customize comms items"
                        >
                            <Settings size={16} />
                        </button>
                    </div>
                    <p className="text-sm text-slate-500">Check these before diving into your day.</p>
                    {commsError && (
                        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{commsError}</p>
                    )}
                    {!commsError && commsItems.length === 0 ? (
                        <p className="text-sm text-slate-400">No items for today. Add some in settings.</p>
                    ) : !commsError && (
                        <ul className="space-y-2">
                            {commsItems.map(item => (
                                <li key={item.id}>
                                    <button
                                        onClick={() => toggleComms(item.id)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                                            commsChecked[item.id]
                                                ? 'bg-green-50 border-green-200 text-green-800'
                                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-amber-200'
                                        }`}
                                    >
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                            commsChecked[item.id] ? 'border-green-500 bg-green-500' : 'border-slate-300'
                                        }`}>
                                            {commsChecked[item.id] && <Check size={12} className="text-white" />}
                                        </div>
                                        <span className="text-sm font-medium">{item.label}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {/* Step 1 — Log Yesterday */}
            {step === 1 && (
                <div>
                    <p className="text-sm text-slate-500 mb-3">
                        Log metrics from {format(subDays(new Date(), 1), 'EEEE, MMM do')}.
                    </p>
                    <LogYesterdayStep onNavigate={onNavigate} />
                </div>
            )}

            {/* Step 2 — Pick top 3 */}
            {step === 2 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
                    {!locked ? (
                        <>
                            <div>
                                <h2 className="font-semibold text-slate-900 text-lg">Pick your top {LIGHT_MAX_PICKS}</h2>
                                <p className="text-sm text-slate-500 mt-1">
                                    Choose 1–{LIGHT_MAX_PICKS} things you want to get done today. They'll be marked due today.
                                </p>
                            </div>

                            <div>
                                <label className="text-xs font-medium text-slate-500">One word for today (optional)</label>
                                <input
                                    value={intention}
                                    onChange={e => setIntention(e.target.value)}
                                    placeholder="rest · focus · catch up · …"
                                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
                                />
                            </div>

                            {suggestions.length === 0 ? (
                                <p className="text-sm text-slate-400">No open tasks. Add one below — or take the day off.</p>
                            ) : (
                                <ul className="space-y-1 max-h-72 overflow-y-auto">
                                    {suggestions.map(task => {
                                        const picked = pickIds.has(task.id);
                                        const disabled = !picked && pickIds.size >= LIGHT_MAX_PICKS;
                                        const isOverdue = task.dueDate && task.dueDate < todayStr;
                                        const isDueToday = task.dueDate === todayStr;
                                        return (
                                            <li key={task.id}>
                                                <button
                                                    onClick={() => togglePick(task.id)}
                                                    disabled={disabled}
                                                    className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left transition-colors ${
                                                        picked ? 'bg-amber-50' : disabled ? 'opacity-40' : 'hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                                        picked ? 'border-amber-500 bg-amber-500' : 'border-slate-300'
                                                    }`}>
                                                        {picked && <Check size={11} className="text-white" />}
                                                    </div>
                                                    <span className={`text-sm flex-1 ${isOverdue ? 'text-red-700' : 'text-slate-800'}`}>
                                                        {task.title}
                                                    </span>
                                                    {task.dueDate && (
                                                        <span className={`text-xs flex-shrink-0 ${isOverdue ? 'text-red-600 font-medium' : isDueToday ? 'text-amber-600 font-medium' : 'text-slate-400'}`}>
                                                            {isOverdue ? 'overdue' : isDueToday ? 'today' : format(new Date(task.dueDate), 'MMM d')}
                                                        </span>
                                                    )}
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}

                            <form onSubmit={handleAddTask} className="pt-3 border-t border-slate-100 flex gap-2">
                                <input
                                    value={newTaskTitle}
                                    onChange={e => setNewTaskTitle(e.target.value)}
                                    placeholder="Add a quick task…"
                                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
                                />
                                <button
                                    type="submit"
                                    disabled={!newTaskTitle.trim() || addingTask}
                                    className="px-3 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 disabled:opacity-40 transition-colors flex items-center gap-1"
                                >
                                    <Plus size={14} /> Add
                                </button>
                            </form>
                            {addTaskError && <p className="text-xs text-red-600">{addTaskError}</p>}

                            {error && (
                                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
                            )}

                            <div className="flex items-center justify-between pt-2">
                                <span className="text-xs text-slate-500">
                                    {pickIds.size} of {LIGHT_MAX_PICKS} picked
                                </span>
                                <button
                                    onClick={handleLock}
                                    disabled={pickIds.size === 0 || saving}
                                    className="px-5 py-2 text-sm font-medium bg-amber-500 text-white rounded-xl hover:bg-amber-600 disabled:opacity-40 transition-colors"
                                >
                                    {saving ? 'Saving…' : 'Lock it in'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                                    <Check size={16} className="text-green-700" />
                                </div>
                                <div>
                                    <h2 className="font-semibold text-slate-900">You're set for today</h2>
                                    {intention && (
                                        <p className="text-sm text-slate-500">Today's word: <span className="font-medium text-slate-700">{intention}</span></p>
                                    )}
                                </div>
                            </div>
                            {pickedTasks.length > 0 && (
                                <ul className="space-y-1.5">
                                    {pickedTasks.map(t => (
                                        <li key={t.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg text-sm text-slate-800">
                                            <div className="w-4 h-4 rounded border-2 border-slate-300 flex-shrink-0" />
                                            {t.title}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <button
                                onClick={handleUnlock}
                                className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
                            >
                                Change picks
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3 pt-2">
                {step > 0 && (
                    <button
                        onClick={() => setStep((step - 1) as Step)}
                        className="flex items-center gap-1 px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                        <ChevronLeft size={16} /> Back
                    </button>
                )}
                {step < 2 && (
                    <button
                        onClick={() => setStep((step + 1) as Step)}
                        className="ml-auto flex items-center gap-1 px-5 py-2 text-sm font-medium bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors"
                    >
                        Next <ChevronRight size={16} />
                    </button>
                )}
            </div>

            {showCommsSettings && (
                <CommsSettingsModal
                    onClose={() => setShowCommsSettings(false)}
                    onSaved={() => { setShowCommsSettings(false); loadComms(); }}
                />
            )}
        </div>
    );
};

export default LightMorning;
