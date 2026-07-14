import React from 'react';
import {
    ArrowRight,
    Calendar as CalendarIcon,
    Check,
    CheckCircle2,
    Clock3,
    GraduationCap,
    Target,
} from 'lucide-react';
import { differenceInCalendarDays, format, isPast, isToday, isTomorrow } from 'date-fns';
import { useNextUp } from '../hooks/useNextUp';
import { useTasks } from '../../tasks/hooks/useTasks';
import type { AppRoute } from '../../../constants/routes';
import type { Task } from '../../tasks/types';
import { parseDueDate } from '../../tasks/utils/dueDates';

interface Props {
    onNavigate: (tab: AppRoute, params?: Record<string, unknown>) => void;
}

const NextUpCard: React.FC<Props> = ({ onNavigate }) => {
    const next = useNextUp();
    const { toggleTask } = useTasks();

    if (next.kind === 'none') {
        return (
            <section className="app-surface p-5">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-950">Next up</h2>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-4 text-slate-500">
                    <CheckCircle2 size={20} />
                    <p className="text-sm">
                        Nothing scheduled. Capture a task above to get started.
                    </p>
                </div>
            </section>
        );
    }

    if (next.kind === 'task' && next.task) {
        const t = next.task;
        const task = t.task;
        const meta = taskMetaLabel(task, t.reason);
        const chip = task.labels?.[0] || task.context || task.priority || 'Deep work';
        return (
            <section className="app-surface p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-950">Next up</h2>
                    <button
                        type="button"
                        onClick={() => onNavigate('tasks')}
                        className="text-slate-400 transition-colors hover:text-slate-700"
                        aria-label="Open tasks"
                    >
                        <Target size={19} />
                    </button>
                </div>

                <div className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-600">
                    <Clock3 size={15} className="text-slate-500" />
                    <span>{meta}</span>
                </div>

                <div className="flex items-start gap-4">
                    <button
                        type="button"
                        onClick={() => toggleTask(task.id)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-transparent transition-colors hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-600"
                        aria-label="Mark task done"
                    >
                        <Check size={16} />
                    </button>

                    <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-xl font-semibold leading-tight text-slate-950">
                            {t.subtask?.title || task.title}
                        </p>
                        {t.subtask && (
                            <p className="mt-1 truncate text-sm text-slate-500">
                                From {task.title}
                            </p>
                        )}
                        <div className="mt-4 inline-flex rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-medium capitalize text-indigo-800">
                            {chip}
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                            <button
                                onClick={() => toggleTask(task.id)}
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-950 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(30,41,99,0.18)] transition-colors hover:bg-indigo-900"
                            >
                                <Check size={15} /> Mark done
                            </button>
                            <button
                                onClick={() => onNavigate('tasks')}
                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                            >
                                <ArrowRight size={15} /> All tasks
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    if (next.kind === 'assignment' && next.assignment) {
        const a = next.assignment;
        const deadline = new Date(a.deadline);
        return (
            <section className="app-surface p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-950">Next up</h2>
                    <GraduationCap size={19} className="text-slate-400" />
                </div>

                <div
                    className={`mb-3 flex items-center gap-2 text-xs font-medium ${isPast(deadline) ? 'text-rose-600' : 'text-slate-600'}`}
                >
                    <Clock3
                        size={15}
                        className={isPast(deadline) ? 'text-rose-500' : 'text-slate-500'}
                    />
                    <span>{assignmentDeadlineLabel(deadline)}</span>
                </div>

                <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-400">
                        <GraduationCap size={16} />
                    </div>

                    <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-xl font-semibold leading-tight text-slate-950">
                            {a.title}
                        </p>
                        <div className="mt-4 inline-flex rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                            School assignment
                        </div>

                        <div className="mt-5">
                            <button
                                onClick={() => onNavigate('school')}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-950 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(30,41,99,0.18)] transition-colors hover:bg-indigo-900 sm:w-auto"
                            >
                                <GraduationCap size={15} /> Open school
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    if (next.kind === 'event' && next.event) {
        const e = next.event;
        const startsAt = format(new Date(e.startTime), 'h:mm a');
        const endsAt = e.endTime ? format(new Date(e.endTime), 'h:mm a') : null;
        return (
            <section className="app-surface p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-950">Next up</h2>
                    <CalendarIcon size={19} className="text-slate-400" />
                </div>

                <div className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-600">
                    <Clock3 size={15} className="text-slate-500" />
                    <span>
                        {startsAt}
                        {endsAt ? ` - ${endsAt}` : ''}
                    </span>
                </div>

                <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-400">
                        <CalendarIcon size={16} />
                    </div>

                    <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-xl font-semibold leading-tight text-slate-950">
                            {e.title}
                        </p>
                        {e.location && (
                            <p className="mt-1 truncate text-sm text-slate-500">{e.location}</p>
                        )}

                        <div className="mt-5">
                            <button
                                onClick={() => onNavigate('calendar')}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 sm:w-auto"
                            >
                                Open calendar
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    return null;
};

function assignmentDeadlineLabel(deadline: Date): string {
    if (Number.isNaN(deadline.getTime())) return 'Deadline unknown';
    if (isPast(deadline) && !isToday(deadline)) {
        return `Overdue — was due ${format(deadline, 'MMM d')}`;
    }
    if (isToday(deadline)) return `Due today, ${format(deadline, 'h:mm a')}`;
    if (isTomorrow(deadline)) return 'Due tomorrow';
    const daysLeft = differenceInCalendarDays(deadline, new Date());
    return `Due ${format(deadline, 'MMM d')} — ${daysLeft} days left`;
}

function taskMetaLabel(task: Task, reason: string): string {
    const parts: string[] = [];

    if (task.dueDate) {
        const due = parseDueDate(task.dueDate);
        if (!Number.isNaN(due.getTime())) {
            const day = isToday(due)
                ? 'Today'
                : isTomorrow(due)
                  ? 'Tomorrow'
                  : format(due, 'MMM d');
            parts.push(task.dueTime ? `${day}, ${task.dueTime}` : day);
        }
    }

    if (task.estimatedTime) {
        parts.push(`${task.estimatedTime} min`);
    }

    if (parts.length === 0 && reason) {
        parts.push(reason);
    }

    return parts.join(' - ') || 'Ready when you are';
}

export default NextUpCard;
