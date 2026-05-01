import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { Check, Coffee, Sunrise } from 'lucide-react';
import { useTasks } from '../../tasks/hooks/useTasks';

interface Props {
    onGoToMorning?: () => void;
}

const LightMidday: React.FC<Props> = ({ onGoToMorning }) => {
    const today = new Date();
    const dateKey = format(today, 'yyyy-MM-dd');

    const { tasks, toggleTask } = useTasks();

    const pickIds = useMemo<string[]>(() => {
        try {
            const saved = sessionStorage.getItem(`light_picks_${dateKey}`);
            return saved ? (JSON.parse(saved) as string[]) : [];
        } catch { return []; }
    }, [dateKey]);

    const locked = (() => {
        try { return sessionStorage.getItem(`light_locked_${dateKey}`) === '1'; } catch { return false; }
    })();

    const intention = (() => {
        try { return sessionStorage.getItem(`light_intention_${dateKey}`) ?? ''; } catch { return ''; }
    })();

    const pickedTasks = useMemo(
        () => pickIds.map(id => tasks.find(t => t.id === id)).filter(Boolean) as typeof tasks,
        [pickIds, tasks]
    );

    const completedCount = pickedTasks.filter(t => t.completed).length;
    const totalCount = pickedTasks.length;

    if (!locked || pickedTasks.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto">
                    <Coffee size={20} className="text-amber-500" />
                </div>
                <h2 className="font-semibold text-slate-900">No picks for today yet</h2>
                <p className="text-sm text-slate-500">
                    Head over to the morning step to choose your top 3 — or just enjoy the day.
                </p>
                {onGoToMorning && (
                    <button
                        onClick={onGoToMorning}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors"
                    >
                        <Sunrise size={14} /> Go to morning
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-semibold text-slate-900">Today's picks</h2>
                    {intention && (
                        <p className="text-xs text-slate-500 mt-0.5">
                            Today's word: <span className="font-medium text-amber-700">{intention}</span>
                        </p>
                    )}
                </div>
                <span className="text-xs text-slate-500">
                    {completedCount} / {totalCount} done
                </span>
            </div>
            <ul className="space-y-2">
                {pickedTasks.map(task => (
                    <li key={task.id}>
                        <button
                            onClick={() => toggleTask(task.id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                                task.completed
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-slate-50 border-slate-200 hover:border-amber-200'
                            }`}
                        >
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                task.completed ? 'border-green-500 bg-green-500' : 'border-slate-300'
                            }`}>
                                {task.completed && <Check size={12} className="text-white" />}
                            </div>
                            <span className={`text-sm font-medium ${task.completed ? 'text-green-800 line-through' : 'text-slate-800'}`}>
                                {task.title}
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default LightMidday;
