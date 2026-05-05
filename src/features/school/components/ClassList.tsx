import React from 'react';
import { Pencil, Trash2, Archive, ArchiveRestore } from 'lucide-react';
import type { SchoolClass, Assignment } from '../../../services/supabase/converters/school';

interface ClassListProps {
    classes: SchoolClass[];
    assignments: Assignment[];
    onEdit: (c: SchoolClass) => void;
    onArchive: (c: SchoolClass) => void;
    onDelete: (c: SchoolClass) => void;
}

export const ClassList: React.FC<ClassListProps> = ({ classes, assignments, onEdit, onArchive, onDelete }) => {
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

    return (
        <ul className="space-y-2">
            {classes.map(c => (
                <li key={c.id} className="flex items-center gap-3 px-3 py-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                    <span className="w-2 h-10 rounded-full" style={{ backgroundColor: c.color }} />
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
                </li>
            ))}
        </ul>
    );
};
