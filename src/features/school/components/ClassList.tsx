import React, { useState } from 'react';
import { Pencil, Trash2, Archive, ArchiveRestore, ChevronDown, ChevronRight, Plus, Check, Clock } from 'lucide-react';
import { format } from 'date-fns';
import type { SchoolClass, Assignment } from '../../../services/supabase/converters/school';

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
            <div className="text-center py-12 text-slate-400 text-sm">
                No classes yet. Add one to get started.
            </div>
        );
    }

    const openCount = (id: string) => assignments.filter(a =>
        a.classId === id && (a.status === 'pending' || a.status === 'in_progress')
    ).length;

    const classAssignments = (id: string) => assignments
        .filter(a => a.classId === id)
        .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

    return (
        <ul className="space-y-2">
            {classes.map(c => {
                const expanded = expandedId === c.id;
                const classAss = classAssignments(c.id);
                return (
                    <li key={c.id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                        {/* Class header row */}
                        <div className="flex items-center gap-3 px-3 py-3">
                            <span className="w-2 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                            <button
                                onClick={() => setExpandedId(expanded ? null : c.id)}
                                className="flex-1 min-w-0 flex items-center gap-2 text-left"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-slate-900 truncate">
                                        {c.name}{c.archived && <span className="ml-2 text-xs text-slate-400">(archived)</span>}
                                    </div>
                                    <div className="text-xs text-slate-500 truncate">
                                        {[c.instructor, c.term].filter(Boolean).join(' · ') || '—'}
                                        {' · '}
                                        <span className={openCount(c.id) > 0 ? 'text-indigo-600 font-medium' : ''}>
                                            {openCount(c.id)} open
                                        </span>
                                    </div>
                                </div>
                                {expanded
                                    ? <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />
                                    : <ChevronRight size={16} className="text-slate-400 flex-shrink-0" />
                                }
                            </button>
                            <button onClick={() => onArchive(c)} title={c.archived ? 'Unarchive' : 'Archive'}
                                className="p-1.5 text-slate-400 hover:text-slate-600">
                                {c.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                            </button>
                            <button onClick={() => onEdit(c)} className="p-1.5 text-slate-400 hover:text-indigo-600">
                                <Pencil size={16} />
                            </button>
                            <button onClick={() => onDelete(c)} className="p-1.5 text-slate-400 hover:text-red-600">
                                <Trash2 size={16} />
                            </button>
                        </div>

                        {/* Expanded: assignments list */}
                        {expanded && (
                            <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3 space-y-2">
                                {classAss.length === 0 ? (
                                    <p className="text-xs text-slate-400 py-1">No assignments yet.</p>
                                ) : (
                                    <ul className="space-y-1.5">
                                        {classAss.map(a => {
                                            const isDone = a.status === 'submitted' || a.status === 'graded';
                                            const deadline = new Date(a.deadline);
                                            const overdue = !isDone && deadline < new Date();
                                            return (
                                                <li key={a.id}
                                                    className="flex items-start gap-2 p-2 rounded-lg bg-white border border-slate-100 hover:border-slate-200 transition-colors">
                                                    {onCompleteAssignment && !isDone && (
                                                        <button
                                                            onClick={() => onCompleteAssignment(a)}
                                                            className="w-5 h-5 mt-0.5 rounded border-2 border-slate-300 hover:border-emerald-500 flex items-center justify-center flex-shrink-0 transition-colors"
                                                            title="Mark submitted"
                                                        />
                                                    )}
                                                    {isDone && (
                                                        <div className="w-5 h-5 mt-0.5 rounded border-2 border-emerald-400 bg-emerald-50 flex items-center justify-center flex-shrink-0">
                                                            <Check size={11} className="text-emerald-600" />
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-xs font-medium truncate ${isDone ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                                            {a.title}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className={`text-[10px] flex items-center gap-0.5 ${overdue ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
                                                                <Clock size={9} />
                                                                {format(deadline, 'MMM d, HH:mm')}
                                                                {overdue && ' — overdue'}
                                                            </span>
                                                            {a.estimatedMinutes && (
                                                                <span className="text-[10px] text-slate-400">{a.estimatedMinutes}m</span>
                                                            )}
                                                            <span className="text-[10px] text-slate-400">
                                                                {STATUS_LABELS[a.status] ?? a.status}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {onEditAssignment && (
                                                        <button
                                                            onClick={() => onEditAssignment(a)}
                                                            className="p-1 text-slate-300 hover:text-indigo-500 flex-shrink-0 transition-colors"
                                                        >
                                                            <Pencil size={12} />
                                                        </button>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                                {onAddAssignment && (
                                    <button
                                        onClick={() => onAddAssignment(c.id)}
                                        className="w-full flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg border border-dashed border-indigo-200 transition-colors"
                                    >
                                        <Plus size={12} /> Add assignment
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
