/**
 * StreakCalendar - Mini calendar heatmap showing task completion history
 * Shows last 35 days (5 weeks) with color intensity based on completions
 */

import React from 'react';
import { format, subDays, startOfWeek, addDays, isSameDay } from 'date-fns';

interface StreakCalendarProps {
    calendarData: Map<string, number>;
    completedToday: boolean;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function getIntensityClass(count: number): string {
    if (count === 0) return 'bg-slate-100';
    if (count === 1) return 'bg-emerald-200';
    if (count === 2) return 'bg-emerald-400';
    return 'bg-emerald-600';
}

const StreakCalendar: React.FC<StreakCalendarProps> = ({ calendarData, completedToday }) => {
    const today = new Date();

    // Build a 5-week grid (35 days) ending today
    // Start from 34 days ago, align to Monday
    const endDate = today;
    const rawStart = subDays(endDate, 34);
    const gridStart = startOfWeek(rawStart, { weekStartsOn: 1 }); // Monday start

    // Build weeks
    const weeks: Date[][] = [];
    let current = gridStart;
    while (current <= endDate || weeks.length < 5) {
        const week: Date[] = [];
        for (let d = 0; d < 7; d++) {
            week.push(current);
            current = addDays(current, 1);
        }
        weeks.push(week);
        if (weeks.length >= 6) break; // Safety
    }

    return (
        <div className="space-y-1">
            {/* Day labels */}
            <div className="flex gap-1 mb-1">
                <div className="w-4" /> {/* Spacer */}
                {DAY_LABELS.map((label, i) => (
                    <div key={i} className="w-6 h-4 text-[9px] font-medium text-slate-400 text-center leading-4">
                        {label}
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            {weeks.map((week, wi) => (
                <div key={wi} className="flex gap-1">
                    <div className="w-4" /> {/* Spacer for alignment */}
                    {week.map((day, di) => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const count = calendarData.get(dateStr) || 0;
                        const isToday = isSameDay(day, today);
                        const isFuture = day > today;

                        return (
                            <div
                                key={di}
                                className={`w-6 h-6 rounded-sm transition-colors ${
                                    isFuture
                                        ? 'bg-transparent'
                                        : isToday
                                            ? `${getIntensityClass(count)} ring-2 ring-indigo-400 ring-offset-1`
                                            : getIntensityClass(count)
                                }`}
                                title={`${format(day, 'MMM d')}: ${count} task${count !== 1 ? 's' : ''} completed`}
                            />
                        );
                    })}
                </div>
            ))}

            {/* Legend */}
            <div className="flex items-center gap-1 pt-1 justify-end">
                <span className="text-[9px] text-slate-400 mr-1">Less</span>
                <div className="w-3 h-3 rounded-sm bg-slate-100" />
                <div className="w-3 h-3 rounded-sm bg-emerald-200" />
                <div className="w-3 h-3 rounded-sm bg-emerald-400" />
                <div className="w-3 h-3 rounded-sm bg-emerald-600" />
                <span className="text-[9px] text-slate-400 ml-1">More</span>
            </div>
        </div>
    );
};

export default StreakCalendar;
