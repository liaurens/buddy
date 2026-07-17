import React, { useState } from 'react';
import {
    Pencil,
    Trash2,
    Archive,
    ArchiveRestore,
    ChevronDown,
    ChevronRight,
    Plus,
    Check,
    Clock,
} from 'lucide-react';
import { format } from 'date-fns';
import type { SchoolClass, Assignment } from '../../../services/supabase/converters/school';
import { CourseDocsPanel } from './CourseDocsPanel';

interface ClassListProps {
    classes: SchoolClass[];
    assignments: Assignment[];
    onEdit: (c: SchoolClass) => void;
    onArchive: (c: SchoolClass) => void;
    onDelete: (c: SchoolClass) => void;
    onAddAssignment?: (classId: string) => void;
    onEditAssignment?: (a: Assignment) => void;
    onCompleteAssignment?: (a: Assignment) => void;
}

const STATUS_LABELS: Record<string, string> = {
    pending: 'Pending',
    in_progress: 'In progress',
    submitted: 'Submitted',
    graded: 'Graded',
};

export const ClassList: React.FC<ClassListProps> = ({
    classes,
    assignments,
    onEdit,
    onArchive,
    onDelete,
    onAddAssignment,
    onEditAssignment,
    onCompleteAssignment,
}) => {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    if (classes.length === 0) {
        return (
            <div className="rounded-[18px] bg-white px-4 py-12 text-center text-[13.5px] font-semibold text-cove-muted shadow-cove">
                No classes yet. Add one to get started.
            </div>
        );
    }

    const openCount = (id: string) =>
        assignments.filter(
            (a) => a.classId === id && (a.status === 'pending' || a.status === 'in_progress'),
        ).length;
    const overdueCount = (id: string) =>
        assignments.filter(
            (a) =>
                a.classId === id &&
                (a.status === 'pending' || a.status === 'in_progress') &&
                new Date(a.deadline) < new Date(),
        ).length;

    const classAssignments = (id: string) =>
        assignments
            .filter((a) => a.classId === id)
            .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

    return (
        <ul className="space-y-3">
            {classes.map((c) => {
                const expanded = expandedId === c.id;
                const classAss = classAssignments(c.id);
                return (
                    <li key={c.id} className="app-surface overflow-hidden">
                        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
                            <button
                                type="button"
                                onClick={() => setExpandedId(expanded ? null : c.id)}
                                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cove-accent"
                                aria-expanded={expanded}
                            >
                                <span
                                    className="h-12 w-2 flex-shrink-0 rounded-full"
                                    style={{ backgroundColor: c.color }}
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="min-w-0 truncate text-[14.5px] font-extrabold text-cove-ink">
                                            {c.name}
                                        </h3>
                                        {c.archived && (
                                            <span className="rounded-full bg-cove-track px-2 py-1 text-[11px] font-extrabold text-cove-muted">
                                                Archived
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-semibold text-cove-muted">
                                        <span className="truncate">
                                            {[c.instructor, c.term].filter(Boolean).join(' · ') ||
                                                'No instructor or term'}
                                        </span>
                                        <span
                                            className={
                                                openCount(c.id) > 0
                                                    ? 'font-bold text-cove-accent'
                                                    : 'text-cove-soft'
                                            }
                                        >
                                            {openCount(c.id)} open
                                        </span>
                                        {overdueCount(c.id) > 0 && (
                                            <span className="font-bold text-cove-pink">
                                                {overdueCount(c.id)} overdue
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {expanded ? (
                                    <ChevronDown
                                        size={18}
                                        className="flex-shrink-0 text-cove-soft"
                                    />
                                ) : (
                                    <ChevronRight
                                        size={18}
                                        className="flex-shrink-0 text-cove-soft"
                                    />
                                )}
                            </button>
                            <div className="flex items-center justify-end gap-1">
                                <button
                                    type="button"
                                    onClick={() => onArchive(c)}
                                    title={c.archived ? 'Unarchive' : 'Archive'}
                                    aria-label={`${c.archived ? 'Unarchive' : 'Archive'} ${c.name}`}
                                    className="flex h-11 w-11 items-center justify-center rounded-xl text-cove-soft transition-colors hover:bg-[#eef6fa] hover:text-cove-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cove-accent"
                                >
                                    {c.archived ? (
                                        <ArchiveRestore size={18} />
                                    ) : (
                                        <Archive size={18} />
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onEdit(c)}
                                    aria-label={`Edit ${c.name}`}
                                    className="flex h-11 w-11 items-center justify-center rounded-xl text-cove-soft transition-colors hover:bg-cove-tint-blue hover:text-cove-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cove-accent"
                                >
                                    <Pencil size={18} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onDelete(c)}
                                    aria-label={`Delete ${c.name}`}
                                    className="flex h-11 w-11 items-center justify-center rounded-xl text-cove-soft transition-colors hover:bg-cove-tint-pink hover:text-cove-pink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cove-pink"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>

                        {expanded && (
                            <div className="space-y-3 border-t border-cove-border/50 bg-[#eef6fa] px-4 py-4">
                                <CourseDocsPanel classId={c.id} />
                                {classAss.length === 0 ? (
                                    <p className="rounded-xl bg-white px-3 py-4 text-sm font-semibold text-cove-muted shadow-cove">
                                        No assignments yet.
                                    </p>
                                ) : (
                                    <ul className="space-y-2">
                                        {classAss.map((a) => {
                                            const isDone =
                                                a.status === 'submitted' || a.status === 'graded';
                                            const deadline = new Date(a.deadline);
                                            const overdue = !isDone && deadline < new Date();
                                            return (
                                                <li
                                                    key={a.id}
                                                    className={`flex items-start gap-3 rounded-xl px-3 py-3 transition-colors ${
                                                        overdue
                                                            ? 'bg-cove-tint-pink'
                                                            : isDone
                                                              ? 'bg-cove-tint-green'
                                                              : 'bg-white shadow-cove'
                                                    }`}
                                                >
                                                    {onCompleteAssignment && !isDone && (
                                                        <button
                                                            type="button"
                                                            onClick={() => onCompleteAssignment(a)}
                                                            className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border-2 border-cove-border transition-colors hover:border-cove-success hover:bg-cove-tint-green focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cove-success-deep"
                                                            title="Mark submitted"
                                                            aria-label={`Mark ${a.title} submitted`}
                                                        />
                                                    )}
                                                    {isDone && (
                                                        <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border-2 border-cove-success bg-cove-tint-green">
                                                            <Check
                                                                size={15}
                                                                className="text-cove-success-deep"
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <p
                                                            className={`text-sm font-bold leading-5 ${isDone ? 'text-cove-muted line-through' : 'text-cove-ink'}`}
                                                        >
                                                            {a.title}
                                                        </p>
                                                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                                                            <span
                                                                className={`flex items-center gap-1 text-[13px] font-semibold ${overdue ? 'font-bold text-cove-pink' : 'text-cove-muted'}`}
                                                            >
                                                                <Clock size={14} />
                                                                {format(deadline, 'MMM d, HH:mm')}
                                                                {overdue && ' - overdue'}
                                                            </span>
                                                            {a.estimatedMinutes && (
                                                                <span className="text-[13px] font-semibold text-cove-muted">
                                                                    {a.estimatedMinutes}m
                                                                </span>
                                                            )}
                                                            <span className="text-[13px] font-semibold text-cove-muted">
                                                                {STATUS_LABELS[a.status] ??
                                                                    a.status}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {onEditAssignment && (
                                                        <button
                                                            type="button"
                                                            onClick={() => onEditAssignment(a)}
                                                            aria-label={`Edit ${a.title}`}
                                                            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-cove-soft transition-colors hover:bg-cove-tint-blue hover:text-cove-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cove-accent"
                                                        >
                                                            <Pencil size={16} />
                                                        </button>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                                {onAddAssignment && (
                                    <button
                                        type="button"
                                        onClick={() => onAddAssignment(c.id)}
                                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-cove-border bg-white py-2 text-sm font-extrabold text-cove-accent transition-colors hover:bg-cove-tint-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cove-accent"
                                    >
                                        <Plus size={16} /> Add assignment
                                    </button>
                                )}
                            </div>
                        )}
                    </li>
                );
            })}
        </ul>
    );
};
