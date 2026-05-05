import React from 'react';
import { Check, Pencil, Trash2 } from 'lucide-react';
import type { Assignment, SchoolClass } from '../../../services/supabase/converters/school';

interface DeadlineListProps {
    assignments: Assignment[];
    classes: SchoolClass[];
    onEdit?: (a: Assignment) => void;
    onComplete?: (a: Assignment) => void;
    onDelete?: (a: Assignment) => void;
}

const STATUS_LABEL: Record<Assignment['status'], string> = {
    pending: 'Pending',
    in_progress: 'In progress',
    submitted: 'Submitted',
    graded: 'Graded',
};

function bucketLabel(deadline: Date, now: Date): string {
    const startOfDay = (d: Date) => {
        const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
    };
    const diff = Math.floor((startOfDay(deadline).getTime() - startOfDay(now).getTime()) / 86_400_000);
    if (deadline < now) return 'Overdue';
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff <= 7) return 'This week';
    if (diff <= 30) return 'This month';
    return 'Later';
}

const BUCKET_ORDER = ['Overdue', 'Today', 'Tomorrow', 'This week', 'This month', 'Later'];

export const DeadlineList: React.FC<DeadlineListProps> = ({ assignments, classes, onEdit, onComplete, onDelete }) => {
    const now = new Date();
    const classMap = new Map(classes.map(c => [c.id, c]));

    const buckets = new Map<string, Assignment[]>();
    for (const a of assignments) {
        if (a.status === 'submitted' || a.status === 'graded') continue;
        const b = bucketLabel(new Date(a.deadline), now);
        const list = buckets.get(b) ?? [];
        list.push(a);
        buckets.set(b, list);
    }

    if (buckets.size === 0) {
        return (
            <div className="text-center py-12 text-slate-400 text-sm">
                No upcoming deadlines.
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {BUCKET_ORDER.filter(b => buckets.has(b)).map(b => (
                <section key={b}>
                    <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${
                        b === 'Overdue' ? 'text-red-600' : 'text-slate-500'
                    }`}>{b}</h3>
                    <ul className="space-y-2">
                        {buckets.get(b)!.map(a => {
                            const cls = classMap.get(a.classId);
                            const deadline = new Date(a.deadline);
                            return (
                                <li key={a.id} className="flex items-center gap-3 px-3 py-2.5 bg-white rounded-xl border border-slate-100 shadow-sm">
                                    <span className="w-1 h-10 rounded-full" style={{ backgroundColor: cls?.color ?? '#94a3b8' }} />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-slate-900 truncate">{a.title}</div>
                                        <div className="text-xs text-slate-500 truncate">
                                            {cls?.name ?? 'Unknown class'} · {deadline.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                            {a.status !== 'pending' && ` · ${STATUS_LABEL[a.status]}`}
                                        </div>
                                    </div>
                                    {onComplete && (
                                        <button onClick={() => onComplete(a)} title="Mark submitted"
                                            className="p-1.5 text-slate-400 hover:text-emerald-600">
                                            <Check size={16} />
                                        </button>
                                    )}
                                    {onEdit && (
                                        <button onClick={() => onEdit(a)} title="Edit"
                                            className="p-1.5 text-slate-400 hover:text-indigo-600">
                                            <Pencil size={16} />
                                        </button>
                                    )}
                                    {onDelete && (
                                        <button onClick={() => onDelete(a)} title="Delete"
                                            className="p-1.5 text-slate-400 hover:text-red-600">
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </section>
            ))}
        </div>
    );
};
