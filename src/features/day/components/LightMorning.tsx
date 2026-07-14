import React, { useState, useEffect, useMemo } from 'react';
import { format, subDays } from 'date-fns';
import {
    ChevronLeft,
    ChevronRight,
    Mail,
    Activity,
    Coffee,
    Check,
    Settings,
    Plus,
    Clock,
    RefreshCw,
} from 'lucide-react';
import { useTasks } from '../../tasks/hooks/useTasks';
import { useAuth } from '../../../hooks/useAuth';
import { getCategorySettings } from '../../../services/settings';
import type { CommsItem } from '../../../services/settings/settings.types';
import type { AppRoute } from '../../../constants/routes';
import { syncCalendar } from '../../planning/services/calendar-sync.service';
import { useToast } from '../../../components/ui/Toast';
import { useTodayItems, formatMinutesTotal } from '../hooks/useTodayItems';
import { markRoutineDone } from '../services/routine-progress';
import { useRoutineProgress } from '../hooks/useRoutineProgress';
import TodayTimeline from './TodayTimeline';
import LogYesterdayStep from './LogYesterdayStep';
import MorningProtocolsCard from './MorningProtocolsCard';
import MorningPickCard from './MorningPickCard';
import CommsSettingsModal from './CommsSettingsModal';
import SchoolPlanningPicker from './SchoolPlanningPicker';
import type { Task } from '../../tasks/types';
import { parseDueDate } from '../../tasks/utils/dueDates';

type Step = 0 | 1 | 2;

const STEP_LABELS = ['Comms', 'Log Yesterday', 'Plan today'];
const STEP_ICONS = [Mail, Activity, Coffee];

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

interface Props {
    onNavigate?: (tab: AppRoute) => void;
    /** Deep-link from the morning anchor: land straight on the Plan step. */
    startAtPlan?: boolean;
    /** Morning pick slots (1 on survival days, 3 normally). */
    pickSlots?: number;
}

