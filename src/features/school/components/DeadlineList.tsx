import React, { useState } from 'react';
import { Check, Clock, ListChecks, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import type { Assignment, SchoolClass } from '../../../services/supabase/converters/school';

interface DeadlineListProps {
    assignments: Assignment[];
    classes: SchoolClass[];
    onEdit?: (a: Assignment) => void;
    onComplete?: (a: Assignment) => void;
    onDelete?: (a: Assignment) => void;
    onCheckpoints?: (a: Assignment) => void;
}

const STATUS_LABEL: Record<Assignment['status'], string> = {
    pending: 'Pending',
    in_progress: 'In progress',
    submitted: 'Submitted',
    graded: 'Graded',
};

function bucketLabel(deadline: Date, now: Date): string {
    const startOfDay = (d: Date) => {
        const x = new Date(d);
        x.setHours(0, 0, 0, 0);
        return x;
    };
    const diff = Math.floor(
        (startOfDay(deadline).getTime() - startOfDay(now).getTime()) / 86_400_000,
    );
    if (deadline < now) return 'Overdue';
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff <= 7) return 'This week';
    if (diff <= 30) return 'This month';
    return 'Later';
}

const BUCKET_ORDER = ['Overdue', 'Today', 'Tomorrow', 'This week', 'This month', 'Later'];

type DeadlineFilter = 'open' | 'due_soon' | 'overdue' | 'submitted' | 'all';

const FILTER_LABELS: Record<DeadlineFilter, string> = {
    open: 'Open',
    due_soon: 'Due soon',
    overdue: 'Overdue',
    submitted: 'Submitted',
    all: 'All',
};

function isDone(a: Assignment): boolean {
    return a.status === 'submitted' || a.status === 'graded';
}

function matchesFilter(a: Assignment, filter: DeadlineFilter, now: Date): boolean {
    const deadline = new Date(a.deadline);
    if (filter === 'all') return true;
    if (filter === 'submitted') return isDone(a);
    if (filter === 'overdue') return !isDone(a) && deadline < now;
    if (filter === 'due_soon') {
        const week = new Date(now);
        week.setDate(now.getDate() + 7);
        return !isDone(a) && deadline >= now && deadline <= week;
    }
    return !isDone(a);
}

