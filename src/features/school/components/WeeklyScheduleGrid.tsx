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
            <div className="text-center py-12 text-slate-400 text-sm">
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
                    <section key={day}>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{DAYS[i]}</h3>
                        <ul className="space-y-2">
                            {list.map(s => {
                                const cls = classMap.get(s.classId);
                                return (
                                    <li key={s.id} className="flex items-center gap-3 px-3 py-2.5 bg-white rounded-xl border border-slate-100 shadow-sm">
                                        <span className="w-1 h-10 rounded-full" style={{ backgroundColor: cls?.color ?? '#94a3b8' }} />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-slate-900 truncate">{cls?.name ?? 'Unknown'}</div>
                                            <div className="text-xs text-slate-500 truncate">
                                                {s.startTime.slice(0, 5)} – {s.endTime.slice(0, 5)}
                                                {s.location ? ` · ${s.location}` : ''}
                                            </div>
                                        </div>
                                        {onDelete && (
                                            <button onClick={() => onDelete(s)}
                                                className="p-1.5 text-slate-400 hover:text-red-600">
                                                <Trash2 size={16} />
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
