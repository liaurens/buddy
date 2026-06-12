import React from 'react';
import { Trash2 } from 'lucide-react';
import type { ClassSession, SchoolClass } from '../../../services/supabase/converters/school';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_INDEX = [1, 2, 3, 4, 5, 6, 0];

interface WeeklyScheduleGridProps {
    sessions: ClassSession[];
    classes: SchoolClass[];
    onDelete?: (s: ClassSession) => void;
}

export const WeeklyScheduleGrid: React.FC<WeeklyScheduleGridProps> = ({ sessions, classes, onDelete }) => {
    const classMap = new Map(classes.map(c => [c.id, c]));

    const byDay = new Map<number, ClassSession[]>();
    for (const s of sessions) {
        const list = byDay.get(s.dayOfWeek) ?? [];
        list.push(s);
        byDay.set(s.dayOfWeek, list);
    }
    for (const list of byDay.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (sessions.length === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
                No class times yet.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {DAY_INDEX.map((day, i) => {
                const list = byDay.get(day) ?? [];
                if (list.length === 0) return null;
                return (
                    <section key={day} className="app-surface p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <h3 className="text-sm font-semibold text-slate-950">{DAYS[i]}</h3>
                            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                {list.length}
                            </span>
                        </div>
                        <ul className="space-y-2.5">
                            {list.map(s => {
                                const cls = classMap.get(s.classId);
                                return (
                                    <li key={s.id} className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-3 py-3 transition-colors hover:border-slate-300">
                                        <span className="h-12 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: cls?.color ?? '#94a3b8' }} />
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-base font-semibold text-slate-950">{cls?.name ?? 'Unknown'}</div>
                                            <div className="mt-1 truncate text-sm text-slate-600">
                                                {s.startTime.slice(0, 5)} – {s.endTime.slice(0, 5)}
                                                {s.location ? ` · ${s.location}` : ''}
                                            </div>
                                        </div>
                                        {onDelete && (
                                            <button
                                                type="button"
                                                onClick={() => onDelete(s)}
                                                aria-label={`Remove ${cls?.name ?? 'class'} at ${s.startTime.slice(0, 5)}`}
                                                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                );
            })}
        </div>
    );
};
