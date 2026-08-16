import React, { useMemo } from 'react';
import { useTrackers } from '../../hooks/useTrackers';
import { format, subDays, isSameDay, startOfDay } from 'date-fns';
import { Activity, Edit2 } from 'lucide-react';
import type { TrackerDefinition } from '../../types';

interface TrackerTrendsProps {
    onEditTracker?: (tracker: TrackerDefinition) => void;
}

const TrackerTrends: React.FC<TrackerTrendsProps> = ({ onEditTracker }) => {
    const { trackers, entries } = useTrackers();

    // Get last 7 days
    const last7Days = useMemo(() => {
        return Array.from({ length: 7 }).map((_, i) => {
            const date = subDays(new Date(), 6 - i);
            return {
                date,
                label: format(date, 'EEE'), // Mon, Tue...
                fullDate: format(date, 'yyyy-MM-dd'),
            };
        });
    }, []);

    const activeTrackers = useMemo(() => {
        // Filter trackers that have at least one entry in the last 7 days OR are marked as important/favorites (if we had that)
        // For now, show all active trackers, or maybe top 5 by recent activity?
        // Let's show all for now, as user likely doesn't have 100s.
        return trackers;
    }, [trackers]);

    if (trackers.length === 0) return null;

    return (
        <div className="bg-white p-5 rounded-xl shadow-cove border border-cove-border mb-6">
            <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-cove-tint-blue text-cove-accent rounded-xl">
                    <Activity size={18} />
                </div>
                <h3 className="font-semibold text-cove-ink">Weekly Snapshot</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeTrackers.map((tracker) => {
                    // Get data for this tracker for last 7 days
                    const trackerEntries = entries.filter((e) => e.trackerId === tracker.id);
                    const relevantEntries = trackerEntries.filter((e) => {
                        const d = new Date(e.timestamp);
                        return d >= startOfDay(subDays(new Date(), 6));
                    });

                    // Simple max value for scaling (or use goal)
                    const values = relevantEntries.map((e) => e.value);
                    const maxVal = Math.max(...values, tracker.goal?.target || 10, 1);

                    return (
                        <div
                            key={tracker.id}
                            className="group p-3 bg-[color:var(--buddy-surface-soft)]/50 rounded-xl border border-cove-border hover:border-cove-border transition-all relative"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">{tracker.emoji}</span>
                                    <span className="text-sm font-bold text-cove-muted truncate max-w-[100px]">
                                        {tracker.name}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {onEditTracker && (
                                        <button
                                            onClick={() => onEditTracker(tracker)}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-cove-faint hover:text-cove-accent transition-all"
                                            title="Edit tracker"
                                        >
                                            <Edit2 size={12} />
                                        </button>
                                    )}
                                    <span className="text-xs text-cove-faint font-mono">7d</span>
                                </div>
                            </div>

                            <div className="flex items-end justify-between h-12 gap-1">
                                {last7Days.map((day) => {
                                    // Find entry for this day
                                    const dayEntries = relevantEntries.filter((e) =>
                                        isSameDay(new Date(e.timestamp), day.date),
                                    );

                                    let val = 0;
                                    let hasEntry = false;

                                    if (dayEntries.length > 0) {
                                        hasEntry = true;
                                        if (tracker.type === 'boolean') {
                                            val = dayEntries.some((e) => e.value === 1) ? 1 : 0;
                                        } else if (tracker.type === 'rating') {
                                            // Average
                                            val =
                                                dayEntries.reduce((sum, e) => sum + e.value, 0) /
                                                dayEntries.length;
                                        } else {
                                            // Sum
                                            val = dayEntries.reduce((sum, e) => sum + e.value, 0);
                                        }
                                    }

                                    // Calc height percentage
                                    const height =
                                        tracker.type === 'boolean'
                                            ? val
                                                ? '100%'
                                                : '5%'
                                            : `${Math.min((val / maxVal) * 100, 100)}%`;

                                    // Goal status coloring
                                    let colorClass = 'bg-cove-track';
                                    if (hasEntry) {
                                        if (tracker.goal) {
                                            if (
                                                (tracker.goal.condition === 'gt' &&
                                                    val >= tracker.goal.target) ||
                                                (tracker.goal.condition === 'lt' &&
                                                    val <= tracker.goal.target) ||
                                                (tracker.goal.condition === 'eq' &&
                                                    val === tracker.goal.target)
                                            ) {
                                                colorClass = 'bg-cove-success';
                                            } else {
                                                colorClass = 'bg-cove-streak';
                                            }
                                        } else {
                                            colorClass = 'bg-cove-accent';
                                        }
                                    }

                                    return (
                                        <div
                                            key={day.label}
                                            className="flex-1 flex flex-col items-center gap-1 group/bar relative"
                                        >
                                            <div
                                                className={`w-full rounded-sm transition-all duration-500 ${colorClass}`}
                                                style={{
                                                    height: hasEntry ? height : '4px',
                                                    opacity: hasEntry ? 1 : 0.3,
                                                }}
                                            />
                                            {/* Tooltip */}
                                            {hasEntry && (
                                                <div className="absolute bottom-full mb-1 opacity-0 group-hover/bar:opacity-100 bg-cove-ink text-white text-[10px] py-1 px-2 rounded pointer-events-none whitespace-nowrap z-10">
                                                    {val.toFixed(1)} {tracker.unit}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex justify-between mt-1 px-0.5">
                                {last7Days.map((d) => (
                                    <span
                                        key={d.label}
                                        className="text-[9px] text-cove-faint font-bold"
                                    >
                                        {d.label.charAt(0)}
                                    </span>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TrackerTrends;
