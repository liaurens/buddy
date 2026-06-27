import React, { useState, useEffect, useMemo } from 'react';
import { Settings, Repeat, LayoutGrid, CalendarDays, BookOpen, Flame, Sparkles, X } from 'lucide-react';
import { isToday, isPast, differenceInCalendarDays } from 'date-fns';
import { useAuth } from '../../../hooks/useAuth';
import { useTasks } from '../hooks/useTasks';
import { useTaskTypes } from '../hooks/useTaskTypes';
import { useTaskRecommendation } from '../hooks/useTaskRecommendation';
import type { Task, TaskKind } from '../types';
import { deriveTaskKind, TASK_KIND_META, TASK_KIND_ORDER } from '../utils/taskKind';
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
import AIOrganizeModal from '../components/AIOrganizeModal';
import TriageInbox from '../components/TriageInbox';
import RoutinePicker from '../components/RoutinePicker';

interface TodoPageProps {
    initialParams?: Record<string, unknown> | null;
    onNavigate?: (tab: AppRoute, params?: Record<string, unknown>) => void;
    /** Optional content rendered at the top of the page (e.g. urgent inbox / next-up cards). */
    topSlot?: React.ReactNode;
}

type ViewMode = 'type' | 'schedule' | 'kind';
type BucketId = 'overdue' | 'today' | 'week' | 'later';

const BUCKET_META: Record<BucketId, { label: string; tone: string; dot: string }> = {
    overdue: { label: 'Overdue',         tone: 'text-rose-600',   dot: 'bg-rose-500' },
    today:   { label: 'Today',           tone: 'text-amber-600',  dot: 'bg-amber-500' },
    week:    { label: 'This week',       tone: 'text-slate-600',  dot: 'bg-slate-400' },
    later:   { label: 'Later / no due',  tone: 'text-slate-500',  dot: 'bg-slate-300' },
};

