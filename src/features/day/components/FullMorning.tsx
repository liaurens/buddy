import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format, subDays } from 'date-fns';
import {
    ChevronLeft, ChevronRight, Mail, Activity, Check, Settings, Plus,
    Clock, RefreshCw, Dumbbell, Calendar as CalendarIcon,
} from 'lucide-react';
import { useTasks } from '../../tasks/hooks/useTasks';
import { useAuth } from '../../../hooks/useAuth';
import { getCategorySettings } from '../../../services/settings';
import { supabase, dbToActivityTemplate } from '../../../services/supabase';
import type { DbActivityTemplate } from '../../../services/supabase';
import type { ActivityTemplate } from '../../planning/types';
import type { CommsItem } from '../../../services/settings/settings.types';
import type { AppRoute } from '../../../constants/routes';
import { syncCalendar } from '../../planning/services/calendar-sync.service';
import { useToast } from '../../../components/ui/Toast';
import { useTodayItems, formatMinutesTotal } from '../hooks/useTodayItems';
import TodayTimeline from './TodayTimeline';
import LogYesterdayStep from './LogYesterdayStep';
import CommsSettingsModal from './CommsSettingsModal';
import type { Task } from '../../tasks/types';
import { v4 as uuidv4 } from 'uuid';

type Step = 0 | 1 | 2 | 3;

const STEP_LABELS = ['Comms', 'Log Yesterday', 'Routines', 'Plan day'];
const STEP_ICONS = [Mail, Activity, Dumbbell, CalendarIcon];

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

interface Props {
    onNavigate?: (tab: AppRoute) => void;
}

const routineMapKey = (dateKey: string) => `full_routine_map_${dateKey}`;

