import React, { useState } from 'react';
import { CalendarDays, RotateCcw, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import type { Task } from '../types';

interface SomedayReviewCardProps {
    task: Task;
    userId: string;
    onUpdate: (task: Task) => void;
    onDelete: (id: string) => void;
}

const SomedayReviewCard: React.FC<SomedayReviewCardProps> = ({
    task,
    userId,
    onUpdate,
    onDelete,
}) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const storageKey = `buddy:someday-review:${userId}:${today}`;
    const [reviewed, setReviewed] = useState(() => localStorage.getItem(storageKey) === 'done');
    const [scheduleDate, setScheduleDate] = useState(today);

    if (reviewed) return null;

    const finish = (action: () => void) => {
        action();
        localStorage.setItem(storageKey, 'done');
        setReviewed(true);
    };

    return (
        <section className="border-l-4 border-violet-500 bg-violet-50 px-4 py-3 lg:max-w-4xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase text-violet-700">Someday review</p>
                    <p className="truncate text-sm font-medium text-slate-900">{task.title}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => finish(() => onUpdate({ ...task }))}
                        className="flex items-center gap-1 rounded-md border border-violet-200 bg-white px-2.5 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-100"
                    >
                        <RotateCcw size={13} /> Keep
                    </button>
                    <label className="flex items-center gap-1 rounded-md border border-violet-200 bg-white px-2 py-1 text-xs text-slate-600">
                        <CalendarDays size={13} />
                        <input
                            type="date"
                            value={scheduleDate}
                            onChange={(event) => setScheduleDate(event.target.value)}
                            className="bg-transparent outline-none"
                            aria-label="Schedule someday task"
                        />
                    </label>
                    <button
                        type="button"
                        onClick={() =>
                            finish(() =>
                                onUpdate({
                                    ...task,
                                    flag: 'today',
                                    kind: 'standard',
                                    plannedFor: scheduleDate,
                                }),
                            )
                        }
                        className="rounded-md bg-violet-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-violet-800"
                    >
                        Schedule
                    </button>
                    <button
                        type="button"
                        onClick={() => finish(() => onDelete(task.id))}
                        className="app-icon-button text-rose-600"
                        aria-label="Delete someday task"
                        title="Delete"
                    >
                        <Trash2 size={15} />
                    </button>
                </div>
            </div>
        </section>
    );
};

export default SomedayReviewCard;