const LightMorning: React.FC<Props> = ({ onNavigate, startAtPlan, pickSlots = 3 }) => {
    const today = new Date();
    const dateKey = format(today, 'yyyy-MM-dd');
    const todayStr = dateKey;

    const { user } = useAuth();
    const toast = useToast();
    const { tasks, addTask, rescheduleMany, updateTask } = useTasks();
    const items = useTodayItems(dateKey);
    const routineProgress = useRoutineProgress(dateKey);

    const [step, setStep] = useState<Step>(() => {
        if (startAtPlan) return 2;
        try {
            const saved = sessionStorage.getItem(`light_morning_step_${dateKey}`);
            return saved !== null ? (Number(saved) as Step) : 0;
        } catch {
            return 0;
        }
    });

    useEffect(() => {
        try {
            sessionStorage.setItem(`light_morning_step_${dateKey}`, String(step));
        } catch {
            /* ignore */
        }
    }, [step, dateKey]);

    // Comms
    const [commsItems, setCommsItems] = useState<CommsItem[]>([]);
    const [commsChecked, setCommsChecked] = useState<Record<string, boolean>>(() => {
        try {
            const saved = sessionStorage.getItem(`morning_comms_${dateKey}`);
            return saved ? (JSON.parse(saved) as Record<string, boolean>) : {};
        } catch {
            return {};
        }
    });
    const [showCommsSettings, setShowCommsSettings] = useState(false);
    const [commsError, setCommsError] = useState<string | null>(null);

    useEffect(() => {
        try {
            sessionStorage.setItem(`morning_comms_${dateKey}`, JSON.stringify(commsChecked));
        } catch {
            /* ignore */
        }
    }, [commsChecked, dateKey]);

    const loadComms = () => {
        if (!user?.id) return;
        setCommsError(null);
        getCategorySettings(user.id, 'comms')
            .then((s) => {
                const dayOfWeek = new Date().getDay();
                const filtered = s.items.filter(
                    (item) => item.daysOfWeek === null || item.daysOfWeek.includes(dayOfWeek),
                );
                setCommsItems(filtered);
            })
            .catch((err) => {
                console.error('Failed to load comms items:', err);
                setCommsError('Could not load comms items. Check your connection.');
            });
    };
    useEffect(() => {
        loadComms();
    }, [user?.id]);

    const toggleComms = (id: string) => setCommsChecked((prev) => ({ ...prev, [id]: !prev[id] }));

    // Plan step
    const [intention, setIntention] = useState<string>(() => {
        try {
            return sessionStorage.getItem(`light_intention_${dateKey}`) ?? '';
        } catch {
            return '';
        }
    });
    useEffect(() => {
        try {
            sessionStorage.setItem(`light_intention_${dateKey}`, intention);
        } catch {
            /* ignore */
        }
    }, [intention, dateKey]);

    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskTime, setNewTaskTime] = useState('');
    const [newTaskEstimate, setNewTaskEstimate] = useState('');
    const [addingTask, setAddingTask] = useState(false);
    const [addTaskError, setAddTaskError] = useState<string | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [planSource, setPlanSource] = useState<'tasks' | 'school'>('tasks');
    const [showFullPicker, setShowFullPicker] = useState(false);

    const pickedIds = useMemo(() => new Set(items.picks.map((p) => p.id)), [items.picks]);

    const suggestions = useMemo(() => {
        return tasks
            .filter((t) => !t.completed && !pickedIds.has(t.id))
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
        } catch (err) {
            console.error('Failed to add pick:', err);
            toast.error('Could not add to today.');
        }
    };

    const handleRemovePick = async (task: Task) => {
        try {
            await updateTask({ ...task, dueDate: undefined, dueTime: undefined });
        } catch (err) {
            console.error('Failed to remove pick:', err);
            toast.error('Could not remove from today.');
        }
    };

    const handleSetPickTime = async (task: Task, time: string | null) => {
        try {
            await updateTask({ ...task, dueDate: todayStr, dueTime: time || undefined });
        } catch (err) {
            console.error('Failed to update pick time:', err);
            toast.error('Could not update time.');
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
            setNewTaskEstimate('');
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
            if (res.error) {
                toast.error(`Calendar sync: ${res.error}`);
            } else {
                toast.success(`Calendar updated (${res.eventsUpserted} events)`);
            }
            items.refetchEvents();
        } catch (err) {
            console.error('Calendar sync failed:', err);
            toast.error('Calendar sync failed.');
        } finally {
            setSyncing(false);
        }
    };

    const totalTimeLabel = formatMinutesTotal(items.estimatedTotalMinutes);

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
                                    active
                                        ? 'bg-amber-500 text-white'
                                        : done
                                          ? 'bg-amber-100 text-amber-700'
                                          : 'bg-slate-100 text-slate-400'
                                }`}
                            >
                                {done ? <Check size={12} /> : <Icon size={12} />}
                                <span className="hidden sm:inline">{label}</span>
                                <span className="sm:hidden">{i + 1}</span>
                            </button>
                            {i < STEP_LABELS.length - 1 && (
                                <div className="flex-1 h-px bg-slate-200" />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            {/* Step 0 — Comms */}
            {step === 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="font-semibold text-slate-900 text-lg">
                            Start with your comms
                        </h2>
                        <button
                            onClick={() => setShowCommsSettings(true)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            aria-label="Customize comms items"
                        >
                            <Settings size={16} />
                        </button>
                    </div>
                    <p className="text-sm text-slate-500">
                        Check these before diving into your day.
                    </p>
                    {commsError && (
                        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {commsError}
                        </p>
                    )}
                    {!commsError && commsItems.length === 0 ? (
                        <p className="text-sm text-slate-400">
                            No items for today. Add some in settings.
                        </p>
                    ) : (
                        !commsError && (
                            <ul className="space-y-2">
                                {commsItems.map((item) => (
                                    <li key={item.id}>
                                        <button
                                            onClick={() => toggleComms(item.id)}
                                            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                                                commsChecked[item.id]
                                                    ? 'bg-green-50 border-green-200 text-green-800'
                                                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-amber-200'
                                            }`}
                                        >
                                            <div
                                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                                    commsChecked[item.id]
                                                        ? 'border-green-500 bg-green-500'
                                                        : 'border-slate-300'
                                                }`}
                                            >
                                                {commsChecked[item.id] && (
                                                    <Check size={12} className="text-white" />
                                                )}
                                            </div>
                                            <span className="text-sm font-medium">
                                                {item.label}
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )
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

            {/* Step 2 — Plan today */}
            {step === 2 && (
                <div className="space-y-4">
                    {/* Active protocols (meds/supplements) — especially important on light days */}
                    <MorningProtocolsCard />
                    {/* Intention */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                        <div>
                            <h2 className="font-semibold text-slate-900">Today</h2>
                            <p className="text-sm text-slate-500 mt-0.5">
                                Pick what you want done. Calendar events fill in automatically.
                            </p>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-500">
                                One word for today (optional)
                            </label>
                            <input
                                value={intention}
                                onChange={(e) => setIntention(e.target.value)}
                                placeholder="rest · focus · catch up · …"
                                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
                            />
                        </div>
                    </div>

                    {/* Deterministic morning pick — the default way to fill today */}
                    <MorningPickCard
                        dateKey={dateKey}
                        accent="amber"
                        slots={pickSlots}
                        fullPickerOpen={showFullPicker}
                        onToggleFullPicker={() => setShowFullPicker((prev) => !prev)}
                    />

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
                            untimedPicks={items.untimedPicks}
                            accent="amber"
                            pickInteraction="check"
                            onTogglePick={handleRemovePick}
                            onClearPickTime={(t) => handleSetPickTime(t, null)}
                        />

                        <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
                            <span>
                                {items.totalCount} picked
                                {totalTimeLabel ? ` · est. ~${totalTimeLabel}` : ''}
                            </span>
                            <span className="text-slate-400">
                                {items.events.length} event{items.events.length === 1 ? '' : 's'}{' '}
                                today
                            </span>
                        </div>
                    </div>

                    {showFullPicker && (
                        <>
                            <div className="app-segmented">
                                <button
                                    onClick={() => setPlanSource('tasks')}
                                    className={`app-segment ${planSource === 'tasks' ? 'app-segment-active' : ''}`}
                                >
                                    Tasks
                                </button>
                                <button
                                    onClick={() => setPlanSource('school')}
                                    className={`app-segment ${planSource === 'school' ? 'app-segment-active' : ''}`}
                                >
                                    School
                                </button>
                            </div>

                            {planSource === 'tasks' ? (
                                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                                    <h3 className="font-semibold text-slate-900">
                                        Add from your tasks
                                    </h3>
                                    {suggestions.length === 0 ? (
                                        <p className="text-sm text-slate-400">
                                            All your open tasks are already in today.
                                        </p>
                                    ) : (
                                        <ul className="space-y-1 max-h-64 overflow-y-auto">
                                            {suggestions.map((task) => {
                                                const isOverdue =
                                                    task.dueDate && task.dueDate < todayStr;
                                                return (
                                                    <li key={task.id}>
                                                        <button
                                                            onClick={() => handleAddPick(task)}
                                                            className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left hover:bg-amber-50 transition-colors"
                                                        >
                                                            <Plus
                                                                size={14}
                                                                className="text-amber-500 flex-shrink-0"
                                                            />
                                                            <span
                                                                className={`text-sm flex-1 truncate ${isOverdue ? 'text-red-700' : 'text-slate-800'}`}
                                                            >
                                                                {task.title}
                                                            </span>
                                                            {task.dueDate && (
                                                                <span
                                                                    className={`text-xs flex-shrink-0 ${isOverdue ? 'text-red-600 font-medium' : 'text-slate-400'}`}
                                                                >
                                                                    {isOverdue
                                                                        ? 'overdue'
                                                                        : format(
                                                                              parseDueDate(
                                                                                  task.dueDate,
                                                                              ),
                                                                              'MMM d',
                                                                          )}
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

                                    <form
                                        onSubmit={handleAddNewTask}
                                        className="pt-3 border-t border-slate-100 space-y-2"
                                    >
                                        <input
                                            value={newTaskTitle}
                                            onChange={(e) => setNewTaskTitle(e.target.value)}
                                            placeholder="Add a new task to today…"
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
                                        />
                                        <div className="flex gap-2 flex-wrap">
                                            <label className="flex items-center gap-1 text-xs text-slate-500 flex-shrink-0">
                                                <Clock size={12} />
                                                <input
                                                    type="time"
                                                    value={newTaskTime}
                                                    onChange={(e) => setNewTaskTime(e.target.value)}
                                                    className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
                                                />
                                            </label>
                                            <input
                                                type="number"
                                                value={newTaskEstimate}
                                                onChange={(e) => setNewTaskEstimate(e.target.value)}
                                                placeholder="Est. min"
                                                min={1}
                                                className="w-20 px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
                                            />
                                            <button
                                                type="submit"
                                                disabled={!newTaskTitle.trim() || addingTask}
                                                className="ml-auto px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-600 disabled:opacity-40 transition-colors flex items-center gap-1"
                                            >
                                                <Plus size={13} />{' '}
                                                {addingTask ? 'Adding…' : 'Add to today'}
                                            </button>
                                        </div>
                                        {addTaskError && (
                                            <p className="text-xs text-red-600">{addTaskError}</p>
                                        )}
                                    </form>
                                </div>
                            ) : (
                                <SchoolPlanningPicker
                                    dateKey={dateKey}
                                    accent="amber"
                                    onNavigate={onNavigate}
                                />
                            )}
                        </>
                    )}

                    {/* Set times on untimed picks */}
                    {items.untimedPicks.length > 0 && (
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-2">
                            <h3 className="font-semibold text-slate-900 text-sm">
                                Give your picks a time (optional)
                            </h3>
                            <p className="text-xs text-slate-500">
                                Add a time and a pick lands on the timeline next to your calendar
                                events.
                            </p>
                            <ul className="space-y-2 pt-1">
                                {items.untimedPicks.map((task) => (
                                    <li key={task.id} className="flex items-center gap-2">
                                        <span className="text-sm text-slate-700 flex-1 truncate">
                                            {task.title}
                                        </span>
                                        <input
                                            type="time"
                                            onChange={(e) =>
                                                handleSetPickTime(task, e.target.value)
                                            }
                                            className="px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
                                        />
                                    </li>
                                ))}
                            </ul>
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
                {step < 2 ? (
                    <button
                        onClick={() => setStep((step + 1) as Step)}
                        className="ml-auto flex items-center gap-1 px-5 py-2 text-sm font-medium bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors"
                    >
                        Next <ChevronRight size={16} />
                    </button>
                ) : (
                    !routineProgress.morning && (
                        <button
                            onClick={() => {
                                markRoutineDone('morning', dateKey);
                                toast.success('Morning routine done — have a good day!');
                            }}
                            className="ml-auto flex items-center gap-1 px-5 py-2 text-sm font-medium bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors"
                        >
                            <Check size={16} /> Finish morning
                        </button>
                    )
                )}
            </div>

            {showCommsSettings && (
                <CommsSettingsModal
                    onClose={() => setShowCommsSettings(false)}
                    onSaved={() => {
                        setShowCommsSettings(false);
                        loadComms();
                    }}
                />
            )}
        </div>
    );
};

export default LightMorning;
