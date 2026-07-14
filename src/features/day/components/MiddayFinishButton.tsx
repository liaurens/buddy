import React from 'react';
import { Check, CheckCircle2 } from 'lucide-react';
import { markRoutineDone } from '../services/routine-progress';
import { useRoutineProgress } from '../hooks/useRoutineProgress';

interface Props {
    dateKey: string;
    accent: 'amber' | 'indigo';
}

/**
 * Marks the midday reset as finished. Shown under the midday timeline so the
 * home page routine card reflects an actual check-in, not the time of day.
 */
const MiddayFinishButton: React.FC<Props> = ({ dateKey, accent }) => {
    const progress = useRoutineProgress(dateKey);

    if (progress.midday) {
        return (
            <p className="flex items-center justify-center gap-2 pt-1 text-sm font-medium text-emerald-700">
                <CheckCircle2 size={16} /> Midday reset done
            </p>
        );
    }

    const accentClasses =
        accent === 'amber'
            ? 'bg-amber-500 hover:bg-amber-600'
            : 'bg-indigo-600 hover:bg-indigo-700';

    return (
        <button
            onClick={() => markRoutineDone('midday', dateKey)}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-xl transition-colors ${accentClasses}`}
        >
            <Check size={15} /> Done checking in — finish midday
        </button>
    );
};

export default MiddayFinishButton;
