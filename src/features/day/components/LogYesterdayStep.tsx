import React, { useState, useMemo } from 'react';
import { format, subDays, isSameDay } from 'date-fns';
import { Activity, FlaskConical, ChevronRight, Check } from 'lucide-react';
import { useTrackers } from '../../health-tracking/hooks/useTrackers';
import { useExperiments } from '../../health-tracking/hooks/useExperiments';
import CheckinModal from '../../health-tracking/components/tracker/CheckinModal';
import type { Entry } from '../../../types';
import type { AppRoute } from '../../../constants/routes';

interface LogYesterdayStepProps {
    onNavigate?: (tab: AppRoute) => void;
}

const LogYesterdayStep: React.FC<LogYesterdayStepProps> = ({ onNavigate }) => {
    const yesterday = subDays(new Date(), 1);
    const yesterdayLabel = format(yesterday, 'EEEE, MMM do');

    const { trackers, entries } = useTrackers();
    const { experiments } = useExperiments();

    const [checkinOpen, setCheckinOpen] = useState(false);
    const [checkinDone, setCheckinDone] = useState(false);

    const activeExperiments = useMemo(
        () => experiments.filter(e => e.status === 'active'),
        [experiments]
    );

    const yesterdayEntries = useMemo(
        () => entries.filter((e: Entry) => isSameDay(new Date(e.timestamp), yesterday)),
        [entries, yesterday.getTime()]
    );

    return (
        <div className="space-y-4">
            <p className="text-sm text-slate-500">
                Log your metrics from {yesterdayLabel} before planning today.
            </p>

            {/* Health trackers — single button */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                    <Activity size={18} className="text-indigo-600" />
                    Health metrics
                </h2>

                {trackers.length === 0 ? (
                    <p className="text-sm text-slate-400">No trackers set up yet.</p>
                ) : checkinDone ? (
                    <div className="flex items-center gap-2 py-2 text-emerald-600 text-sm font-medium">
                        <Check size={16} /> Logged for {yesterdayLabel}
                    </div>
                ) : (
                    <button
                        onClick={() => setCheckinOpen(true)}
                        className="w-full py-2.5 px-4 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-sm font-medium hover:bg-indigo-100 transition-colors"
                    >
                        Log yesterday's metrics ({trackers.length} tracker{trackers.length !== 1 ? 's' : ''})
                    </button>
                )}
            </div>

            {/* Active experiments */}
            {activeExperiments.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                    <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                        <FlaskConical size={18} className="text-violet-600" />
                        Active experiments
                    </h2>
                    <ul className="space-y-2">
                        {activeExperiments.map(exp => (
                            <li key={exp.id}>
                                <button
                                    onClick={() => onNavigate?.('experiments')}
                                    className="w-full flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors text-left"
                                >
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-slate-800">{exp.name}</p>
                                        <p className="text-xs text-slate-500">
                                            {exp.customMetrics.length > 0
                                                ? `${exp.customMetrics.length} metric${exp.customMetrics.length !== 1 ? 's' : ''} to log`
                                                : 'Active experiment'}
                                        </p>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-400 flex-shrink-0" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <CheckinModal
                isOpen={checkinOpen}
                onClose={() => setCheckinOpen(false)}
                onComplete={() => { setCheckinOpen(false); setCheckinDone(true); }}
                date={yesterday}
                existingEntries={yesterdayEntries}
            />
        </div>
    );
};

export default LogYesterdayStep;
