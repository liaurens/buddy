/**
 * HabitDashboard - The main habit-focused component
 *
 * Shows:
 * 1. Streak counter + consistency rate
 * 2. Today's recommended task with quick-complete
 * 3. Mini streak calendar heatmap
 */

import React from 'react';
import { Flame, Target, CheckCircle2, Circle, ChevronRight, Zap, Trophy } from 'lucide-react';
import { format } from 'date-fns';
import { useStreak } from '../hooks/useStreak';
import { useTaskRecommendation } from '../hooks/useTaskRecommendation';
import { useTasks } from '../hooks/useTasks';
import StreakCalendar from './StreakCalendar';

interface HabitDashboardProps {
    onNavigateToTasks: () => void;
}

const HabitDashboard: React.FC<HabitDashboardProps> = ({ onNavigateToTasks }) => {
    const streak = useStreak();
    const { recommended, activeCount } = useTaskRecommendation();
    const { toggleTask } = useTasks();

    const handleQuickComplete = async () => {
        if (recommended) {
            if (recommended.subtask) {
                // For subtasks, navigate to tasks page for detailed handling
                onNavigateToTasks();
            } else {
                await toggleTask(recommended.task.id);
            }
        }
    };

    return (
        <div className="space-y-4">
            {/* Streak Header */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white shadow-xl shadow-slate-200">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${streak.currentStreak > 0 ? 'bg-amber-500/20' : 'bg-white/10'}`}>
                            <Flame size={22} className={streak.currentStreak > 0 ? 'text-amber-400' : 'text-slate-400'} />
                        </div>
                        <div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black tabular-nums">{streak.currentStreak}</span>
                                <span className="text-sm text-slate-400 font-medium">day streak</span>
                            </div>
                        </div>
                    </div>

                    {/* Consistency badge */}
                    <div className="text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                            <Target size={14} className="text-emerald-400" />
                            <span className="text-lg font-bold text-emerald-400">{streak.consistencyPercent}%</span>
                        </div>
                        <span className="text-[10px] text-slate-400">last 30 days</span>
                    </div>
                </div>

                {/* Streak message */}
                <p className="text-sm text-slate-300 mb-4">{streak.message}</p>

                {/* Stats row */}
                <div className="flex gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                        <Trophy size={12} className="text-amber-400" />
                        <span className="text-slate-400">Best: <span className="text-white font-semibold">{streak.longestStreak}</span></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <CheckCircle2 size={12} className="text-emerald-400" />
                        <span className="text-slate-400">This month: <span className="text-white font-semibold">{streak.last30DaysCompleted}/30</span></span>
                    </div>
                </div>
            </div>

            {/* Today's Pick */}
            {recommended && !streak.completedToday && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-4 pt-4 pb-2">
                        <div className="flex items-center gap-2 mb-3">
                            <Zap size={16} className="text-indigo-500" />
                            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Today's Pick</span>
                        </div>

                        <button
                            onClick={handleQuickComplete}
                            className="w-full flex items-start gap-3 group text-left"
                        >
                            <div className="mt-0.5 text-slate-300 group-hover:text-emerald-500 transition-colors">
                                <Circle size={24} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-slate-800 text-lg leading-tight group-hover:text-indigo-700 transition-colors">
                                    {recommended.subtask
                                        ? recommended.subtask.title
                                        : recommended.task.title
                                    }
                                </p>
                                {recommended.subtask && (
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Part of: {recommended.task.title}
                                    </p>
                                )}
                                <p className="text-xs text-slate-500 mt-1 capitalize">{recommended.reason}</p>
                            </div>
                        </button>
                    </div>

                    {activeCount > 1 && (
                        <button
                            onClick={onNavigateToTasks}
                            className="w-full px-4 py-2.5 mt-1 bg-slate-50 text-xs font-medium text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center justify-center gap-1"
                        >
                            {activeCount - 1} more task{activeCount - 1 !== 1 ? 's' : ''}
                            <ChevronRight size={12} />
                        </button>
                    )}
                </div>
            )}

            {/* Completed today state */}
            {streak.completedToday && (
                <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-5 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-100 rounded-full mb-3">
                        <CheckCircle2 size={24} className="text-emerald-600" />
                    </div>
                    <p className="font-semibold text-emerald-800">Daily goal achieved!</p>
                    <p className="text-sm text-emerald-600 mt-1">
                        {activeCount > 0
                            ? `${activeCount} more task${activeCount !== 1 ? 's' : ''} waiting`
                            : 'All tasks complete. Enjoy your day!'
                        }
                    </p>
                    {activeCount > 0 && (
                        <button
                            onClick={onNavigateToTasks}
                            className="mt-3 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors"
                        >
                            Keep going
                        </button>
                    )}
                </div>
            )}

            {/* No tasks state */}
            {!recommended && !streak.completedToday && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
                    <p className="text-slate-500 text-sm">No active tasks. Add one to get started!</p>
                    <button
                        onClick={onNavigateToTasks}
                        className="mt-3 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                    >
                        Add a task
                    </button>
                </div>
            )}

            {/* Streak Calendar */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Activity</h3>
                <StreakCalendar
                    calendarData={streak.calendarData}
                    completedToday={streak.completedToday}
                />
            </div>
        </div>
    );
};

export default HabitDashboard;
