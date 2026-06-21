import React, { useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
    CheckCircle, Circle, Calendar as CalendarIcon, MapPin, Tag, Sparkles,
    ChevronDown, ChevronRight, Repeat, Bell, Trash2, Plus, MoreHorizontal,
    Clock, Layers,
} from 'lucide-react';
import { format, isPast, isToday, isTomorrow, differenceInCalendarDays, addDays } from 'date-fns';
import type { Task, Subtask, TaskType, TaskEnergy } from '../types';
import { calculateNextDueDate } from '../utils/recurrence';
import { getTypeColors } from '../utils/typeColors';
import AITaskSplitter from './AITaskSplitter';
import SnoozeMenu from './SnoozeMenu';
import PortalMenu from './PortalMenu';

const ENERGY_DOT: Record<TaskEnergy, string> = {
    low: 'bg-emerald-400',
    medium: 'bg-amber-400',
    high: 'bg-rose-500',
};

const ENERGY_LABEL: Record<TaskEnergy, string> = {
    low: 'Low energy',
    medium: 'Medium energy',
    high: 'High energy',
};

function priorityClasses(p?: string): string {
    if (p === 'high' || p === 'urgent') return 'text-rose-500 bg-rose-50';
    if (p === 'low') return 'text-blue-500 bg-blue-50';
    return 'text-amber-500 bg-amber-50';
}

function recurrenceLabel(task: Task): string | null {
    if (!task.recurrence || task.recurrence === 'none') return null;
    const next = calculateNextDueDate(task.dueDate, task.recurrence, task.recurrenceConfig);
    if (!next) return null;
    const d = new Date(next);
    if (isToday(d)) return 'Next: today';
    if (isToday(addDays(d, -1))) return 'Next: tomorrow';
    const diff = differenceInCalendarDays(d, new Date());
    if (diff >= 0 && diff < 7) return `Next: ${format(d, 'EEE')}`;
    return `Next: ${format(d, 'MMM d')}`;
}

function deadlineInfo(dueDate: string): { label: string; className: string } {
    const d = new Date(dueDate);
    if (isPast(d) && !isToday(d)) {
        const days = differenceInCalendarDays(new Date(), d);
        return { label: `${days}d overdue`, className: 'text-rose-600 bg-rose-50 font-bold' };
    }
    if (isToday(d)) return { label: 'Due today', className: 'text-amber-700 bg-amber-50 font-bold' };
    if (isTomorrow(d)) return { label: 'Tomorrow', className: 'text-amber-600 bg-amber-50 font-semibold' };
    const diff = differenceInCalendarDays(d, new Date());
    if (diff <= 7) return { label: `${format(d, 'EEE')} (${diff}d)`, className: 'text-slate-500 bg-slate-50' };
    return { label: format(d, 'MMM d'), className: 'text-slate-400' };
}

export interface TaskCardProps {
    task: Task;
    taskType?: TaskType;
    allTaskTypes?: TaskType[];
    isSelected: boolean;
    isTopPick?: boolean;
    onToggleSelect: (id: string) => void;
    onToggleComplete: (id: string) => void;
    onDelete: (id: string) => void;
    onUpdate: (task: Task) => void;
    showTypeBadge?: boolean;
}

