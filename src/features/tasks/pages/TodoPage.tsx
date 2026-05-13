import React, { useState, useEffect, useMemo } from 'react';
import { Settings, Repeat, LayoutGrid, CalendarDays, BookOpen } from 'lucide-react';
import { isToday, isPast, differenceInCalendarDays } from 'date-fns';
import { useAuth } from '../../../hooks/useAuth';
import { useTasks } from '../hooks/useTasks';
import { useTaskTypes } from '../hooks/useTaskTypes';
import { useTaskRecommendation } from '../hooks/useTaskRecommendation';
import type { Task } from '../types';
import { UpcomingDeadlinesBanner } from '../../school';
import type { AppRoute } from '../../../constants/routes';

import QuickCapture from '../components/QuickCapture';
import TaskFilters, { type FilterState } from '../components/TaskFilters';
import TypeSection from '../components/TypeSection';
import TaskCard from '../components/TaskCard';
import EmptyState from '../components/EmptyState';
import TaskBulkActionBar from '../components/TaskBulkActionBar';
import TaskSettingsModal from '../components/TaskSettingsModal';
import TasksOrganizationModal from '../components/TasksOrganizationModal';
import RoutinePicker from '../components/RoutinePicker';

interface TodoPageProps {
    initialParams?: Record<string, unknown> | null;
    onNavigate?: (tab: AppRoute, params?: Record<string, unknown>) => void;
}

type ViewMode = 'type' | 'schedule';
type BucketId = 'overdue' | 'today' | 'week' | 'later';

const BUCKET_META: Record<BucketId, { label: string; tone: string; dot: string }> = {
    overdue: { label: 'Overdue',         tone: 'text-rose-600',   dot: 'bg-rose-500' },
    today:   { label: 'Today',           tone: 'text-amber-600',  dot: 'bg-amber-500' },
    week:    { label: 'This week',       tone: 'text-slate-600',  dot: 'bg-slate-400' },
    later:   { label: 'Later / no due',  tone: 'text-slate-500',  dot: 'bg-slate-300' },
};

