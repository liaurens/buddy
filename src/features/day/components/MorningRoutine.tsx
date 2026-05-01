import React, { useState, useEffect, useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { ChevronRight, ChevronLeft, Mail, Activity, Calendar, Sparkles, Check, Settings, Plus } from 'lucide-react';
import { PlanPage } from '../../planning';
import { useTasks } from '../../tasks/hooks/useTasks';
import { useAuth } from '../../../hooks/useAuth';
import { getCategorySettings } from '../../../services/settings';
import { supabase, dbToCalendarEvent } from '../../../services/supabase';
import type { DbCalendarEvent } from '../../../services/supabase';
import type { CalendarEvent } from '../../planning/types';
import type { CommsItem } from '../../../services/settings/settings.types';
import LogYesterdayStep from './LogYesterdayStep';
import CommsSettingsModal from './CommsSettingsModal';

type Step = 0 | 1 | 2 | 3;

const STEP_LABELS = ['Comms', 'Log Yesterday', 'Tasks & Calendar', 'Plan Day'];
const STEP_ICONS = [Mail, Activity, Calendar, Sparkles];

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

interface MorningRoutineProps {
    onNavigate?: (tab: import('../../../constants/routes').AppRoute) => void;
}

const MorningRoutine: React.FC<MorningRoutineProps> = ({ onNavigate }) => {
    const today = new Date();
    const dateKey = format(today, 'yyyy-MM-dd');
    const todayStr = dateKey;

    const [step, setStep] = useState<Step>(() => {
        try {
            const saved = sessionStorage.getItem(`morning_step_${dateKey}`);
            return (saved !== null ? (Number(saved) as Step) : 0);
        } catch { return 0; }
    });

    const [commsItems, setCommsItems] = useState<CommsItem[]>([]);
    const [commsChecked, setCommsChecked] = useState<Record<string, boolean>>(() => {
        try {
            const saved = sessionStorage.getItem(`morning_comms_${dateKey}`);
            return saved ? (JSON.parse(saved) as Record<string, boolean>) : {};
        } catch { return {}; }
    });

    const [showCommsSettings, setShowCommsSettings] = useState(false);
    const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([]);
    const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDue, setNewTaskDue] = useState('');
    const [newTaskEstimate, setNewTaskEstimate] = useState('');
    const [newTaskDueTime, setNewTaskDueTime] = useState('');
    const [commsError, setCommsError] = useState<string | null>(null);
    const [calendarError, setCalendarError] = useState<string | null>(null);
    const [addTaskError, setAddTaskError] = useState<string | null>(null);
    const [addingTask, setAddingTask] = useState(false);
    const { user } = useAuth();
    const { tasks, addTask } = useTasks();

    // Persist step to sessionStorage
    useEffect(() => {
        try { sessionStorage.setItem(`morning_step_${dateKey}`, String(step)); } catch { /* ignore */ }
    }, [step, dateKey]);

    // Persist comms checks to sessionStorage
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

    useEffect(() => {
        if (!user?.id) return;
        const start = new Date(today); start.setHours(0, 0, 0, 0);
        const end = new Date(today); end.setHours(23, 59, 59, 999);
        setCalendarError(null);
        supabase
            .from('calendar_events')
            .select('*')
            .eq('user_id', user.id)
            .gte('start_time', start.toISOString())
            .lte('start_time', end.toISOString())
            .order('start_time', { ascending: true })
            .then(({ data, error }) => {
                if (error) {
                    console.error('Failed to load calendar events:', error);
                    setCalendarError('Could not load calendar. Check your connection.');
                    return;
                }
                if (data) setTodayEvents((data as DbCalendarEvent[]).map(dbToCalendarEvent));
            });
    }, [user?.id]);

    // Tasks sorted: overdue/due today first, then by priority, then by due date
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

    const dueTodayIds = useMemo(
        () => incompleteTasks.filter(t => t.dueDate === todayStr).map(t => t.id),
        [incompleteTasks, todayStr]
    );

    const selectedTimeTotal = useMemo(
        () => Array.from(selectedTaskIds).reduce((sum, id) => {
            const task = tasks.find(t => t.id === id);
            return sum + (task?.estimatedTime ?? 0);
        }, 0),
        [selectedTaskIds, tasks]
    );

    const toggleComms = (id: string) =>
        setCommsChecked(prev => ({ ...prev, [id]: !prev[id] }));

    const toggleTask = (id: string) =>
        setSelectedTaskIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });

    const handleSelectDueToday = () => {
        setSelectedTaskIds(prev => {
            const next = new Set(prev);
            dueTodayIds.forEach(id => next.add(id));
            return next;
        });
    };

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskTitle.trim() || addingTask) return;
        setAddingTask(true);
        setAddTaskError(null);
        try {
            const newId = await addTask(
                newTaskTitle.trim(),
                'medium',
                newTaskEstimate ? Number(newTaskEstimate) : undefined,
                newTaskDue || undefined,
                undefined,
                undefined,
                newTaskDueTime || undefined
            );
            setSelectedTaskIds(prev => new Set([...prev, newId]));
            setNewTaskTitle('');
            setNewTaskDue('');
            setNewTaskEstimate('');
            setNewTaskDueTime('');
        } catch (err) {
            console.error('Failed to add task:', err);
            setAddTaskError('Could not save task. Try again.');
        } finally {
            setAddingTask(false);
        }
    };

    const selectedIds = Array.from(selectedTaskIds);

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
                                    active ? 'bg-indigo-600 text-white' :
                                    done ? 'bg-indigo-100 text-indigo-700' :
                                    'bg-slate-100 text-slate-400'
                                }`}
                            >
                                {done ? <Check size={12} /> : <Icon size={12} />}
                                <span className="hidden sm:inline">{label}</span>
                                <span className="sm:hidden">{i + 1}</span>
                            </button>
                            {i < 3 && <div className="flex-1 h-px bg-slate-200" />}
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

            {/* Step 2 — Calendar & Tasks */}
            {step === 2 && (
                <div className="space-y-4">
                    {/* Calendar */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                        <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                            <Calendar size={18} className="text-indigo-600" />
                            Today's calendar
                        </h2>
                        {calendarError ? (
                            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{calendarError}</p>
                        ) : todayEvents.length === 0 ? (
                            <p className="text-sm text-slate-400">No calendar events today.</p>
                        ) : (
                            <ul className="space-y-2">
                                {todayEvents.map(ev => (
                                    <li key={ev.id} className="flex items-start gap-3 p-2 bg-slate-50 rounded-xl">
                                        <div className="text-xs text-slate-500 w-12 flex-shrink-0 pt-0.5 font-mono">
                                            {format(new Date(ev.startTime), 'HH:mm')}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-slate-800 truncate">{ev.title}</p>
                                            {ev.location && <p className="text-xs text-slate-400 truncate">{ev.location}</p>}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Tasks */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="font-semibold text-slate-900">
                                Select tasks for today
                            </h2>
                            <div className="flex items-center gap-2">
                                {dueTodayIds.length > 0 && (
                                    <button
                                        onClick={handleSelectDueToday}
                                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                                    >
                                        Select due today
                                    </button>
                                )}
                                <span className="text-xs text-slate-400 font-normal">
                                    {selectedTaskIds.size} selected
                                    {selectedTimeTotal > 0 && ` · ${selectedTimeTotal}m`}
                                </span>
                            </div>
                        </div>
                        {incompleteTasks.length === 0 ? (
                            <p className="text-sm text-slate-400">No open tasks.</p>
                        ) : (
                            <ul className="space-y-1 max-h-64 overflow-y-auto">
                                {incompleteTasks.map(task => {
                                    const isOverdue = task.dueDate && task.dueDate < todayStr;
                                    const isDueToday = task.dueDate === todayStr;
                                    return (
                                        <li key={task.id}>
                                            <button
                                                onClick={() => toggleTask(task.id)}
                                                className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left transition-colors ${
                                                    selectedTaskIds.has(task.id)
                                                        ? 'bg-indigo-50'
                                                        : 'hover:bg-slate-50'
                                                }`}
                                            >
                                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                                    selectedTaskIds.has(task.id)
                                                        ? 'border-indigo-600 bg-indigo-600'
                                                        : 'border-slate-300'
                                                }`}>
                                                    {selectedTaskIds.has(task.id) && <Check size={11} className="text-white" />}
                                                </div>
                                                <span className={`text-sm flex-1 ${isOverdue ? 'text-red-700' : 'text-slate-800'}`}>
                                                    {task.title}
                                                </span>
                                                {task.priority && (task.priority === 'urgent' || task.priority === 'high') && (
                                                    <span className={`text-xs font-medium flex-shrink-0 px-1.5 py-0.5 rounded ${
                                                        task.priority === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                                                    }`}>
                                                        {task.priority}
                                                    </span>
                                                )}
                                                {task.dueTime && (
                                                    <span className="text-xs text-amber-600 font-medium flex-shrink-0 bg-amber-50 px-1.5 py-0.5 rounded">
                                                        before {task.dueTime}
                                                    </span>
                                                )}
                                                {task.dueDate && (
                                                    <span className={`text-xs flex-shrink-0 ${isOverdue ? 'text-red-600 font-medium' : isDueToday ? 'text-amber-600 font-medium' : 'text-slate-400'}`}>
                                                        {isOverdue ? 'overdue' : isDueToday ? 'today' : format(new Date(task.dueDate), 'MMM d')}
                                                    </span>
                                                )}
                                                {task.estimatedTime && (
                                                    <span className="text-xs text-slate-400 flex-shrink-0">
                                                        {task.estimatedTime}m
                                                    </span>
                                                )}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}

                        {/* Add task inline */}
                        <form onSubmit={handleAddTask} className="pt-2 border-t border-slate-100 space-y-2">
                            <p className="text-xs text-slate-500 font-medium">Add a task</p>
                            <input
                                value={newTaskTitle}
                                onChange={e => setNewTaskTitle(e.target.value)}
                                placeholder="Task title…"
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            />
                            <div className="flex gap-2 flex-wrap">
                                <input
                                    type="date"
                                    value={newTaskDue}
                                    onChange={e => setNewTaskDue(e.target.value)}
                                    className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                />
                                <input
                                    type="time"
                                    value={newTaskDueTime}
                                    onChange={e => setNewTaskDueTime(e.target.value)}
                                    title="Must be done before this time"
                                    className="w-24 px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                />
                                <input
                                    type="number"
                                    value={newTaskEstimate}
                                    onChange={e => setNewTaskEstimate(e.target.value)}
                                    placeholder="Est. min"
                                    min={1}
                                    className="w-24 px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                />
                                <button
                                    type="submit"
                                    disabled={!newTaskTitle.trim() || addingTask}
                                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors flex items-center gap-1"
                                >
                                    <Plus size={13} /> {addingTask ? 'Adding…' : 'Add'}
                                </button>
                            </div>
                            {addTaskError && (
                                <p className="text-xs text-red-600">{addTaskError}</p>
                            )}
                        </form>
                    </div>
                </div>
            )}

            {/* Step 3 — Plan Day */}
            {step === 3 && <PlanPage selectedTaskIds={selectedIds} />}

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

export default MorningRoutine;
