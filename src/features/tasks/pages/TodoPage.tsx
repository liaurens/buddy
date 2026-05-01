import React, { useState, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useTasks } from '../hooks/useTasks';
import { useTaskRecommendation } from '../hooks/useTaskRecommendation';
import { useAuth } from '../../../hooks/useAuth';
import { getCategorySettings, type TaskSettings } from '../../../services/settings';
import { Plus, Trash2, CheckCircle, Circle, Calendar as CalendarIcon, MapPin, Tag, Settings, Sparkles, ChevronDown, ChevronRight, Repeat, Search, Filter, X, Bell } from 'lucide-react';
import { format, isPast, isToday, differenceInCalendarDays, addDays } from 'date-fns';
import TaskSettingsModal from '../components/TaskSettingsModal';
import AITaskSplitter from '../components/AITaskSplitter';
import TaskBulkActionBar from '../components/TaskBulkActionBar';
import { calculateNextDueDate } from '../utils/recurrence';
import type { Task, Subtask, RecurrencePattern, ReminderCadence } from '../types';

type BucketId = 'overdue' | 'today' | 'week' | 'later';

const BUCKET_LABELS: Record<BucketId, string> = {
    overdue: 'Overdue',
    today: 'Today',
    week: 'This week',
    later: 'Later / no due date',
};

interface TodoPageProps {
    initialParams?: Record<string, unknown> | null;
}