const TodoPage: React.FC<TodoPageProps> = ({ initialParams, onNavigate }) => {
    const { user } = useAuth();
    const {
        tasks: allTodos, isLoading, addTaskFull, toggleTask, deleteTask, updateTask,
        rescheduleMany, completeMany, deleteMany,
    } = useTasks();
    const { taskTypes } = useTaskTypes();
    const { ranked } = useTaskRecommendation();

    const [view, setView] = useState<ViewMode>('type');
    const [filter, setFilter] = useState<FilterState>({ typeId: 'all', energy: 'all' });
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showSettings, setShowSettings] = useState(false);
    const [showOrganize, setShowOrganize] = useState(false);
    const [showRoutines, setShowRoutines] = useState(false);
    const [flashMessage, setFlashMessage] = useState<string | null>(null);

    // Notification deep-link intents (preserved from prior version)
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

    // Auto-clear flash message
    useEffect(() => {
        if (!flashMessage) return;
        const t = setTimeout(() => setFlashMessage(null), 3000);
        return () => clearTimeout(t);
    }, [flashMessage]);

    const activeTasks = useMemo(() => allTodos.filter(t => !t.completed), [allTodos]);
    const completedTasks = useMemo(() => allTodos.filter(t => t.completed).slice(0, 10), [allTodos]);

    const filteredActive = useMemo(() => activeTasks.filter(t => {
        if (filter.typeId === 'all') { /* allow all */ }
        else if (filter.typeId === '') { if (t.taskTypeId) return false; }
        else if (t.taskTypeId !== filter.typeId) return false;
        if (filter.energy !== 'all' && t.energy !== filter.energy) return false;
        return true;
    }), [activeTasks, filter]);
    const scoreById = useMemo(() => new Map(ranked.map(r => [r.task.id, r.score])), [ranked]);
    const topPickId = ranked[0]?.task.id;

    // Group by task type for the Type view.
    const byType = useMemo(() => {
        const groups = new Map<string, Task[]>();
        const untyped: Task[] = [];
        for (const t of filteredActive) {
            if (!t.taskTypeId) { untyped.push(t); continue; }
            const arr = groups.get(t.taskTypeId) || [];
            arr.push(t);
            groups.set(t.taskTypeId, arr);
        }
        const sortFn = (a: Task, b: Task) => {
            const aHas = !!a.dueDate, bHas = !!b.dueDate;
            if (aHas !== bHas) return aHas ? -1 : 1;
            if (aHas && bHas && a.dueDate !== b.dueDate) return a.dueDate! < b.dueDate! ? -1 : 1;
            return (scoreById.get(b.id) ?? 0) - (scoreById.get(a.id) ?? 0);
        };
        groups.forEach(arr => arr.sort(sortFn));
        untyped.sort(sortFn);
        return { groups, untyped };
    }, [filteredActive, scoreById]);

    // Bucket by due date for the Schedule view.
    const scheduled = useMemo(() => {
        const today = new Date();
        const buckets: Record<BucketId, Task[]> = { overdue: [], today: [], week: [], later: [] };
        for (const t of filteredActive) {
            if (!t.dueDate) { buckets.later.push(t); continue; }
            const due = new Date(t.dueDate);
            if (isToday(due)) buckets.today.push(t);
            else if (isPast(due)) buckets.overdue.push(t);
            else {
                const diff = differenceInCalendarDays(due, today);
                if (diff <= 7) buckets.week.push(t);
                else buckets.later.push(t);
            }
        }
        const byScore = (a: Task, b: Task) => (scoreById.get(b.id) ?? 0) - (scoreById.get(a.id) ?? 0);
        (Object.keys(buckets) as BucketId[]).forEach(k => buckets[k].sort(byScore));
        return buckets;
    }, [filteredActive, scoreById]);

    const toggleSelected = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };
    const clearSelection = () => setSelectedIds(new Set());
    const idsArray = useMemo(() => Array.from(selectedIds), [selectedIds]);

    const typesById = useMemo(() => new Map(taskTypes.map(t => [t.id, t])), [taskTypes]);

    return (
        <div className="max-w-3xl mx-auto p-4 pb-32">
            {/* Header */}
            <header className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-slate-800">Tasks</h1>
                    <span className="text-sm text-slate-400">{activeTasks.length} active</span>
                </div>
                <div className="flex items-center gap-1">
                    <ViewToggle view={view} onChange={setView} />
                    <IconButton title="Run a routine" onClick={() => setShowRoutines(true)}>
                        <Repeat size={18} />
                    </IconButton>
                    <IconButton title="Organize types & routines" onClick={() => setShowOrganize(true)}>
                        <BookOpen size={18} />
                    </IconButton>
                    <IconButton title="Settings" onClick={() => setShowSettings(true)}>
                        <Settings size={18} />
                    </IconButton>
                </div>
            </header>

            {flashMessage && (
                <div className="mb-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-3 py-2">
                    {flashMessage}
                </div>
            )}

            <UpcomingDeadlinesBanner onOpenSchool={onNavigate ? () => onNavigate('school') : undefined} />

            {/* Quick capture */}
            <div className="mb-3">
                <QuickCapture
                    taskTypes={taskTypes}
                    onSubmit={async (draft) => {
                        if (!draft.title.trim()) return;
                        await addTaskFull({
                            title: draft.title,
                            taskTypeId: draft.taskTypeId,
                            dueDate: draft.dueDate,
                            dueTime: draft.dueTime,
                            priority: draft.priority || 'medium',
                            energy: draft.energy,
                        });
                    }}
                />
            </div>

            {/* Filters */}
            {activeTasks.length > 0 && (
                <div className="mb-4">
                    <TaskFilters
                        taskTypes={taskTypes}
                        activeTasks={activeTasks}
                        filter={filter}
                        onChange={setFilter}
                    />
                </div>
            )}

            {/* Body */}
            {isLoading ? (
                <div className="text-center py-12 text-slate-400">Loading…</div>
            ) : filteredActive.length === 0 ? (
                <EmptyState
                    title={activeTasks.length === 0 ? 'All clear' : 'No tasks match this filter'}
                    hint={
                        activeTasks.length === 0
                            ? "Use the quick-capture above. Try 'email mom tomorrow 2pm'."
                            : 'Clear filters to see everything, or pick a different type.'
                    }
                />
            ) : view === 'type' ? (
                <div className="space-y-3">
                    {taskTypes.map(type => (
                        <TypeSection
                            key={type.id}
                            taskType={type}
                            tasks={byType.groups.get(type.id) || []}
                            selectedIds={selectedIds}
                            topPickId={topPickId}
                            onToggleSelect={toggleSelected}
                            onToggleComplete={toggleTask}
                            onDelete={deleteTask}
                            onUpdate={updateTask}
                        />
                    ))}
                    {byType.untyped.length > 0 && (
                        <TypeSection
                            taskType={null}
                            tasks={byType.untyped}
                            selectedIds={selectedIds}
                            topPickId={topPickId}
                            onToggleSelect={toggleSelected}
                            onToggleComplete={toggleTask}
                            onDelete={deleteTask}
                            onUpdate={updateTask}
                        />
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {(Object.keys(BUCKET_META) as BucketId[]).map(bucket => {
                        const tasks = scheduled[bucket];
                        if (tasks.length === 0) return null;
                        const meta = BUCKET_META[bucket];
                        return (
                            <section key={bucket} className="space-y-1.5">
                                <div className="flex items-center gap-2 pl-1">
                                    <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                                    <h2 className={`text-xs font-bold uppercase tracking-wider ${meta.tone}`}>
                                        {meta.label}
                                    </h2>
                                    <span className="text-xs text-slate-400">({tasks.length})</span>
                                </div>
                                <div className="space-y-1.5">
                                    {tasks.map(t => (
                                        <TaskCard
                                            key={t.id}
                                            task={t}
                                            taskType={t.taskTypeId ? typesById.get(t.taskTypeId) : undefined}
                                            isSelected={selectedIds.has(t.id)}
                                            isTopPick={t.id === topPickId && selectedIds.size === 0}
                                            onToggleSelect={toggleSelected}
                                            onToggleComplete={toggleTask}
                                            onDelete={deleteTask}
                                            onUpdate={updateTask}
                                            showTypeBadge
                                        />
                                    ))}
                                </div>
                            </section>
                        );
                    })}
                </div>
            )}

            {/* Completed footer */}
            {completedTasks.length > 0 && (
                <details className="mt-8 opacity-60 hover:opacity-100 transition-opacity">
                    <summary className="text-xs font-bold uppercase tracking-wider text-slate-500 cursor-pointer">
                        Completed ({completedTasks.length})
                    </summary>
                    <div className="space-y-1.5 mt-2">
                        {completedTasks.map(t => (
                            <TaskCard
                                key={t.id}
                                task={t}
                                taskType={t.taskTypeId ? typesById.get(t.taskTypeId) : undefined}
                                isSelected={selectedIds.has(t.id)}
                                onToggleSelect={toggleSelected}
                                onToggleComplete={toggleTask}
                                onDelete={deleteTask}
                                onUpdate={updateTask}
                                showTypeBadge
                            />
                        ))}
                    </div>
                </details>
            )}

            <TaskBulkActionBar
                selectedIds={idsArray}
                tasks={allTodos}
                onReschedule={rescheduleMany}
                onComplete={completeMany}
                onDelete={deleteMany}
                onClear={clearSelection}
            />

            <TaskSettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
            <TasksOrganizationModal isOpen={showOrganize} onClose={() => setShowOrganize(false)} />
            <RoutinePicker
                isOpen={showRoutines}
                onClose={() => setShowRoutines(false)}
                onRan={(count) => setFlashMessage(`Added ${count} ${count === 1 ? 'task' : 'tasks'} for today`)}
            />
        </div>
    );
};

const ViewToggle: React.FC<{ view: ViewMode; onChange: (v: ViewMode) => void }> = ({ view, onChange }) => (
    <div className="flex bg-slate-100 rounded-lg p-0.5 mr-1">
        <button
            onClick={() => onChange('type')}
            title="Group by type"
            className={`p-1.5 rounded ${view === 'type' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
        >
            <LayoutGrid size={16} />
        </button>
        <button
            onClick={() => onChange('schedule')}
            title="Group by schedule"
            className={`p-1.5 rounded ${view === 'schedule' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
        >
            <CalendarDays size={16} />
        </button>
    </div>
);

const IconButton: React.FC<{ title: string; onClick: () => void; children: React.ReactNode }> = ({ title, onClick, children }) => (
    <button
        onClick={onClick}
        title={title}
        aria-label={title}
        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
    >
        {children}
    </button>
);

export default TodoPage;
