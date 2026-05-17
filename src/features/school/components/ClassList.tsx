import React, { useState } from 'react';
import { Pencil, Trash2, Archive, ArchiveRestore, ChevronDown, ChevronRight, Plus, Check, Clock } from 'lucide-react';
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
    classes, assignments, onEdit, onArchive, onDelete,
    onAddAssignment, onEditAssignment, onCompleteAssignment,
}) => {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    if (classes.length === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
                No classes yet. Add one to get started.
            </div>
        );
    }

    const openCount = (id: string) => assignments.filter(a =>
        a.classId === id && (a.status === 'pending' || a.status === 'in_progress')
    ).length;
    const overdueCount = (id: string) => assignments.filter(a =>
        a.classId === id
        && (a.status === 'pending' || a.status === 'in_progress')
        && new Date(a.deadline) < new Date()
    ).length;

    const classAssignments = (id: string) => assignments
        .filter(a => a.classId === id)
        .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

    return (
        <ul className="space-y-3">
            {classes.map(c => {
                const expanded = expandedId === c.id;
                const classAss = classAssignments(c.id);
                return (
                    <li key={c.id} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_16px_42px_rgba(15,23,42,0.05)]">
                        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
                            <button
                                type="button"
                                onClick={() => setExpandedId(expanded ? null : c.id)}
                                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-700"
                                aria-expanded={expanded}
                            >
                                <span className="h-12 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="min-w-0 truncate text-base font-semibold text-slate-950">
                                            {c.name}
                                        </h3>
                                        {c.archived && (
                                            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">
                                                Archived
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                                        <span className="truncate">{[c.instructor, c.term].filter(Boolean).join(' · ') || 'No instructor or term'}</span>
                                        <span className={openCount(c.id) > 0 ? 'font-semibold text-indigo-700' : 'text-slate-500'}>
                                            {openCount(c.id)} open
                                        </span>
                                        {overdueCount(c.id) > 0 && (
                                            <span className="font-semibold text-red-700">{overdueCount(c.id)} overdue</span>
                                        )}
                                    </div>
                                </div>
                                {expanded
                                    ? <ChevronDown size={18} className="flex-shrink-0 text-slate-400" />
                                    : <ChevronRight size={18} className="flex-shrink-0 text-slate-400" />
                                }
                            </button>
                            <div className="flex items-center justify-end gap-1">
                                <button
                                    type="button"
                                    onClick={() => onArchive(c)}
                                    title={c.archived ? 'Unarchive' : 'Archive'}
                                    aria-label={`${c.archived ? 'Unarchive' : 'Archive'} ${c.name}`}
                                    className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
                                >
                                    {c.archived ? <ArchiveRestore size={18} /> : <Archive size={18} />}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onEdit(c)}
                                    aria-label={`Edit ${c.name}`}
                                    className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
                                >
                                    <Pencil size={18} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onDelete(c)}
                                    aria-label={`Delete ${c.name}`}
                                    className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>

                        {expanded && (
                            <div className="space-y-3 border-t border-slate-100 bg-slate-50/70 px-4 py-4">
                                <CourseDocsPanel classId={c.id} />
                                {classAss.length === 0 ? (
                                    <p className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">No assignments yet.</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {classAss.map(a => {
                                            const isDone = a.status === 'submitted' || a.status === 'graded';
                                            const deadline = new Date(a.deadline);
                                            const overdue = !isDone && deadline < new Date();
                                            return (
                                                <li key={a.id}
                                                    className={`flex items-start gap-3 rounded-xl border px-3 py-3 transition-colors ${
                                                        overdue
                                                            ? 'border-red-100 bg-red-50/70'
                                                            : isDone
                                                                ? 'border-emerald-100 bg-emerald-50/60'
                                                                : 'border-slate-200/80 bg-white hover:border-slate-300'
                                                    }`}>
                                                    {onCompleteAssignment && !isDone && (
                                                        <button
                                                            type="button"
                                                            onClick={() => onCompleteAssignment(a)}
                                                            className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border-2 border-slate-300 transition-colors hover:border-emerald-500 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                                                            title="Mark submitted"
                                                            aria-label={`Mark ${a.title} submitted`}
                                                        />
                                                    )}
                                                    {isDone && (
                                                        <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border-2 border-emerald-400 bg-emerald-50">
                                                            <Check size={15} className="text-emerald-700" />
                                                        </div>
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <p className={`text-sm font-semibold leading-5 ${isDone ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                                                            {a.title}
                                                        </p>
                                                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                                                            <span className={`flex items-center gap-1 text-sm ${overdue ? 'font-semibold text-red-700' : 'text-slate-500'}`}>
                                                                <Clock size={14} />
                                                                {format(deadline, 'MMM d, HH:mm')}
                                                                {overdue && ' - overdue'}
                                                            </span>
                                                            {a.estimatedMinutes && (
                                                                <span className="text-sm text-slate-500">{a.estimatedMinutes}m</span>
                                                            )}
                                                            <span className="text-sm text-slate-500">
                                                                {STATUS_LABELS[a.status] ?? a.status}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {onEditAssignment && (
                                                        <button
                                                            type="button"
                                                            onClick={() => onEditAssignment(a)}
                                                            aria-label={`Edit ${a.title}`}
                                                            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
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
                                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-200 bg-white py-2 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
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