export const DeadlineList: React.FC<DeadlineListProps> = ({
    assignments,
    classes,
    onEdit,
    onComplete,
    onDelete,
    onCheckpoints,
}) => {
    const [filter, setFilter] = useState<DeadlineFilter>('open');
    const now = new Date();
    const classMap = new Map(classes.map((c) => [c.id, c]));
    const filtered = assignments.filter((a) => matchesFilter(a, filter, now));

    const buckets = new Map<string, Assignment[]>();
    for (const a of filtered) {
        const b = bucketLabel(new Date(a.deadline), now);
        const list = buckets.get(b) ?? [];
        list.push(a);
        buckets.set(b, list);
    }

    return (
        <div className="space-y-5">
            <div className="app-surface p-2">
                <div className="flex gap-2 overflow-x-auto">
                    {(Object.keys(FILTER_LABELS) as DeadlineFilter[]).map((value) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setFilter(value)}
                            aria-pressed={filter === value}
                            className={`min-h-11 whitespace-nowrap rounded-full px-4 py-2 text-[12.5px] font-extrabold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cove-accent ${
                                filter === value
                                    ? 'bg-cove-accent text-white shadow-cove'
                                    : 'text-cove-muted hover:bg-[#eef6fa] hover:text-cove-ink'
                            }`}
                        >
                            {FILTER_LABELS[value]}
                        </button>
                    ))}
                </div>
            </div>

            {buckets.size === 0 ? (
                <div className="rounded-[18px] bg-white px-4 py-12 text-center text-[13.5px] font-semibold text-cove-muted shadow-cove">
                    No deadlines match this filter.
                </div>
            ) : null}

            {BUCKET_ORDER.filter((b) => buckets.has(b)).map((b) => (
                <section key={b} className="app-surface p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <h3
                            className={`text-[14.5px] font-extrabold ${
                                b === 'Overdue' ? 'text-cove-pink' : 'text-cove-ink'
                            }`}
                        >
                            {b}
                        </h3>
                        <span className="rounded-full bg-cove-track px-2.5 py-1 text-[11px] font-extrabold text-cove-muted">
                            {buckets.get(b)!.length}
                        </span>
                    </div>
                    <ul className="space-y-2.5">
                        {buckets.get(b)!.map((a) => {
                            const cls = classMap.get(a.classId);
                            const deadline = new Date(a.deadline);
                            const done = isDone(a);
                            const overdue = !done && deadline < now;
                            return (
                                <li
                                    key={a.id}
                                    className={`flex flex-col gap-3 rounded-xl px-3 py-3 transition-colors sm:flex-row sm:items-center ${
                                        overdue
                                            ? 'bg-cove-tint-pink'
                                            : done
                                              ? 'bg-cove-tint-green'
                                              : 'bg-[#eef6fa] hover:bg-cove-tint-blue'
                                    }`}
                                >
                                    <div className="flex min-w-0 flex-1 items-start gap-3">
                                        <span
                                            className="mt-1 h-12 w-1.5 flex-shrink-0 rounded-full"
                                            style={{ backgroundColor: cls?.color ?? '#9cb9c9' }}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p
                                                    className={`min-w-0 text-[14.5px] font-extrabold leading-6 ${done ? 'text-cove-muted line-through' : 'text-cove-ink'}`}
                                                >
                                                    {a.title}
                                                </p>
                                                {a.status !== 'pending' && (
                                                    <span
                                                        className={`rounded-full px-2 py-1 text-[11px] font-extrabold ${
                                                            done
                                                                ? 'bg-cove-tint-green text-cove-success-deep'
                                                                : 'bg-cove-tint-blue text-cove-accent'
                                                        }`}
                                                    >
                                                        {STATUS_LABEL[a.status]}
                                                    </span>
                                                )}
                                                {overdue && (
                                                    <span className="rounded-full bg-white/70 px-2 py-1 text-[11px] font-extrabold text-cove-pink">
                                                        Overdue
                                                    </span>
                                                )}
                                            </div>
                                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-semibold text-cove-muted">
                                                <span className="font-bold text-cove-muted">
                                                    {cls?.name ?? 'Unknown class'}
                                                </span>
                                                <span
                                                    className={`inline-flex items-center gap-1.5 ${overdue ? 'font-bold text-cove-pink' : ''}`}
                                                >
                                                    <Clock
                                                        size={15}
                                                        className={
                                                            overdue
                                                                ? 'text-cove-pink'
                                                                : 'text-cove-soft'
                                                        }
                                                    />
                                                    {format(deadline, 'EEE, MMM d, h:mm a')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-end gap-1 sm:flex-shrink-0">
                                        {onCheckpoints &&
                                            a.checkpoints &&
                                            a.checkpoints.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => onCheckpoints(a)}
                                                    title="Checkpoints"
                                                    aria-label={`Open checkpoints for ${a.title}`}
                                                    className="flex h-11 w-11 items-center justify-center rounded-xl text-cove-soft transition-colors hover:bg-cove-tint-blue hover:text-cove-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cove-accent"
                                                >
                                                    <ListChecks size={18} />
                                                </button>
                                            )}
                                        {onComplete && !done && (
                                            <button
                                                type="button"
                                                onClick={() => onComplete(a)}
                                                title="Mark submitted"
                                                aria-label={`Mark ${a.title} submitted`}
                                                className="flex h-11 w-11 items-center justify-center rounded-xl text-cove-soft transition-colors hover:bg-cove-tint-green hover:text-cove-success-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cove-success-deep"
                                            >
                                                <Check size={18} />
                                            </button>
                                        )}
                                        {onEdit && (
                                            <button
                                                type="button"
                                                onClick={() => onEdit(a)}
                                                title="Edit"
                                                aria-label={`Edit ${a.title}`}
                                                className="flex h-11 w-11 items-center justify-center rounded-xl text-cove-soft transition-colors hover:bg-cove-tint-blue hover:text-cove-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cove-accent"
                                            >
                                                <Pencil size={18} />
                                            </button>
                                        )}
                                        {onDelete && (
                                            <button
                                                type="button"
                                                onClick={() => onDelete(a)}
                                                title="Delete"
                                                aria-label={`Delete ${a.title}`}
                                                className="flex h-11 w-11 items-center justify-center rounded-xl text-cove-soft transition-colors hover:bg-cove-tint-pink hover:text-cove-pink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cove-pink"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            ))}
        </div>
    );
};