const TodoPage: React.FC<TodoPageProps> = ({ initialParams, onNavigate, topSlot }) => {
    const { user } = useAuth();
    const {
        tasks: allTodos, isLoading, addTaskFull, toggleTask, deleteTask, updateTask,
        rescheduleMany, completeMany, deleteMany,
    } = useTasks();
    const { taskTypes } = useTaskTypes();
    const { ranked } = useTaskRecommendation();

    const deepLinkUrgent = initialParams?.view === 'urgent';
    const [view, setView] = useState<ViewMode>(deepLinkUrgent ? 'kind' : 'type');
    const [onlyKind, setOnlyKind] = useState<TaskKind | null>(deepLinkUrgent ? 'urgent' : null);
    const [filter, setFilter] = useState<FilterState>({ typeId: 'all', energy: 'all' });
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showSettings, setShowSettings] = useState(false);
    const [showOrganize, setShowOrganize] = useState(false);
    const [showOrganizeAI, setShowOrganizeAI] = useState(false);
    const [showTriage, setShowTriage] = useState(false);
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

    // Capture inbox = active tasks not yet routed by triage.
    const inboxCount = useMemo(() => allTodos.filter(t => !t.completed && !t.triagedAt).length, [allTodos]);

    // "Unorganized" inbox = active tasks without a type; the AI organizer targets these.
    const organizeCandidates = useMemo(() => activeTasks.filter(t => !t.taskTypeId), [activeTasks]);

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

    // Group by behavioral kind for the Kind view.
    const byKind = useMemo(() => {
        const groups = new Map<TaskKind, Task[]>();
        for (const t of filteredActive) {
            const k = deriveTaskKind(t);
            const arr = groups.get(k) || [];
            arr.push(t);
            groups.set(k, arr);
        }
        const byScore = (a: Task, b: Task) => (scoreById.get(b.id) ?? 0) - (scoreById.get(a.id) ?? 0);
        groups.forEach(arr => arr.sort(byScore));
        return groups;
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
        <div className="app-page">
            {/* Header */}
            <header className="hidden flex-col gap-3 sm:flex-row sm:items-end sm:justify-between lg:flex">
                <div>
                    <h1 className="app-title">Tasks</h1>
                    <p className="app-subtitle">{activeTasks.length} active · grouped for easier scanning</p>
                </div>
                <div className="flex items-center gap-1 self-start sm:self-auto">
                    <ViewToggle view={view} onChange={(v) => { setView(v); setOnlyKind(null); }} />
                    {organizeCandidates.length > 0 && (
                        <IconButton title="Organize with AI" onClick={() => setShowOrganizeAI(true)}>
                            <Sparkles size={18} />
                        </IconButton>
                    )}
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
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    {flashMessage}
                </div>
            )}

            {topSlot}

            <UpcomingDeadlinesBanner onOpenSchool={onNavigate ? () => onNavigate('school') : undefined} />

            {/* Capture inbox — sort newly captured tasks into their destinations */}
            {inboxCount > 0 && (
                <button
                    onClick={() => setShowTriage(true)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-left transition-colors hover:bg-indigo-100"
                >
                    <span className="flex items-center gap-2">
                        <Sparkles size={16} className="text-indigo-600" />
                        <span className="text-sm font-medium text-indigo-900">
                            {inboxCount} captured {inboxCount === 1 ? 'task' : 'tasks'} to sort
                        </span>
                    </span>
                    <span className="text-xs font-semibold text-indigo-700">Sort now →</span>
                </button>
            )}

            {/* Quick capture */}
            <div>
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
                            kind: draft.kind,
                            // An explicit kind means the user already sorted it — skip the
                            // triage inbox. A bare capture stays untriaged for the morning router.
                            triagedAt: draft.kind ? new Date().toISOString() : undefined,
                        });
                    }}
                />
            </div>

            {/* Filters */}
            {activeTasks.length > 0 && (
                <>
                <div className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-4 lg:hidden">
                    {[
                        { label: 'All', active: view === 'type' && filter.typeId === 'all' && filter.energy === 'all', onClick: () => { setFilter({ typeId: 'all', energy: 'all' }); setOnlyKind(null); setView('type'); } },
                        { label: 'Urgent', active: view === 'kind' && onlyKind === 'urgent', onClick: () => { setOnlyKind('urgent'); setView('kind'); } },
                        { label: 'Today', active: view === 'schedule', onClick: () => { setOnlyKind(null); setView('schedule'); } },
                        { label: 'Someday', active: view === 'kind' && onlyKind === 'backlog', onClick: () => { setOnlyKind('backlog'); setView('kind'); } },
                        { label: 'Done', active: false, onClick: () => { setOnlyKind(null); setView('type'); } },
                    ].map(chip => (
                        <button
                            key={chip.label}
                            onClick={chip.onClick}
                            className={`whitespace-nowrap rounded-full border px-5 py-2 text-sm font-medium transition-colors ${
                                chip.active
                                    ? 'border-indigo-800 bg-indigo-800 text-white'
                                    : 'border-slate-200 bg-white text-slate-600'
                            }`}
                        >
                            {chip.label}
                        </button>
                    ))}
                </div>
                <div className="hidden lg:block">
                    <TaskFilters
                        taskTypes={taskTypes}
                        activeTasks={activeTasks}
                        filter={filter}
                        onChange={setFilter}
                    />
                </div>
                </>
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
                <div className="space-y-3 lg:max-w-4xl">
                    {taskTypes.map(type => (
                        <TypeSection
                            key={type.id}
                            taskType={type}
                            tasks={byType.groups.get(type.id) || []}
                            allTaskTypes={taskTypes}
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
                            allTaskTypes={taskTypes}
                            selectedIds={selectedIds}
                            topPickId={topPickId}
                            onToggleSelect={toggleSelected}
                            onToggleComplete={toggleTask}
                            onDelete={deleteTask}
                            onUpdate={updateTask}
                        />
                    )}
                </div>
            ) : view === 'kind' ? (
                <div className="space-y-4 lg:max-w-4xl">
                    {TASK_KIND_ORDER.filter(k => !onlyKind || k === onlyKind).map(kind => {
                        const tasks = byKind.get(kind) || [];
                        if (tasks.length === 0) return null;
                        const meta = TASK_KIND_META[kind];
                        return (
                            <section key={kind} className="space-y-1.5">
                                <div className="flex items-center gap-2 pl-1">
                                    <span>{meta.emoji}</span>
                                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">{meta.label}</h2>
                                    <span className="text-xs text-slate-400">({tasks.length})</span>
                                    <span className="hidden text-xs text-slate-400 sm:inline">· {meta.description}</span>
                                </div>
                                <div className="space-y-1.5">
                                    {tasks.map(t => (
                                        <TaskCard
                                            key={t.id}
                                            task={t}
                                            taskType={t.taskTypeId ? typesById.get(t.taskTypeId) : undefined}
                                            allTaskTypes={taskTypes}
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
                    {onlyKind && (
                        <button onClick={() => setOnlyKind(null)} className="pl-1 text-xs font-medium text-indigo-600 hover:underline">
                            Show all kinds
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-4 lg:max-w-4xl">
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
                                            allTaskTypes={taskTypes}
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
            {showOrganizeAI && (
                <AIOrganizeModal
                    candidates={organizeCandidates}
                    taskTypes={taskTypes}
                    onApply={(updated) => {
                        updated.forEach(updateTask);
                        setFlashMessage(`Organized ${updated.length} ${updated.length === 1 ? 'task' : 'tasks'}`);
                    }}
                    onClose={() => setShowOrganizeAI(false)}
                />
            )}
            <RoutinePicker
                isOpen={showRoutines}
                onClose={() => setShowRoutines(false)}
                onRan={(count) => setFlashMessage(`Added ${count} ${count === 1 ? 'task' : 'tasks'} for today`)}
            />

            {showTriage && (
                <div
                    className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
                    onClick={() => setShowTriage(false)}
                >
                    <div
                        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                            <div className="flex items-center gap-2">
                                <Sparkles size={18} className="text-indigo-500" />
                                <h2 className="text-base font-semibold text-slate-900">Sort your inbox</h2>
                            </div>
                            <button onClick={() => setShowTriage(false)} className="app-icon-button" aria-label="Close">
                                <X size={18} />
                            </button>
                        </header>
                        <div className="flex-1 overflow-y-auto p-5">
                            <TriageInbox
                                onDone={(n) => {
                                    setShowTriage(false);
                                    if (n > 0) setFlashMessage(`Sorted ${n} ${n === 1 ? 'task' : 'tasks'}`);
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ViewToggle: React.FC<{ view: ViewMode; onChange: (v: ViewMode) => void }> = ({ view, onChange }) => (
    <div className="mr-1 flex rounded-lg border border-slate-200 bg-slate-100/80 p-0.5">
        <button
            onClick={() => onChange('kind')}
            title="Group by kind"
            className={`rounded p-1.5 ${view === 'kind' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
            <Flame size={16} />
        </button>
        <button
            onClick={() => onChange('type')}
            title="Group by type"
            className={`rounded p-1.5 ${view === 'type' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
            <LayoutGrid size={16} />
        </button>
        <button
            onClick={() => onChange('schedule')}
            title="Group by schedule"
            className={`rounded p-1.5 ${view === 'schedule' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
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
        className="app-icon-button"
    >
        {children}
    </button>
);

export default TodoPage;
