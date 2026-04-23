import React, { useState, useEffect, useMemo } from 'react';
import { useTasks } from '../hooks/useTasks';
import { useTaskRecommendation } from '../hooks/useTaskRecommendation';
import { useAuth } from '../../../hooks/useAuth';
import { getCategorySettings, type TaskSettings } from '../../../services/settings';
import { Plus, Trash2, CheckCircle, Circle, Calendar as CalendarIcon, MapPin, Tag, Settings, Sparkles, ChevronDown, ChevronRight, Repeat } from 'lucide-react';
import { format, isPast, isToday, differenceInCalendarDays, addDays } from 'date-fns';
import TaskSettingsModal from '../components/TaskSettingsModal';
import AITaskSplitter from '../components/AITaskSplitter';
import TaskBulkActionBar from '../components/TaskBulkActionBar';
import { calculateNextDueDate } from '../utils/recurrence';
import type { Task, Subtask, RecurrencePattern } from '../types';

type BucketId = 'overdue' | 'today' | 'week' | 'later';

const BUCKET_LABELS: Record<BucketId, string> = {
    overdue: 'Overdue',
    today: 'Today',
    week: 'This week',
    later: 'Later / no due date',
};

const TodoPage: React.FC = () => {
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

    const completedTodos = allTodos.filter(t => t.completed).slice(0, settings?.showCompletedCount || 10);

    // Score is kept from useTaskRecommendation, but we group by due-date bucket first.
    const bucketed = useMemo(() => {
        const today = new Date();
        const scoreById = new Map(ranked.map((r, i) => [r.task.id, { score: r.score, index: i }]));
        const buckets: Record<BucketId, Task[]> = { overdue: [], today: [], week: [], later: [] };

        for (const task of allTodos) {
            if (task.completed) continue;
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
    }, [allTodos, ranked]);

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
    const [showSettings, setShowSettings] = useState(false);
    const [splittingTaskId, setSplittingTaskId] = useState<string | null>(null);
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTask.trim()) return;

        const recurrenceConfig = recurrence === 'weekly' && recurrenceDays.length > 0
            ? { daysOfWeek: recurrenceDays }
            : undefined;
        await addTask(newTask, priority, undefined, dueDate || undefined, recurrence !== 'none' ? recurrence : undefined, recurrenceConfig);

        if (dueTime || location || selectedLabels.length > 0) {
            setTimeout(async () => {
                const justCreated = allTodos.find(t => t.title === newTask && !t.dueTime && !t.location && !t.labels);
                if (justCreated) {
                    await updateTask({
                        ...justCreated,
                        dueTime: dueTime || undefined,
                        location: location || undefined,
                        labels: selectedLabels.length > 0 ? selectedLabels : undefined,
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
        const allDone = updatedSubtasks.every(st => st.completed);
        await updateTask({
            ...task,
            subtasks: updatedSubtasks,
            completed: allDone ? true : task.completed,
        });
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
                            {todo.subtasks && todo.subtasks.length > 0 && (
                                <button
                                    onClick={() => setExpandedTaskId(expandedTaskId === todo.id ? null : todo.id)}
                                    className="p-2 text-slate-300 hover:text-indigo-500 transition-colors"
                                >
                                    {expandedTaskId === todo.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </button>
                            )}
                            <button onClick={() => handleDelete(todo.id)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-rose-500 transition-opacity">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                    {expandedTaskId === todo.id && todo.subtasks && todo.subtasks.length > 0 && (
                        <div className="ml-9 mt-3 space-y-1.5 border-l-2 border-slate-100 pl-3">
                            {todo.subtasks.map(st => (
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

            <div className="space-y-6">
                {isLoading ? (
                    <div className="space-y-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-slate-100 h-20 rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <>
                        {(['overdue', 'today', 'week', 'later'] as BucketId[]).map(renderBucket)}

                        {allTodos.filter(t => !t.completed).length === 0 && (
                            <div className="text-center py-12">
                                <p className="text-slate-400">No active tasks. Enjoy your day!</p>
                            </div>
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
                onClose={() => setShowSettings(false)}
            />
        </div>
    );
};

export default TodoPage;
