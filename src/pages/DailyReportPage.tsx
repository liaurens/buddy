import React, { useState, useMemo } from 'react';
import { useTracker } from '../context/TrackerContext';
import { useProtocol } from '../context/ProtocolContext';
import { format, subDays, isSameDay } from 'date-fns';
import { CheckCircle, CheckSquare } from 'lucide-react';
import CheckinModal from '../features/tracker/CheckinModal';

const DailyReportPage: React.FC = () => {
    const { trackers, entries } = useTracker();
    const { doses } = useProtocol();

    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [isCheckinOpen, setIsCheckinOpen] = useState(false);

    const todaysEntries = useMemo(() =>
        entries.filter(e => isSameDay(new Date(e.timestamp), new Date(selectedDate))),
        [entries, selectedDate]
    );

    const todaysDoses = useMemo(() =>
        doses.filter(d => d.takenAt && isSameDay(new Date(d.takenAt), new Date(selectedDate))),
        [doses, selectedDate]
    );

    const isTodayComplete = todaysEntries.some(e =>
        e.notes === 'Daily Check-in' || e.trackerId === 'journal_notes' || e.trackerId === 'mood'
    );

    // --- MAIN VIEW ---

    const dates = Array.from({ length: 5 }, (_, i) => subDays(new Date(), 4 - i));

    return (
        <div className="max-w-2xl mx-auto p-4 space-y-6 pb-24">
            {/* Header / Date Nav */}
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Journal History</h1>
                    <p className="text-slate-500">{format(new Date(selectedDate), 'EEEE, MMM do')}</p>
                </div>
            </header>

            <div className="flex gap-2 mb-6">
                {dates.map(date => {
                    const isSelected = isSameDay(date, new Date(selectedDate));
                    return (
                        <button
                            key={date.toISOString()}
                            onClick={() => setSelectedDate(format(date, 'yyyy-MM-dd'))}
                            className={`flex-1 h-14 rounded-xl border flex flex-col items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500'
                                }`}
                        >
                            <span className="text-[10px] font-bold uppercase">{format(date, 'EEE')}</span>
                            <span className="text-sm font-bold">{format(date, 'd')}</span>
                        </button>
                    );
                })}
            </div>

            {/* Daily Summary (Read Only) */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col items-center justify-center text-center space-y-4">
                <div className={`p-4 rounded-full ${isTodayComplete ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                    {isTodayComplete ? <CheckCircle size={32} /> : <CheckSquare size={32} />}
                </div>

                {isTodayComplete ? (
                    <>
                        <h2 className="text-xl font-bold text-slate-800">Day Complete</h2>
                        <button
                            onClick={() => setIsCheckinOpen(true)}
                            className="text-sm font-medium text-indigo-600 hover:text-indigo-700 underline"
                        >
                            Edit Check-in
                        </button>
                    </>
                ) : (
                    <>
                        <h2 className="text-xl font-bold text-slate-800">No Check-in</h2>
                        <button
                            onClick={() => setIsCheckinOpen(true)}
                            className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-600 transition-colors"
                        >
                            Start Check-in
                        </button>
                    </>
                )}
            </div>

            {/* Entries Display */}
            <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider px-1">Logged Data</h3>
                {(() => {
                    const reportEntries = todaysEntries.filter(entry => {
                        const tracker = trackers.find(t => t.id === entry.trackerId);
                        return tracker?.checkinConfig?.showInDailyReport;
                    });

                    if (reportEntries.length === 0) {
                        return (
                            <div className="text-center py-8 text-slate-400 text-sm italic">
                                Nothing logged for this day.
                            </div>
                        );
                    }

                    return (
                        <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-50 shadow-sm">
                            {reportEntries.map(entry => {
                                const tracker = trackers.find(t => t.id === entry.trackerId);
                                if (!tracker) return null;
                                return (
                                    <div key={entry.id} className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{tracker.emoji}</span>
                                            <div>
                                                <p className="font-medium text-slate-900">{tracker.name}</p>
                                                <p className="text-xs text-slate-500">{entry.notes || tracker.group}</p>
                                            </div>
                                        </div>
                                        <div className="font-bold text-slate-700">
                                            {tracker.type === 'boolean'
                                                ? (entry.value ? 'Yes' : 'No')
                                                : <>{entry.value} <span className="text-xs font-normal text-slate-400">{tracker.unit}</span></>
                                            }
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()}
            </div>

            {/* ---------------- CHECK-IN MODAL ---------------- */}
            <CheckinModal
                isOpen={isCheckinOpen}
                onClose={() => setIsCheckinOpen(false)}
                onComplete={() => setIsCheckinOpen(false)}
                date={new Date(selectedDate)}
                existingEntries={todaysEntries}
                existingDoses={todaysDoses}
            />
        </div>
    );
};

export default DailyReportPage;