const TaskCard: React.FC<TaskCardProps> = ({
    task,
    taskType,
    allTaskTypes,
    isSelected,
    isTopPick = false,
    onToggleSelect,
    onToggleComplete,
    onDelete,
    onUpdate,
    showTypeBadge = true,
}) => {
    const [expanded, setExpanded] = useState(false);
    const [splitting, setSplitting] = useState(false);
    const [newSubtaskText, setNewSubtaskText] = useState('');
    const [snoozeOpen, setSnoozeOpen] = useState(false);
    const [typeMenuOpen, setTypeMenuOpen] = useState(false);
    const typeBtnRef = useRef<HTMLButtonElement>(null);
    const snoozeBtnRef = useRef<HTMLButtonElement>(null);

    const colors = getTypeColors(taskType?.color);
    const recLabel = recurrenceLabel(task);
    const subtaskCount = task.subtasks?.length ?? 0;
    const subtaskDone = task.subtasks?.filter(st => st.completed).length ?? 0;
    const hasSubtasks = subtaskCount > 0;
    const progress = hasSubtasks ? Math.round((subtaskDone / subtaskCount) * 100) : 0;

    const handleSubtaskToggle = (subtaskId: string) => {
        const updatedSubtasks = task.subtasks?.map(st =>
            st.id === subtaskId ? { ...st, completed: !st.completed } : st
        ) || [];
        const allDone = updatedSubtasks.length > 0 && updatedSubtasks.every(st => st.completed);
        const anyUndone = updatedSubtasks.some(st => !st.completed);
        onUpdate({
            ...task,
            subtasks: updatedSubtasks,
            completed: allDone ? true : (anyUndone ? false : task.completed),
        });
    };

    const handleAddSubtask = () => {
        const text = newSubtaskText.trim();
        if (!text) return;
        const newSubtask: Subtask = { id: uuidv4(), title: text, completed: false };
        onUpdate({ ...task, subtasks: [...(task.subtasks || []), newSubtask] });
        setNewSubtaskText('');
    };

    const handleAISplit = (subtasks: Subtask[]) => {
        onUpdate({ ...task, subtasks });
        setSplitting(false);
        setExpanded(true);
    };

    const handleSnooze = (dueDate: string, dueTime?: string) => {
        onUpdate({ ...task, dueDate, dueTime });
        setSnoozeOpen(false);
    };

    return (
        <div>
            <div
                className={`group border-b border-slate-100 bg-white p-3 transition-all last:border-b-0 hover:bg-slate-50 ${
                    isSelected ? 'ring-1 ring-inset ring-indigo-200'
                    : isTopPick ? 'ring-1 ring-inset ring-indigo-100'
                    : ''
                }`}
            >
                <div className="flex items-start gap-2.5">
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(task.id)}
                        onClick={e => e.stopPropagation()}
                        aria-label={`Select ${task.title}`}
                        className="mt-1.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer flex-shrink-0"
                    />
                    <button
                        onClick={() => onToggleComplete(task.id)}
                        className="mt-0.5 text-slate-300 hover:text-indigo-600 transition-colors flex-shrink-0"
                        aria-label="Mark complete"
                    >
                        <Circle size={22} />
                    </button>

                    {showTypeBadge && taskType?.emoji && (
                        <span className="mt-0.5 text-lg flex-shrink-0" aria-label={taskType.name} title={taskType.name}>
                            {taskType.emoji}
                        </span>
                    )}

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-slate-800 leading-tight">{task.title}</p>
                            {isTopPick && (
                                <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">Top pick</span>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-xs">
                            {task.energy && (
                                <span className="flex items-center gap-1 text-slate-500" title={ENERGY_LABEL[task.energy]}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${ENERGY_DOT[task.energy]}`} />
                                    {task.energy}
                                </span>
                            )}
                            {task.priority && task.priority !== 'medium' && (
                                <span className={`px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${priorityClasses(task.priority)}`}>
                                    {task.priority}
                                </span>
                            )}
                            {task.dueDate && (() => {
                                const { label, className } = deadlineInfo(task.dueDate);
                                return (
                                    <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${className}`}>
                                        <CalendarIcon size={11} />
                                        {label}
                                        {task.dueTime && <span className="flex items-center gap-0.5"><Clock size={9} />{task.dueTime}</span>}
                                    </span>
                                );
                            })()}
                            {task.location && (
                                <span className="flex items-center gap-1 font-medium text-slate-500">
                                    <MapPin size={11} /> {task.location}
                                </span>
                            )}
                            {task.labels && task.labels.length > 0 && task.labels.map(label => (
                                <span key={label} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-medium">
                                    <Tag size={9} /> {label}
                                </span>
                            ))}
                            {hasSubtasks && (
                                <span className="flex items-center gap-1 font-medium text-slate-500">
                                    <Layers size={9} /> {subtaskDone}/{subtaskCount}
                                </span>
                            )}
                            {recLabel && (
                                <span className={`flex items-center gap-1 font-medium px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                                    <Repeat size={9} /> {recLabel}
                                </span>
                            )}
                            {task.reminderEnabled && (
                                <span className="flex items-center gap-1 font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                    <Bell size={9} /> Reminder
                                </span>
                            )}
                        </div>
                        {hasSubtasks && (
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                                <div
                                    className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-0.5 flex-shrink-0 relative">
                        {allTaskTypes && allTaskTypes.length > 0 && (
                            <>
                                <button
                                    ref={typeBtnRef}
                                    onClick={() => { setTypeMenuOpen(o => !o); setSnoozeOpen(false); }}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-indigo-500 transition-all"
                                    title="Assign type"
                                    aria-label="Assign type"
                                >
                                    <Tag size={15} />
                                </button>
                                <PortalMenu
                                    anchorRef={typeBtnRef}
                                    open={typeMenuOpen}
                                    onClose={() => setTypeMenuOpen(false)}
                                    width={192}
                                >
                                    <button
                                        onClick={() => { onUpdate({ ...task, taskTypeId: undefined }); setTypeMenuOpen(false); }}
                                        className={`w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-500 italic ${!task.taskTypeId ? 'bg-indigo-50 text-indigo-600 font-medium not-italic' : ''}`}
                                    >
                                        Uncategorized
                                    </button>
                                    {allTaskTypes.map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => { onUpdate({ ...task, taskTypeId: t.id }); setTypeMenuOpen(false); }}
                                            className={`w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 ${task.taskTypeId === t.id ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-slate-700'}`}
                                        >
                                            {t.emoji && <span>{t.emoji}</span>}
                                            {t.name}
                                        </button>
                                    ))}
                                </PortalMenu>
                            </>
                        )}
                        <button
                            ref={snoozeBtnRef}
                            onClick={() => { setSnoozeOpen(s => !s); setTypeMenuOpen(false); }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-indigo-500 transition-all"
                            title="Reschedule"
                            aria-label="Reschedule"
                        >
                            <MoreHorizontal size={16} />
                        </button>
                        {snoozeOpen && (
                            <SnoozeMenu
                                anchorRef={snoozeBtnRef}
                                onSnooze={handleSnooze}
                                onClose={() => setSnoozeOpen(false)}
                            />
                        )}
                        {(!task.subtasks || task.subtasks.length === 0) && (
                            <button
                                onClick={() => setSplitting(s => !s)}
                                className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-indigo-500 transition-all"
                                title="Split with AI"
                            >
                                <Sparkles size={15} />
                            </button>
                        )}
                        <button
                            onClick={() => setExpanded(e => !e)}
                            className={`p-1.5 text-slate-300 hover:text-indigo-500 transition-colors ${
                                task.subtasks && task.subtasks.length > 0 ? '' : 'opacity-0 group-hover:opacity-100'
                            }`}
                            title={task.subtasks && task.subtasks.length > 0 ? 'Show subtasks' : 'Expand'}
                        >
                            {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </button>
                        <button
                            onClick={() => onDelete(task.id)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-rose-500 transition-opacity"
                            aria-label="Delete"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>

                {expanded && (
                    <div className="ml-9 mt-3 space-y-1.5 border-l-2 border-slate-100 pl-3">
                        {task.subtasks?.map(st => (
                            <button
                                key={st.id}
                                onClick={() => handleSubtaskToggle(st.id)}
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
                                        handleAddSubtask();
                                    }
                                }}
                                placeholder="Add subtask…"
                                className="flex-1 text-sm bg-transparent outline-none text-slate-700 placeholder:text-slate-300"
                            />
                        </div>
                    </div>
                )}
            </div>

            {splitting && (
                <div className="mt-2">
                    <AITaskSplitter
                        task={task}
                        onSplit={handleAISplit}
                        onCancel={() => setSplitting(false)}
                    />
                </div>
            )}
        </div>
    );
};

export default TaskCard;
