/**
 * TodayFocusCard — the Home hero: today's chosen tasks as actionable rows
 * (done / snooze / needs-work), plus the evening close-day CTA.
 *
 * This is the "used 20%" of the daily loop given the whole front page:
 * picks, capture (above it), close-day. Everything else folds away.
 */

import React from 'react';
import { format } from 'date-fns';
import { Sunrise, Moon, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { AppRoute } from '../../../constants/routes';
import { useAuth } from '../../../hooks/useAuth';
import { useTasks } from '../../tasks/hooks/useTasks';
import { useTodayItems } from '../../day/hooks/useTodayItems';
import PickRow, { PICK_ACCENTS } from '../../day/components/PickRow';
import { isDayClosed } from '../../planning/services/closeDay.service';
import { getCategorySettings } from '../../../services/settings';
import { shouldShowCloseDay } from '../utils/homeSections';

interface Props {
    onNavigate: (tab: AppRoute) => void;
}

const TodayFocusCard: React.FC<Props> = ({ onNavigate }) => {
    const now = new Date();
    const dateKey = format(now, 'yyyy-MM-dd');
    const { user } = useAuth();
    const { picks, completedCount, totalCount } = useTodayItems(dateKey);
    const { toggleTask, updateTask } = useTasks();
    const accent = PICK_ACCENTS.indigo;

    const { data: dayClosed = false } = useQuery({
        queryKey: ['dayClosed', user?.id, dateKey],
        queryFn: () => isDayClosed(user!.id, dateKey),
        enabled: !!user?.id,
        staleTime: 60_000,
    });

    const { data: nightTime = '21:00' } = useQuery({
        queryKey: ['settings', user?.id, 'notifications', 'nightTime'],
        queryFn: async () => {
            const s = await getCategorySettings(user!.id, 'notifications');
            return s.nightTime;
        },
        enabled: !!user?.id,
        staleTime: 10 * 60_000,
    });

    const showCloseDay = shouldShowCloseDay(now, nightTime, dayClosed);
    const open = picks.filter((t) => !t.completed);

    return (
        <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold text-slate-900">Today</h2>
                {totalCount > 0 && (
                    <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${accent.softBg} ${accent.softText}`}
                    >
                        {completedCount} / {totalCount} done
                    </span>
                )}
            </div>

            {open.length > 0 ? (
                <ul className="space-y-2">
                    {open.map((task) => (
                        <PickRow
                            key={task.id}
                            task={task}
                            accent={accent}
                            onDone={() => toggleTask(task.id)}
                            onReschedule={(date, time) =>
                                updateTask({
                                    ...task,
                                    plannedFor: date,
                                    dueTime: time ?? task.dueTime,
                                })
                            }
                            onUpdate={updateTask}
                        />
                    ))}
                </ul>
            ) : totalCount > 0 ? (
                <p className="text-sm text-slate-500">All of today's picks are done. 🎉</p>
            ) : (
                <button
                    type="button"
                    onClick={() => onNavigate('today')}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 px-4 py-3 text-left transition-colors hover:bg-indigo-50"
                >
                    <span className="flex items-center gap-2 text-sm font-medium text-indigo-700">
                        <Sunrise size={16} /> Pick what today gets
                    </span>
                    <ArrowRight size={16} className="text-indigo-400" />
                </button>
            )}

            {showCloseDay && (
                <button
                    type="button"
                    onClick={() => onNavigate('reflection')}
                    className="flex w-full items-center justify-between gap-3 rounded-xl bg-slate-900 px-4 py-3 text-left transition-colors hover:bg-slate-800"
                >
                    <span className="flex items-center gap-2 text-sm font-medium text-white">
                        <Moon size={16} /> Close the day
                    </span>
                    <span className="text-xs text-slate-400">~90 seconds</span>
                </button>
            )}
        </div>
    );
};

export default TodayFocusCard;
