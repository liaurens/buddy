/**
 * Close Day card — the explicit end state of the daily loop.
 *
 * One tap closes the day, shows tomorrow's top item, and a low-pressure
 * continuity row (days closed this week — circles, not a streak; missing a
 * day is not punished).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { format, isSameDay } from 'date-fns';
import { CheckCircle2, Moon, Sunrise } from 'lucide-react';
import { useAuth } from '../../../../hooks/useAuth';
import { useTaskRecommendation } from '../../../tasks/hooks/useTaskRecommendation';
import {
    closeDay,
    reopenDay,
    isDayClosed,
    getClosedDatesThisWeek,
    weekWindow,
} from '../../services/closeDay.service';

interface CloseDayCardProps {
    /** Date being reflected on, yyyy-MM-dd. */
    date: string;
    /** "Tomorrow's focus" text from the reflection form, if any. */
    tomorrowPriority?: string;
}

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const CloseDayCard: React.FC<CloseDayCardProps> = ({ date, tomorrowPriority }) => {
    const { user } = useAuth();
    const { recommended } = useTaskRecommendation();
    const [closed, setClosed] = useState(false);
    const [closedDates, setClosedDates] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!user?.id) return;
        try {
            const [dayClosed, weekDates] = await Promise.all([
                isDayClosed(user.id, date),
                getClosedDatesThisWeek(user.id, new Date(`${date}T12:00:00`)),
            ]);
            setClosed(dayClosed);
            setClosedDates(weekDates);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load day state');
        }
    }, [user?.id, date]);

    useEffect(() => { refresh(); }, [refresh]);

    const handleToggle = async () => {
        if (!user?.id || busy) return;
        setBusy(true);
        setError(null);
        try {
            if (closed) {
                await reopenDay(user.id, date);
            } else {
                await closeDay(user.id, date);
            }
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update day');
        } finally {
            setBusy(false);
        }
    };

    const { start } = weekWindow(new Date(`${date}T12:00:00`));
    const weekStart = new Date(`${start}T12:00:00`);
    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
    });
    const closedSet = new Set(closedDates);
    const tomorrowTop = tomorrowPriority?.trim() || recommended?.task.title || null;

    return (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 space-y-4">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Moon size={18} className="text-indigo-500" /> Close the day
            </h2>

            {!closed ? (
                <>
                    <p className="text-xs text-slate-500">
                        Done reflecting? Close the day — that's the whole ritual. Tomorrow starts fresh.
                    </p>
                    <button
                        onClick={handleToggle}
                        disabled={busy}
                        className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                        <CheckCircle2 size={16} />
                        {busy ? 'Closing…' : 'Close day'}
                    </button>
                </>
            ) : (
                <div className="space-y-4">
                    <p className="text-sm text-emerald-700 flex items-center gap-2 font-medium">
                        <CheckCircle2 size={16} /> Day closed. See you tomorrow.
                    </p>

                    {tomorrowTop && (
                        <div className="rounded-lg bg-indigo-50 px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500 flex items-center gap-1">
                                <Sunrise size={12} /> Tomorrow's top item
                            </p>
                            <p className="mt-1 text-sm font-medium text-indigo-900">{tomorrowTop}</p>
                        </div>
                    )}

                    <button
                        onClick={handleToggle}
                        disabled={busy}
                        className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        Reopen day
                    </button>
                </div>
            )}

            {/* Continuity row — informational, never shaming */}
            <div>
                <p className="text-[11px] text-slate-400 mb-1.5">
                    {closedDates.length} day{closedDates.length === 1 ? '' : 's'} closed this week
                </p>
                <div className="flex gap-2">
                    {weekDays.map((d, i) => {
                        const key = format(d, 'yyyy-MM-dd');
                        const isClosed = closedSet.has(key);
                        const isSelected = isSameDay(d, new Date(`${date}T12:00:00`));
                        return (
                            <div key={key} className="flex flex-col items-center gap-1">
                                <div
                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                                        isClosed
                                            ? 'bg-emerald-500 text-white'
                                            : isSelected
                                                ? 'border-2 border-indigo-300 text-slate-500'
                                                : 'bg-slate-100 text-slate-400'
                                    }`}
                                >
                                    {isClosed ? '✓' : WEEKDAY_LABELS[i]}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {error && <p className="text-xs text-rose-600">{error}</p>}
        </div>
    );
};

export default CloseDayCard;
