import React from 'react';
import { format } from 'date-fns';
import { Coffee, Sunrise } from 'lucide-react';
import { useTasks } from '../../tasks/hooks/useTasks';
import { useTodayItems, formatMinutesTotal } from '../hooks/useTodayItems';
import TodayTimeline from './TodayTimeline';
import MiddayTaskReview from './MiddayTaskReview';
import MiddayFinishButton from './MiddayFinishButton';

interface Props {
    onGoToMorning?: () => void;
}

const LightMidday: React.FC<Props> = ({ onGoToMorning }) => {
    const today = new Date();
    const dateKey = format(today, 'yyyy-MM-dd');

    const { toggleTask } = useTasks();
    const items = useTodayItems(dateKey);

    const intention = (() => {
        try {
            return sessionStorage.getItem(`light_intention_${dateKey}`) ?? '';
        } catch {
            return '';
        }
    })();

    if (items.totalCount === 0 && items.events.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto">
                    <Coffee size={20} className="text-amber-500" />
                </div>
                <h2 className="font-semibold text-slate-900">Nothing on your day yet</h2>
                <p className="text-sm text-slate-500">
                    Head to the morning step to pick what you want done — or just enjoy the day.
                </p>
                {onGoToMorning && (
                    <button
                        onClick={onGoToMorning}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors"
                    >
                        <Sunrise size={14} /> Go to morning
                    </button>
                )}
                <MiddayFinishButton dateKey={dateKey} accent="amber" />
            </div>
        );
    }

    const totalTimeLabel = formatMinutesTotal(items.estimatedTotalMinutes);

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-semibold text-slate-900">Today</h2>
                    {intention && (
                        <p className="text-xs text-slate-500 mt-0.5">
                            Today's word:{' '}
                            <span className="font-medium text-amber-700">{intention}</span>
                        </p>
                    )}
                </div>
                <span className="text-xs text-slate-500">
                    {items.completedCount} / {items.totalCount} done
                </span>
            </div>

            <TodayTimeline
                timedItems={items.timedItems}
                untimedPicks={items.untimedPicks}
                accent="amber"
                pickInteraction="check"
                onTogglePick={(t) => {
                    void toggleTask(t.id);
                }}
            />

            <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
                <span>
                    {items.totalCount} picked{totalTimeLabel ? ` · est. ~${totalTimeLabel}` : ''}
                </span>
                <span className="text-slate-400">
                    {items.events.length} event{items.events.length === 1 ? '' : 's'}
                </span>
            </div>

            <MiddayTaskReview dateKey={dateKey} accent="amber" />

            <MiddayFinishButton dateKey={dateKey} accent="amber" />
        </div>
    );
};

export default LightMidday;