const TodoPage: React.FC<TodoPageProps> = ({ initialParams }) => {
    const { user } = useAuth();
    const { tasks: allTodos, isLoading, addTask, toggleTask, deleteTask, updateTask, rescheduleMany, completeMany, deleteMany } = useTasks();
    const { ranked } = useTaskRecommendation();

    // Settings
    const [settings, setSettings] = useState<TaskSettings | null>(null);

    useEffect(() => {
        if (user) {
            getCategorySettings(user.id, 'task').then(setSettings);
        }
    }, [user]);

    // Handle deep-link intents from notification action buttons (Mark done, Snooze 15m).
    const intentHandledRef = React.useRef<string | null>(null);
    useEffect(() => {
        if (!initialParams || !user) return;
        const intent = initialParams.intent as string | undefined;
        const taskId = initialParams.taskId as string | undefined;
        if (!intent || !taskId) return;
        const key = `${intent}:${taskId}`;
        if (intentHandledRef.current === key) return;
        intentHandledRef.current = key;

        const task = allTodos.find(t => t.id === taskId);
        if (!task) return;

        if (intent === 'complete' && !task.completed) {
            toggleTask(taskId);
        } else if (intent === 'snooze') {
            const newDue = new Date(Date.now() + 15 * 60_000);
            const newDueDate = newDue.toISOString().slice(0, 10);
            const newDueTime = `${String(newDue.getHours()).padStart(2, '0')}:${String(newDue.getMinutes()).padStart(2, '0')}`;
            updateTask({ ...task, dueDate: newDueDate, dueTime: newDueTime });
        }
    }, [initialParams, user, allTodos, toggleTask, updateTask]);

    const completedTodos = allTodos.filter(t => t.completed).slice(0, settings?.showCompletedCount || 10);

    // Search & filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [filterPriority, setFilterPriority] = useState<string>('all');
    const [filterLabel, setFilterLabel] = useState<string>('all');
    const [showFilters, setShowFilters] = useState(false);

    const matchesFilters = (task: Task): boolean => {
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const hit =
                task.title.toLowerCase().includes(q) ||
                task.location?.toLowerCase().includes(q) ||
                task.labels?.some(l => l.toLowerCase().includes(q));
            if (!hit) return false;
        }
        if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
        if (filterLabel !== 'all' && !task.labels?.includes(filterLabel)) return false;
        return true;
    };

    // Score is kept from useTaskRecommendation, but we group by due-date bucket first.
    const bucketed = useMemo(() => {
        const today = new Date();
        const scoreById = new Map(ranked.map((r, i) => [r.task.id, { score: r.score, index: i }]));
        const buckets: Record<BucketId, Task[]> = { overdue: [], today: [], week: [], later: [] };

        for (const task of allTodos) {
            if (task.completed) continue;
            if (!matchesFilters(task)) continue;
            if (!task.dueDate) {
                buckets.later.push(task);
                continue;
            }
            const due = new Date(task.dueDate);
            if (isToday(due)) {
                buckets.today.push(task);
            } else if (isPast(due)) {
                buckets.overdue.push(task);
            } else {
                const diff = differenceInCalendarDays(due, today);
                if (diff <= 7) buckets.week.push(task);
                else buckets.later.push(task);
            }
        }

        // Sort within bucket by recommendation score (desc).
        const byScore = (a: Task, b: Task) =>
            (scoreById.get(b.id)?.score ?? 0) - (scoreById.get(a.id)?.score ?? 0);
        (Object.keys(buckets) as BucketId[]).forEach(k => buckets[k].sort(byScore));

        return buckets;
    }, [allTodos, ranked, searchQuery, filterPriority, filterLabel]);

    // Alternative grouping: by label (when settings.groupByLabel is on)
    const labelGrouped = useMemo(() => {
        if (!settings?.groupByLabel) return null;
        const scoreById = new Map(ranked.map(r => [r.task.id, r.score]));
        const groups: Record<string, Task[]> = {};
        const highPriority: Task[] = [];
        const unlabeled: Task[] = [];

        for (const task of allTodos) {
            if (task.completed) continue;
            if (!matchesFilters(task)) continue;
            if (settings.keepHighPrioritySeparate && (task.priority === 'high' || task.priority === 'urgent')) {
                highPriority.push(task);
                continue;
            }
            if (task.labels && task.labels.length > 0) {
                for (const label of task.labels) {
                    if (!groups[label]) groups[label] = [];
                    groups[label].push(task);
                }
            } else {
                unlabeled.push(task);
            }
        }
        const byScore = (a: Task, b: Task) => (scoreById.get(b.id) ?? 0) - (scoreById.get(a.id) ?? 0);
        Object.values(groups).forEach(arr => arr.sort(byScore));
        highPriority.sort(byScore);
        unlabeled.sort(byScore);
        return { groups, highPriority, unlabeled };
    }, [allTodos, ranked, settings?.groupByLabel, settings?.keepHighPrioritySeparate, searchQuery, filterPriority, filterLabel]);

    // All labels currently in use (for the filter dropdown)
    const allLabels = useMemo(() => {
        const labels = new Set<string>();
        allTodos.forEach(t => { if (!t.completed) t.labels?.forEach(l => labels.add(l)); });
        return Array.from(labels).sort();
    }, [allTodos]);

    const hasActiveFilters = !!searchQuery.trim() || filterPriority !== 'all' || filterLabel !== 'all';
    const clearFilters = () => { setSearchQuery(''); setFilterPriority('all'); setFilterLabel('all'); };

    const topPickId = ranked[0]?.task.id;

    const [collapsed, setCollapsed] = useState<Record<BucketId, boolean>>({
        overdue: false,
        today: false,
        week: false,
        later: false,
    });

    const toggleCollapse = (id: BucketId) =>
        setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

    // Selection state for bulk actions
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const toggleSelected = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };
    const clearSelection = () => setSelectedIds(new Set());

    const [newTask, setNewTask] = useState('');
    const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
    const [dueDate, setDueDate] = useState('');
    const [dueTime, setDueTime] = useState('');
    const [location, setLocation] = useState('');
    const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
    const [recurrence, setRecurrence] = useState<RecurrencePattern>('none');
    const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);

    // Reminders (per-task)
    const [reminderEnabled, setReminderEnabled] = useState(false);
    const [reminderMode, setReminderMode] = useState<'before' | 'absolute'>('before');
    const [reminderOffsetMinutes, setReminderOffsetMinutes] = useState<number>(15);
    const [reminderAt, setReminderAt] = useState<string>('');
    const [reminderCadence, setReminderCadence] = useState<ReminderCadence>('smart');
    const [showSettings, setShowSettings] = useState(false);
    const [splittingTaskId, setSplittingTaskId] = useState<string | null>(null);
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
    const [newSubtaskText, setNewSubtaskText] = useState('');

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTask.trim()) return;

        const recurrenceConfig = recurrence === 'weekly' && recurrenceDays.length > 0
            ? { daysOfWeek: recurrenceDays }
            : undefined;
        await addTask(newTask, priority, undefined, dueDate || undefined, recurrence !== 'none' ? recurrence : undefined, recurrenceConfig);

        const hasReminderConfig = reminderEnabled && (
            (reminderMode === 'before' && (dueDate)) ||
            (reminderMode === 'absolute' && reminderAt)
        );

        if (dueTime || location || selectedLabels.length > 0 || hasReminderConfig) {
            setTimeout(async () => {
                const justCreated = allTodos.find(t => t.title === newTask && !t.dueTime && !t.location && !t.labels);
                if (justCreated) {
                    await updateTask({
                        ...justCreated,
                        dueTime: dueTime || undefined,
                        location: location || undefined,
                        labels: selectedLabels.length > 0 ? selectedLabels : undefined,
                        reminderEnabled: reminderEnabled,
                        reminderOffsetMinutes: reminderMode === 'before' ? reminderOffsetMinutes : undefined,
                        reminderAt: reminderMode === 'absolute' && reminderAt ? new Date(reminderAt).toISOString() : undefined,
                        reminderCadence: reminderEnabled ? reminderCadence : undefined,
                    });
                }
            }, 100);
        }

        setNewTask('');
        setPriority(settings?.defaultPriority || 'medium');
        setDueDate('');
        setDueTime('');
        setLocation('');
        setSelectedLabels([]);
        setRecurrence('none');
        setRecurrenceDays([]);
        setReminderEnabled(false);
        setReminderMode('before');
        setReminderOffsetMinutes(15);
        setReminderAt('');
        setReminderCadence('smart');
    };

    const toggleLabel = (label: string) => {
        setSelectedLabels(prev =>
            prev.includes(label)
                ? prev.filter(l => l !== label)
                : [...prev, label]
        );
    };

    const handleToggle = async (id: string) => {
        await toggleTask(id);
    };

    const handleDelete = async (id: string) => {
        await deleteTask(id);
    };

    const handleSubtaskToggle = async (task: Task, subtaskId: string) => {
        const updatedSubtasks = task.subtasks?.map(st =>
            st.id === subtaskId ? { ...st, completed: !st.completed } : st
        ) || [];
        const allDone = updatedSubtasks.length > 0 && updatedSubtasks.every(st => st.completed);
        const anyUndone = updatedSubtasks.some(st => !st.completed);
        await updateTask({
            ...task,
            subtasks: updatedSubtasks,
            completed: allDone ? true : (anyUndone ? false : task.completed),
        });
    };

    const handleAddSubtask = async (task: Task) => {
        const text = newSubtaskText.trim();
        if (!text) return;
        const newSubtask: Subtask = { id: uuidv4(), title: text, completed: false };
        await updateTask({ ...task, subtasks: [...(task.subtasks || []), newSubtask] });
        setNewSubtaskText('');
    };

    const handleAISplit = async (task: Task, subtasks: Subtask[]) => {
        await updateTask({ ...task, subtasks });
        setSplittingTaskId(null);
        setExpandedTaskId(task.id);
    };

    const getPriorityColor = (p?: string) => {
        if (p === 'high' || p === 'urgent') return 'text-rose-500 bg-rose-50';
        if (p === 'low') return 'text-blue-500 bg-blue-50';
        return 'text-amber-500 bg-amber-50';
    };

    const recurrenceLabel = (task: Task): string | null => {
        if (!task.recurrence || task.recurrence === 'none') return null;
        const next = calculateNextDueDate(task.dueDate, task.recurrence, task.recurrenceConfig);
        if (!next) return null;
        const d = new Date(next);
        if (isToday(d)) return 'Next: today';
        if (isToday(addDays(d, -1))) return 'Next: tomorrow';
        const diff = differenceInCalendarDays(d, new Date());
        if (diff >= 0 && diff < 7) return `Next: ${format(d, 'EEE')}`;
        return `Next: ${format(d, 'MMM d')}`;
    };

    const renderTask = (todo: Task) => {
        const isSelected = selectedIds.has(todo.id);
        const isTopPick = todo.id === topPickId && selectedIds.size === 0;
        const recLabel = recurrenceLabel(todo);
        return (
            <div key={todo.id}>
                <div className={`group bg-white p-4 rounded-xl border shadow-sm hover:border-indigo-200 transition-all ${
                    isSelected ? 'border-indigo-400 ring-1 ring-indigo-200' :
                    isTopPick ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-slate-100'
                }`}>
                    <div className="flex items-start gap-3">
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelected(todo.id)}
                            onClick={e => e.stopPropagation()}
                            aria-label={`Select ${todo.title}`}
                            className="mt-1.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <button
                            onClick={() => handleToggle(todo.id)}
                            className="mt-0.5 text-slate-300 hover:text-indigo-600 transition-colors"
                            aria-label="Mark complete"
                        >
                            <Circle size={24} />
                        </button>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-slate-800 text-lg leading-tight">{todo.title}</p>
                                {isTopPick && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-600 uppercase">Top Pick</span>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2 text-xs">
                                {todo.priority && (
                                    <span className={`px-2 py-0.5 rounded font-bold uppercase tracking-wider ${getPriorityColor(todo.priority)}`}>
                                        {todo.priority}
                                    </span>
                                )}
                                {todo.dueDate && (
                                    <span className={`flex items-center gap-1 font-medium ${
                                        isPast(new Date(todo.dueDate)) && !isToday(new Date(todo.dueDate)) ? 'text-rose-500' :
                                        isToday(new Date(todo.dueDate)) ? 'text-amber-600' : 'text-slate-400'
                                    }`}>
                                        <CalendarIcon size={12} />
                                        {format(new Date(todo.dueDate), 'MMM d')}
                                        {todo.dueTime && ` ${todo.dueTime}`}
                                    </span>
                                )}
                                {todo.location && (
                                    <span className="flex items-center gap-1 font-medium text-slate-500">
                                        <MapPin size={12} /> {todo.location}
                                    </span>
                                )}
                                {todo.labels && todo.labels.length > 0 && todo.labels.map(label => (
                                    <span key={label} className="flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-medium">
                                        <Tag size={10} /> {label}
                                    </span>
                                ))}
                                {todo.subtasks && todo.subtasks.length > 0 && (
                                    <span className="flex items-center gap-1 font-medium text-slate-400">
                                        {todo.subtasks.filter(st => st.completed).length}/{todo.subtasks.length} subtasks
                                    </span>
                                )}
                                {recLabel && (
                                    <span className="flex items-center gap-1 font-medium text-violet-600 bg-violet-50 px-2 py-0.5 rounded">
                                        <Repeat size={10} /> {recLabel}
                                    </span>
                                )}
                                {todo.reminderEnabled && (
                                    <span className="flex items-center gap-1 font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                                        <Bell size={10} /> Reminder
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            {(!todo.subtasks || todo.subtasks.length === 0) && (
                                <button
                                    onClick={() => setSplittingTaskId(splittingTaskId === todo.id ? null : todo.id)}
                                    className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-indigo-500 transition-all"
                                    title="Split with AI"
                                >
                                    <Sparkles size={16} />
                                </button>
                            )}
                            <button
                                onClick={() => setExpandedTaskId(expandedTaskId === todo.id ? null : todo.id)}
                                className={`p-2 text-slate-300 hover:text-indigo-500 transition-colors ${
                                    todo.subtasks && todo.subtasks.length > 0 ? '' : 'opacity-0 group-hover:opacity-100'
                                }`}
                                title={todo.subtasks && todo.subtasks.length > 0 ? 'Show subtasks' : 'Add subtask'}
                            >
                                {expandedTaskId === todo.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                            <button onClick={() => handleDelete(todo.id)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-rose-500 transition-opacity">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                    {expandedTaskId === todo.id && (
                        <div className="ml-9 mt-3 space-y-1.5 border-l-2 border-slate-100 pl-3">
                            {todo.subtasks?.map(st => (
                                <button
                                    key={st.id}
                                    onClick={() => handleSubtaskToggle(todo, st.id)}
                                    className="flex items-center gap-2 w-full text-left py-1 group/st"
                                >
                                    {st.completed ? (
                                        <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
                                    ) : (
                                        <Circle size={16} className="text-slate-300 group-hover/st:text-indigo-400 flex-shrink-0" />
                                    )}
                                    <span className={`text-sm ${st.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                        {st.title}
                                    </span>
                                </button>
                            ))}
                            <div className="flex items-center gap-2 pt-1">
                                <Plus size={14} className="text-slate-300 flex-shrink-0" />
                                <input
                                    type="text"
                                    value={newSubtaskText}
                                    onChange={e => setNewSubtaskText(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddSubtask(todo);
                                        }
                                    }}
                                    placeholder="Add subtask…"
                                    className="flex-1 text-sm bg-transparent outline-none text-slate-700 placeholder:text-slate-300"
                                />
                            </div>
                        </div>
                    )}
                </div>
                {splittingTaskId === todo.id && (
                    <div className="mt-2">
                        <AITaskSplitter
                            task={todo}
                            onSplit={(subtasks) => handleAISplit(todo, subtasks)}
                            onCancel={() => setSplittingTaskId(null)}
                        />
                    </div>
                )}
            </div>
        );
    };

    const renderBucket = (id: BucketId) => {
        const items = bucketed[id];
        if (items.length === 0) return null;
        const isCollapsed = collapsed[id];
        const headerColor = id === 'overdue' ? 'text-rose-600' : 'text-slate-500';
        const dot = id === 'overdue' ? 'bg-rose-500' : 'bg-slate-300';
        return (
            <section key={id} className="space-y-2">
                <button
                    type="button"
                    onClick={() => toggleCollapse(id)}
                    className="w-full flex items-center gap-2 pl-1"
                >
                    <span className={`w-2 h-2 rounded-full ${dot}`} />
                    <h3 className={`text-xs font-bold uppercase tracking-wider ${headerColor}`}>
                        {BUCKET_LABELS[id]} <span className="text-slate-400">({items.length})</span>
                    </h3>
                    <span className="ml-auto text-slate-300">
                        {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                    </span>
                </button>
                {!isCollapsed && <div className="space-y-2">{items.map(renderTask)}</div>}
            </section>
        );
    };

    const idsArray = Array.from(selectedIds);

    return (
        <div className="max-w-2xl mx-auto p-4 pb-24 space-y-6">
            <header className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600">
                        <CheckCircle size={24} />
                    </div>
                    Tasks
                </h1>
                <button
                    onClick={() => setShowSettings(true)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    aria-label="Settings"
                >
                    <Settings size={20} />
                </button>
            </header>

            {/* Input */}
            <form onSubmit={handleAdd} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
                <div className="flex gap-2">
                    <input
                        className="flex-1 p-3 text-lg outline-none rounded-xl bg-slate-50"
                        placeholder="Add a new task..."
                        value={newTask}
                        onChange={e => setNewTask(e.target.value)}
                    />
                    <button
                        type="submit"
                        disabled={!newTask.trim()}
                        className="bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                    >
                        <Plus size={20} />
                        Add
                    </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 [&>*:last-child]:col-span-full sm:[&>*:last-child]:col-span-1">
                    <select
                        value={priority}
                        onChange={e => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                        className="bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 rounded-lg px-3 py-2 cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                    </select>

                    <input
                        type="date"
                        value={dueDate}
                        onChange={e => setDueDate(e.target.value)}
                        className="bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 rounded-lg px-3 py-2 cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500"
                    />

                    <input
                        type="time"
                        value={dueTime}
                        onChange={e => setDueTime(e.target.value)}
                        className="bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 rounded-lg px-3 py-2 cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500"
                    />

                    <input
                        type="text"
                        value={location}
                        onChange={e => setLocation(e.target.value)}
                        placeholder="Location"
                        className="bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
                    />

                    <select
                        value={recurrence}
                        onChange={e => { setRecurrence(e.target.value as RecurrencePattern); setRecurrenceDays([]); }}
                        className="bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 rounded-lg px-3 py-2 cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="none">No repeat</option>
                        <option value="daily">Daily</option>
                        <option value="weekdays">Weekdays</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                    </select>
                </div>

                {recurrence === 'weekly' && (
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-2">Repeat on</label>
                        <div className="flex gap-1">
                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day, i) => (
                                <button
                                    key={day}
                                    type="button"
                                    onClick={() => setRecurrenceDays(prev =>
                                        prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i]
                                    )}
                                    className={`w-9 h-9 rounded-full text-xs font-medium transition-colors ${
                                        recurrenceDays.includes(i)
                                            ? 'bg-violet-600 text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {day}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="border-t border-slate-100 pt-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={reminderEnabled}
                            onChange={e => setReminderEnabled(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <Bell size={14} className="text-indigo-500" />
                        <span className="text-sm font-medium text-slate-700">Remind me</span>
                    </label>

                    {reminderEnabled && (
                        <div className="mt-3 space-y-2 pl-6">
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setReminderMode('before')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                        reminderMode === 'before' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    Before due
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setReminderMode('absolute')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                        reminderMode === 'absolute' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    Specific time
                                </button>
                            </div>

                            {reminderMode === 'before' ? (
                                <div className="flex flex-wrap gap-1.5 items-center">
                                    {[15, 60, 240, 1440].map(m => (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => setReminderOffsetMinutes(m)}
                                            className={`px-2.5 py-1 rounded text-xs font-medium ${
                                                reminderOffsetMinutes === m ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                            }`}
                                        >
                                            {m === 15 ? '15 min' : m === 60 ? '1 hr' : m === 240 ? '4 hr' : '1 day'}
                                        </button>
                                    ))}
                                    <input
                                        type="number"
                                        min={1}
                                        max={10080}
                                        value={reminderOffsetMinutes}
                                        onChange={e => setReminderOffsetMinutes(Number(e.target.value) || 15)}
                                        className="w-20 px-2 py-1 text-xs border border-slate-200 rounded"
                                    />
                                    <span className="text-xs text-slate-500">min before due</span>
                                </div>
                            ) : (
                                <input
                                    type="datetime-local"
                                    value={reminderAt}
                                    onChange={e => setReminderAt(e.target.value)}
                                    className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
                                />
                            )}

                            <div className="flex gap-1.5 items-center">
                                <span className="text-xs text-slate-500">Cadence:</span>
                                {(['single', 'smart', 'aggressive'] as ReminderCadence[]).map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setReminderCadence(c)}
                                        className={`px-2.5 py-1 rounded text-xs font-medium capitalize ${
                                            reminderCadence === c ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[11px] text-slate-400">
                                {reminderCadence === 'single' && 'One reminder.'}
                                {reminderCadence === 'smart' && 'Reminder + at due + 15m + 1h late.'}
                                {reminderCadence === 'aggressive' && 'Reminder + at due + 15/30/60/120m late.'}
                            </p>
                        </div>
                    )}
                </div>

                {settings && settings.customLabels.length > 0 && (
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-2">Labels</label>
                        <div className="flex flex-wrap gap-2">
                            {settings.customLabels.map(label => (
                                <button
                                    key={label}
                                    type="button"
                                    onClick={() => toggleLabel(label)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                        selectedLabels.includes(label)
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </form>

            {allTodos.some(t => !t.completed) && (
                <div className="space-y-2">
                    <div className="flex gap-2 items-center">
                        <div className="flex-1 relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search tasks…"
                                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowFilters(v => !v)}
                            className={`p-2 rounded-lg border transition-colors ${
                                hasActiveFilters || showFilters
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                                    : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'
                            }`}
                            aria-label="Filter tasks"
                            title="Filter tasks"
                        >
                            <Filter size={16} />
                        </button>
                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
                                aria-label="Clear filters"
                                title="Clear filters"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    {showFilters && (
                        <div className="flex flex-wrap gap-2 bg-white p-3 rounded-lg border border-slate-200">
                            <select
                                value={filterPriority}
                                onChange={e => setFilterPriority(e.target.value)}
                                className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="all">All priorities</option>
                                <option value="urgent">Urgent</option>
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                            </select>
                            {allLabels.length > 0 && (
                                <select
                                    value={filterLabel}
                                    onChange={e => setFilterLabel(e.target.value)}
                                    className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="all">All labels</option>
                                    {allLabels.map(label => (
                                        <option key={label} value={label}>{label}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className="space-y-6">
                {isLoading ? (
                    <div className="space-y-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-slate-100 h-20 rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <>
                        {labelGrouped ? (
                            <>
                                {labelGrouped.highPriority.length > 0 && (
                                    <section className="space-y-2">
                                        <div className="flex items-center gap-2 pl-1">
                                            <span className="w-2 h-2 rounded-full bg-rose-500" />
                                            <h3 className="text-xs font-bold text-rose-600 uppercase tracking-wider">
                                                High priority <span className="text-slate-400">({labelGrouped.highPriority.length})</span>
                                            </h3>
                                        </div>
                                        <div className="space-y-2">{labelGrouped.highPriority.map(renderTask)}</div>
                                    </section>
                                )}
                                {Object.entries(labelGrouped.groups).sort(([a], [b]) => a.localeCompare(b)).map(([label, tasks]) => (
                                    <section key={label} className="space-y-2">
                                        <div className="flex items-center gap-2 pl-1">
                                            <Tag size={12} className="text-purple-500" />
                                            <h3 className="text-xs font-bold text-purple-600 uppercase tracking-wider">
                                                {label} <span className="text-slate-400">({tasks.length})</span>
                                            </h3>
                                        </div>
                                        <div className="space-y-2">{tasks.map(renderTask)}</div>
                                    </section>
                                ))}
                                {labelGrouped.unlabeled.length > 0 && (
                                    <section className="space-y-2">
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">
                                            Unlabeled <span className="text-slate-400">({labelGrouped.unlabeled.length})</span>
                                        </h3>
                                        <div className="space-y-2">{labelGrouped.unlabeled.map(renderTask)}</div>
                                    </section>
                                )}
                            </>
                        ) : (
                            (['overdue', 'today', 'week', 'later'] as BucketId[]).map(renderBucket)
                        )}

                        {allTodos.filter(t => !t.completed).length === 0 && (
                            <div className="text-center py-12">
                                <p className="text-slate-400">No active tasks. Enjoy your day!</p>
                            </div>
                        )}

                        {allTodos.some(t => !t.completed) && hasActiveFilters && (
                            (labelGrouped
                                ? labelGrouped.highPriority.length === 0 && labelGrouped.unlabeled.length === 0 && Object.keys(labelGrouped.groups).length === 0
                                : (['overdue','today','week','later'] as BucketId[]).every(k => bucketed[k].length === 0)
                            ) && (
                                <div className="text-center py-8">
                                    <p className="text-slate-400">No tasks match your filters</p>
                                </div>
                            )
                        )}

                        {completedTodos.length > 0 && (
                            <div className="pt-8 opacity-60 hover:opacity-100 transition-opacity">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Completed recently</h3>
                                <div className="space-y-2">
                                    {completedTodos.map(todo => (
                                        <div key={todo.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                                            <button onClick={() => handleToggle(todo.id)} className="text-emerald-500">
                                                <CheckCircle size={20} />
                                            </button>
                                            <span className="text-slate-500 line-through decoration-slate-300 flex-1">{todo.title}</span>
                                            <button onClick={() => handleDelete(todo.id)} className="text-slate-300 hover:text-rose-500">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            <TaskBulkActionBar
                selectedIds={idsArray}
                tasks={allTodos}
                onReschedule={rescheduleMany}
                onComplete={completeMany}
                onDelete={deleteMany}
                onClear={clearSelection}
            />

            <TaskSettingsModal
                isOpen={showSettings}
                onClose={() => {
                    setShowSettings(false);
                    if (user) getCategorySettings(user.id, 'task').then(setSettings);
                }}
            />
        </div>
    );
};

export default TodoPage;