function readRoutineMap(dateKey: string): Record<string, string> {
    try {
        const raw = sessionStorage.getItem(routineMapKey(dateKey));
        return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch { return {}; }
}

function writeRoutineMap(dateKey: string, map: Record<string, string>) {
    try { sessionStorage.setItem(routineMapKey(dateKey), JSON.stringify(map)); } catch { /* ignore */ }
}

const FullMorning: React.FC<Props> = ({ onNavigate }) => {
    const today = new Date();
    const dateKey = format(today, 'yyyy-MM-dd');
    const todayStr = dateKey;

    const { user } = useAuth();
    const toast = useToast();
    const { tasks, addTask, rescheduleMany, updateTask, deleteTask } = useTasks();
    const items = useTodayItems(dateKey);

    const [step, setStep] = useState<Step>(() => {
        try {
            const saved = sessionStorage.getItem(`full_morning_step_${dateKey}`);
            return (saved !== null ? (Number(saved) as Step) : 0);
        } catch { return 0; }
    });

    useEffect(() => {
        try { sessionStorage.setItem(`full_morning_step_${dateKey}`, String(step)); } catch { /* ignore */ }
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

    // Routines (activity_templates)
    const [routines, setRoutines] = useState<ActivityTemplate[]>([]);
    const [routinesLoading, setRoutinesLoading] = useState(false);
    const [routineMap, setRoutineMap] = useState<Record<string, string>>(() => readRoutineMap(dateKey));

    const loadRoutines = useCallback(async () => {
        if (!user?.id) return;
        setRoutinesLoading(true);
        try {
            const { data, error } = await supabase
                .from('activity_templates')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .order('name', { ascending: true });
            if (error) throw error;
            setRoutines(((data ?? []) as DbActivityTemplate[]).map(dbToActivityTemplate));
        } catch (err) {
            console.error('Failed to load routines:', err);
        } finally {
            setRoutinesLoading(false);
        }
    }, [user?.id]);

    useEffect(() => { void loadRoutines(); }, [loadRoutines]);

    const toggleRoutine = async (routine: ActivityTemplate) => {
        const existingTodoId = routineMap[routine.id];
        if (existingTodoId) {
            try {
                await deleteTask(existingTodoId);
            } catch (err) {
                console.error('Failed to remove routine:', err);
                toast.error('Could not remove routine.');
                return;
            }
            const next = { ...routineMap };
            delete next[routine.id];
            setRoutineMap(next);
            writeRoutineMap(dateKey, next);
        } else {
            try {
                const title = routine.emoji ? `${routine.emoji} ${routine.name}` : routine.name;
                const newId = await addTask(
                    title,
                    'medium',
                    routine.defaultMinutes,
                    todayStr,
                    undefined,
                    undefined,
                    routine.preferredStartTime || undefined,
                );
                const next = { ...routineMap, [routine.id]: newId };
                setRoutineMap(next);
                writeRoutineMap(dateKey, next);
            } catch (err) {
                console.error('Failed to add routine:', err);
                toast.error('Could not add routine.');
            }
        }
    };

    const [addRoutineOpen, setAddRoutineOpen] = useState(false);
    const [newRoutineName, setNewRoutineName] = useState('');
    const [newRoutineEmoji, setNewRoutineEmoji] = useState('💪');
    const [newRoutineMinutes, setNewRoutineMinutes] = useState(30);
    const [creatingRoutine, setCreatingRoutine] = useState(false);

    const handleAddRoutine = async () => {
        if (!user?.id || !newRoutineName.trim() || creatingRoutine) return;
        setCreatingRoutine(true);
        try {
            const id = uuidv4();
            const row = {
                id,
                user_id: user.id,
                name: newRoutineName.trim(),
                emoji: newRoutineEmoji || '💪',
                description: null,
                category: 'routine',
                default_minutes: Math.max(1, Math.round(newRoutineMinutes) || 30),
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            const { error } = await supabase.from('activity_templates').insert(row);
            if (error) throw error;
            await loadRoutines();
            setNewRoutineName('');
            setNewRoutineEmoji('💪');
            setNewRoutineMinutes(30);
            setAddRoutineOpen(false);
            toast.success(`Added "${row.name}"`);
        } catch (err) {
            console.error('Failed to add routine:', err);
            toast.error('Could not create routine.');
        } finally {
            setCreatingRoutine(false);
        }
    };

    // Plan step
    const [intention, setIntention] = useState<string>(() => {
        try { return sessionStorage.getItem(`light_intention_${dateKey}`) ?? ''; } catch { return ''; }
    });
    useEffect(() => {
        try { sessionStorage.setItem(`light_intention_${dateKey}`, intention); } catch { /* ignore */ }
    }, [intention, dateKey]);

    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskTime, setNewTaskTime] = useState('');
    const [newTaskEstimate, setNewTaskEstimate] = useState('30');
    const [addingTask, setAddingTask] = useState(false);
    const [addTaskError, setAddTaskError] = useState<string | null>(null);
    const [syncing, setSyncing] = useState(false);

    const pickedIds = useMemo(() => new Set(items.picks.map(p => p.id)), [items.picks]);

    const suggestions = useMemo(() => {
        return tasks
            .filter(t => !t.completed && !pickedIds.has(t.id))
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
            })
            .slice(0, 20);
    }, [tasks, pickedIds, todayStr]);

    const handleAddPick = async (task: Task) => {
        try {
            await rescheduleMany([task.id], todayStr);
        } catch {
            toast.error('Could not add to today.');
        }
    };

    const handleRemovePick = async (task: Task) => {
        try {
            await updateTask({ ...task, dueDate: undefined, dueTime: undefined });
        } catch {
            toast.error('Could not remove from today.');
        }
    };

    const handleSetPickTime = async (task: Task, time: string | null) => {
        try {
            await updateTask({ ...task, dueDate: todayStr, dueTime: time || undefined });
        } catch {
            toast.error('Could not update time.');
        }
    };

    const handleSetPickEstimate = async (task: Task, minutes: number | null) => {
        try {
            await updateTask({ ...task, dueDate: todayStr, estimatedTime: minutes ?? undefined });
        } catch {
            toast.error('Could not update duration.');
        }
    };

    const handleAddNewTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskTitle.trim() || addingTask) return;
        setAddingTask(true);
        setAddTaskError(null);
        try {
            await addTask(
                newTaskTitle.trim(),
                'medium',
                newTaskEstimate ? Number(newTaskEstimate) : undefined,
                todayStr,
                undefined,
                undefined,
                newTaskTime || undefined,
            );
            setNewTaskTitle('');
            setNewTaskTime('');
            setNewTaskEstimate('30');
        } catch (err) {
            console.error('Failed to add task:', err);
            setAddTaskError('Could not save task. Try again.');
        } finally {
            setAddingTask(false);
        }
    };

    const handleSyncCalendar = async () => {
        if (!user?.id || syncing) return;
        setSyncing(true);
        try {
            const res = await syncCalendar(user.id);
            if (res.error) toast.error(`Calendar sync: ${res.error}`);
            else toast.success(`Calendar updated (${res.eventsUpserted} events)`);
            items.refetchEvents();
        } catch {
            toast.error('Calendar sync failed.');
        } finally {
            setSyncing(false);
        }
    };

    const totalTimeLabel = formatMinutesTotal(items.estimatedTotalMinutes);

    return (
        <div className="space-y-4">
            {/* Step indicator */}
            <div className="flex items-center gap-1 overflow-x-auto">
                {STEP_LABELS.map((label, i) => {
                    const Icon = STEP_ICONS[i];
                    const active = i === step;
                    const done = i < step;
                    return (
                        <React.Fragment key={i}>
                            <button
                                onClick={() => setStep(i as Step)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                                    active ? 'bg-indigo-600 text-white' :
                                    done ? 'bg-indigo-100 text-indigo-700' :
                                    'bg-slate-100 text-slate-400'
                                }`}
                            >
                                {done ? <Check size={12} /> : <Icon size={12} />}
                                <span className="hidden sm:inline">{label}</span>
                                <span className="sm:hidden">{i + 1}</span>
                            </button>
                            {i < STEP_LABELS.length - 1 && <div className="flex-1 h-px bg-slate-200 min-w-[8px]" />}
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
                                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-indigo-200'
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

            {/* Step 2 — Routines */}
            {step === 2 && (
                <div className="space-y-4">
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                        <div>
                            <h2 className="font-semibold text-slate-900">Routines for today</h2>
                            <p className="text-sm text-slate-500 mt-0.5">
                                Tap any regular thing you want to do today — gym, walk, meds.
                            </p>
                        </div>

                        {routinesLoading ? (
                            <p className="text-sm text-slate-400">Loading…</p>
                        ) : routines.length === 0 && !addRoutineOpen ? (
                            <p className="text-sm text-slate-400">No routines yet. Add one below.</p>
                        ) : (
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {routines.map(r => {
                                    const picked = !!routineMap[r.id];
                                    return (
                                        <li key={r.id}>
                                            <button
                                                onClick={() => void toggleRoutine(r)}
                                                className={`w-full flex items-center gap-2 p-3 rounded-xl border transition-colors text-left ${
                                                    picked ? 'bg-indigo-50 border-indigo-300' : 'border-slate-200 hover:border-indigo-200'
                                                }`}
                                            >
                                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                                    picked ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                                                }`}>
                                                    {picked && <Check size={11} className="text-white" />}
                                                </div>
                                                <span className="text-sm font-medium text-slate-800 truncate">
                                                    {r.emoji} {r.name}
                                                </span>
                                                <span className="ml-auto text-xs text-slate-400 flex-shrink-0">
                                                    {r.defaultMinutes}m
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}

                        {!addRoutineOpen ? (
                            <button
                                onClick={() => setAddRoutineOpen(true)}
                                className="w-full text-left px-3 py-2 border border-dashed border-indigo-300 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-50 transition-colors"
                            >
                                + Add routine
                            </button>
                        ) : (
                            <div className="space-y-2 p-3 border border-indigo-200 rounded-lg bg-indigo-50/40">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newRoutineEmoji}
                                        onChange={e => setNewRoutineEmoji(e.target.value)}
                                        maxLength={2}
                                        className="w-12 text-center border border-slate-200 rounded-md px-2 py-2 text-sm"
                                    />
                                    <input
                                        type="text"
                                        autoFocus
                                        placeholder="Activity name (e.g. Morning walk)"
                                        value={newRoutineName}
                                        onChange={e => setNewRoutineName(e.target.value)}
                                        className="flex-1 border border-slate-200 rounded-md px-3 py-2 text-sm"
                                    />
                                </div>
                                <label className="text-xs text-slate-600 flex items-center gap-2">
                                    Default minutes
                                    <input
                                        type="number"
                                        min={1}
                                        value={newRoutineMinutes}
                                        onChange={e => setNewRoutineMinutes(Number(e.target.value))}
                                        className="w-20 border border-slate-200 rounded-md px-2 py-1 text-sm"
                                    />
                                </label>
                                <div className="flex gap-2 pt-1">
                                    <button
                                        onClick={() => void handleAddRoutine()}
                                        disabled={creatingRoutine || !newRoutineName.trim()}
                                        className="flex-1 bg-indigo-600 text-white text-sm font-medium rounded-md py-2 hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                        {creatingRoutine ? 'Adding…' : 'Save'}
                                    </button>
                                    <button
                                        onClick={() => { setAddRoutineOpen(false); setNewRoutineName(''); setNewRoutineEmoji('💪'); setNewRoutineMinutes(30); }}
                                        disabled={creatingRoutine}
                                        className="px-3 text-sm text-slate-600 hover:bg-slate-100 rounded-md"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Step 3 — Plan today */}
            {step === 3 && (
                <div className="space-y-4">
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                        <div>
                            <h2 className="font-semibold text-slate-900">Today</h2>
                            <p className="text-sm text-slate-500 mt-0.5">
                                Pick tasks, set start times and durations, and they'll land on the timeline.
                            </p>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-500">One word for today (optional)</label>
                            <input
                                value={intention}
                                onChange={e => setIntention(e.target.value)}
                                placeholder="rest · focus · catch up · …"
                                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            />
                        </div>
                    </div>

                    {/* Timeline */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-slate-900">Your timeline</h3>
                            <button
                                onClick={handleSyncCalendar}
                                disabled={syncing}
                                className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 disabled:opacity-50"
                                title="Sync calendar"
                            >
                                <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
                                {syncing ? 'Syncing…' : 'Sync calendar'}
                            </button>
                        </div>

                        <TodayTimeline
                            timedItems={items.timedItems}
                            untimedPicks={[]}
                            accent="indigo"
                            pickInteraction="check"
                            onTogglePick={handleRemovePick}
                            onClearPickTime={(t) => handleSetPickTime(t, null)}
                            hideUntimed
                        />

                        <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
                            <span>{items.totalCount} picked{totalTimeLabel ? ` · est. ~${totalTimeLabel}` : ''}</span>
                            <span className="text-slate-400">{items.events.length} event{items.events.length === 1 ? '' : 's'} today</span>
                        </div>
                    </div>

                    {/* All picks with editable time + duration */}
                    {items.picks.length > 0 && (
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-2">
                            <h3 className="font-semibold text-slate-900 text-sm">Time blocks</h3>
                            <p className="text-xs text-slate-500">Set start time and duration to place a pick on the timeline.</p>
                            <ul className="space-y-2 pt-1">
                                {items.picks.map(task => (
                                    <li key={task.id} className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-sm flex-1 min-w-0 truncate ${task.completed ? 'text-green-700 line-through' : 'text-slate-800'}`}>
                                            {task.title}
                                        </span>
                                        <label className="text-xs text-slate-500 flex items-center gap-1">
                                            <Clock size={11} />
                                            <input
                                                type="time"
                                                value={task.dueTime ?? ''}
                                                onChange={e => handleSetPickTime(task, e.target.value || null)}
                                                className="px-2 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                            />
                                        </label>
                                        <label className="text-xs text-slate-500 flex items-center gap-1">
                                            <input
                                                type="number"
                                                min={1}
                                                value={task.estimatedTime ?? ''}
                                                onChange={e => handleSetPickEstimate(task, e.target.value ? Number(e.target.value) : null)}
                                                className="w-16 px-2 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                                placeholder="min"
                                            />
                                            min
                                        </label>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Add picks from existing tasks */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                        <h3 className="font-semibold text-slate-900">Add from your tasks</h3>
                        {suggestions.length === 0 ? (
                            <p className="text-sm text-slate-400">All your open tasks are already in today.</p>
                        ) : (
                            <ul className="space-y-1 max-h-64 overflow-y-auto">
                                {suggestions.map(task => {
                                    const isOverdue = task.dueDate && task.dueDate < todayStr;
                                    return (
                                        <li key={task.id}>
                                            <button
                                                onClick={() => handleAddPick(task)}
                                                className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left hover:bg-indigo-50 transition-colors"
                                            >
                                                <Plus size={14} className="text-indigo-500 flex-shrink-0" />
                                                <span className={`text-sm flex-1 truncate ${isOverdue ? 'text-red-700' : 'text-slate-800'}`}>
                                                    {task.title}
                                                </span>
                                                {task.dueDate && (
                                                    <span className={`text-xs flex-shrink-0 ${isOverdue ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
                                                        {isOverdue ? 'overdue' : format(new Date(task.dueDate), 'MMM d')}
                                                    </span>
                                                )}
                                                {task.estimatedTime && (
                                                    <span className="text-xs text-slate-400 flex-shrink-0">{task.estimatedTime}m</span>
                                                )}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}

                        <form onSubmit={handleAddNewTask} className="pt-3 border-t border-slate-100 space-y-2">
                            <input
                                value={newTaskTitle}
                                onChange={e => setNewTaskTitle(e.target.value)}
                                placeholder="Add a new task with a time slot…"
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            />
                            <div className="flex gap-2 flex-wrap">
                                <label className="flex items-center gap-1 text-xs text-slate-500 flex-shrink-0">
                                    <Clock size={12} />
                                    <input
                                        type="time"
                                        value={newTaskTime}
                                        onChange={e => setNewTaskTime(e.target.value)}
                                        className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                    />
                                </label>
                                <input
                                    type="number"
                                    value={newTaskEstimate}
                                    onChange={e => setNewTaskEstimate(e.target.value)}
                                    placeholder="Est. min"
                                    min={1}
                                    className="w-20 px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                />
                                <button
                                    type="submit"
                                    disabled={!newTaskTitle.trim() || addingTask}
                                    className="ml-auto px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors flex items-center gap-1"
                                >
                                    <Plus size={13} /> {addingTask ? 'Adding…' : 'Add to today'}
                                </button>
                            </div>
                            {addTaskError && <p className="text-xs text-red-600">{addTaskError}</p>}
                        </form>
                    </div>

                    {/* Untimed picks reminder */}
                    {items.untimedPicks.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                            <p className="text-xs text-amber-800">
                                {items.untimedPicks.length} pick{items.untimedPicks.length === 1 ? '' : 's'} without a time slot — set times above to place them on the timeline.
                            </p>
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
                {step < 3 && (
                    <button
                        onClick={() => setStep((step + 1) as Step)}
                        className="ml-auto flex items-center gap-1 px-5 py-2 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
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

export default FullMorning;
