/**
 * HabitDashboard - Re-designed as a Mini Tracker per user request
 *
 * Shows:
 * 1. Compact streak & consistency metric
 * 2. Today's recommended task
 */

import React from 'react';
import { Flame, Target, Circle, CheckCircle2, ChevronRight, ListTodo } from 'lucide-react';
import { useStreak } from '../hooks/useStreak';
import { useTaskRecommendation } from '../hooks/useTaskRecommendation';
import { useTasks } from '../hooks/useTasks';

interface HabitDashboardProps {
    onNavigateToTasks: () => void;
}

const HabitDashboard: React.FC<HabitDashboardProps> = ({ onNavigateToTasks }) => {
    const streak = useStreak();
    const { recommended, activeCount } = useTaskRecommendation();
    const { toggleTask } = useTasks();

    const handleQuickComplete = async (e: React.MouseEvent) => {
        e.stopPropagation();
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:border-indigo-200 transition-colors cursor-pointer" onClick={onNavigateToTasks}>
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded shadow-sm border border-slate-100" title="Current Daily Streak">
                        <Flame size={14} className={streak.currentStreak > 0 ? "text-amber-500 font-bold" : "text-slate-400"} />
                        <span className="text-xs font-bold text-slate-700">{streak.currentStreak} <span className="text-slate-400 font-normal">streak</span></span>
                    </div>
                    <div className="flex items-center gap-1.5" title="Consistency padding (last 30 days)">
                        <Target size={14} className="text-emerald-500" />
                        <span className="text-xs font-semibold text-slate-600">{streak.consistencyPercent}%</span>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <ListTodo size={14} />
                    <span>{activeCount} active</span>
                </div>
            </div>

            <div className="p-4">
               {streak.completedToday ? (
                   <div className="flex flex-col items-center justify-center p-2 text-center text-emerald-600">
                      <CheckCircle2 size={24} className="mb-2 text-emerald-500" />
                      <p className="text-sm font-bold text-emerald-700">Daily goal achieved!</p>
                      <p className="text-xs text-emerald-600/80 mt-1">{activeCount > 0 ? `${activeCount} more waiting` : 'All caught up'}</p>
                   </div>
               ) : !recommended ? (
                   <div className="flex flex-col items-center justify-center p-2 text-center text-slate-500">
                      <p className="text-sm font-medium">No active tasks</p>
                      <p className="text-xs text-slate-400">Add something to your list</p>
                   </div>
               ) : (
                   <div className="group flex items-start gap-3">
                       <button onClick={handleQuickComplete} className="mt-0.5 text-slate-300 hover:text-emerald-500 transition-colors flex-shrink-0" title="Quick Complete">
                           <Circle size={20} />
                       </button>
                       <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-indigo-500 mb-0.5 uppercase tracking-wider">Up Next</p>
                          <p className="font-semibold text-slate-800 text-sm leading-tight truncate group-hover:text-indigo-600 transition-colors">
                              {recommended.subtask ? recommended.subtask.title : recommended.task.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-1">{recommended.reason}</p>
                       </div>
                       <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-400 self-center" />
                   </div>
               )}
            </div>
        </div>
    );
};

export default HabitDashboard;
