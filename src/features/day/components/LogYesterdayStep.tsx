import React, { useState, useMemo } from 'react';
import { format, subDays, isSameDay } from 'date-fns';
import { Activity, FlaskConical, ChevronRight, Check, X } from 'lucide-react';
import { useTrackers } from '../../health-tracking/hooks/useTrackers';
import { useExperiments } from '../../health-tracking/hooks/useExperiments';
import { useExperimentCheckins } from '../../health-tracking/hooks/useExperimentCheckins';
import CheckinModal from '../../health-tracking/components/tracker/CheckinModal';
import ExperimentCheckinForm from '../../health-tracking/components/experiments/ExperimentCheckinForm';
import type { Entry } from '../../../types';
import type { AppRoute } from '../../../constants/routes';

interface LogYesterdayStepProps {
    onNavigate?: (tab: AppRoute) => void;
}

const LogYesterdayStep: React.FC<LogYesterdayStepProps> = ({ onNavigate: _onNavigate }) => {
    const yesterday = subDays(new Date(), 1);
    const yesterdayLabel = format(yesterday, 'EEEE, MMM do');
    const yesterdayStr = format(yesterday, 'yyyy-MM-dd');

    const { trackers, entries } = useTrackers();
    const { experiments } = useExperiments();

    const [checkinOpen, setCheckinOpen] = useState(false);
    const [checkinDone, setCheckinDone] = useState(false);
    const [activeExpId, setActiveExpId] = useState<string | null>(null);
    const [doneExpIds, setDoneExpIds] = useState<Set<string>>(new Set());

    const activeExperiments = useMemo(
        () => experiments.filter(e => e.status === 'active'),
        [experiments]
    );

    const activeExp = activeExpId ? activeExperiments.find(e => e.id === activeExpId) : null;
    const { saveCheckin, checkinsByDate } = useExperimentCheckins(activeExpId ?? '');
    const existingExpEntries = activeExpId ? (checkinsByDate[yesterdayStr] ?? []) : [];

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
                        {activeExperiments.map(exp => {
                            const done = doneExpIds.has(exp.id);
                            return (
                                <li key={exp.id}>
                                    <button
                                        onClick={() => !done && setActiveExpId(exp.id)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left ${
                                            done
                                                ? 'bg-emerald-50 border border-emerald-200'
                                                : 'bg-slate-50 hover:bg-slate-100'
                                        }`}
                                    >
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-slate-800">{exp.name}</p>
                                            <p className="text-xs text-slate-500">
                                                {done
                                                    ? 'Logged for yesterday'
                                                    : exp.customMetrics.length > 0
                                                        ? `${exp.customMetrics.length} metric${exp.customMetrics.length !== 1 ? 's' : ''} to log`
                                                        : 'Tap to log check-in'}
                                            </p>
                                        </div>
                                        {done
                                            ? <Check size={16} className="text-emerald-600 flex-shrink-0" />
                                            : <ChevronRight size={16} className="text-slate-400 flex-shrink-0" />
                                        }
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            {/* Inline experiment check-in modal */}
            {activeExp && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-0 sm:p-4">
                    <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg shadow-xl max-h-[85vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-slate-100 flex-shrink-0">
                            <div>
                                <h3 className="font-semibold text-slate-900">{activeExp.name}</h3>
                                <p className="text-xs text-slate-500">Log for {yesterdayLabel}</p>
                            </div>
                            <button
                                onClick={() => setActiveExpId(null)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1">
                            <ExperimentCheckinForm
                                metrics={activeExp.customMetrics}
                                phases={activeExp.phases}
                                date={yesterdayStr}
                                existingEntries={existingExpEntries}
                                onSave={async (date, entries) => {
                                    await saveCheckin(date, entries);
                                    setDoneExpIds(prev => new Set([...prev, activeExp.id]));
                                    setActiveExpId(null);
                                }}
                            />
                        </div>
                    </div>
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
