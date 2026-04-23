import React, { useState, useEffect, useMemo } from 'react';
import { useTrackers } from '../../hooks/useTrackers';
import { useProtocols } from '../../hooks/useProtocols';
import { CheckCircle, Pill, Moon, Calendar, Settings } from 'lucide-react';
import type { TrackerDefinition, Entry, Dose } from '../../../../types';
import { format } from 'date-fns';

interface CheckinFormProps {
    date: Date;
    onDateChange?: (date: Date) => void;
    showProtocols?: boolean;
    showDatePicker?: boolean;
    onComplete?: () => void;
    onManageTrackers?: () => void;
    existingEntries?: Entry[];
    existingDoses?: Dose[];
}

const EMPTY_ARRAY: any[] = [];

const CheckinForm: React.FC<CheckinFormProps> = ({ 
    date, 
    onDateChange,
    showProtocols = true, 
    showDatePicker = false,
    onComplete, 
    onManageTrackers,
    existingEntries = EMPTY_ARRAY, 
    existingDoses = EMPTY_ARRAY 
}) => {
    const { trackers, addEntry, updateEntry } = useTrackers();
    const { protocols, logDose } = useProtocols();

    const [trackerValues, setTrackerValues] = useState<Record<string, number | string>>({});
    const [protocolLogs, setProtocolLogs] = useState<Record<string, { taken: boolean }>>({});
    const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

    // Track which entries already exist (for update vs create)
    const existingEntryMap = useMemo(() => {
        const map: Record<string, Entry> = {};
        existingEntries.forEach(entry => {
            map[entry.trackerId] = entry;
        });
        return map;
    }, [existingEntries]);

    // Pre-populate form with existing data when date/entries change
    useEffect(() => {
        const initialValues: Record<string, number | string> = {};
        existingEntries.forEach(entry => {
            const tracker = trackers.find(t => t.id === entry.trackerId);
            if (tracker) {
                if (tracker.type === 'text') {
                    initialValues[entry.trackerId] = entry.textValue || '';
                } else {
                    initialValues[entry.trackerId] = entry.value;
                }
            }
        });
        setTrackerValues(initialValues);

        const initialProtocols: Record<string, { taken: boolean }> = {};
        existingDoses.forEach(dose => {
            if (!dose.skipped && dose.takenAt) {
                initialProtocols[dose.protocolId] = { taken: true };
            }
        });
        setProtocolLogs(initialProtocols);

        setSubmitStatus('idle');
    }, [existingEntries, existingDoses, trackers, date]);

    const checkinTrackers = trackers.filter(t => t.checkinConfig?.inCheckin);
    const activeProtocols = protocols.filter(p => p.active);

    const isFormComplete = () => {
        for (const tracker of checkinTrackers) {
            if (tracker.checkinConfig?.isRequired) {
                if (trackerValues[tracker.id] === undefined || trackerValues[tracker.id] === null || trackerValues[tracker.id] === '') {
                    return false;
                }
            }
        }
        return true;
    };

    const handleTrackerChange = (trackerId: string, value: number | string) => {
        setTrackerValues(prev => ({ ...prev, [trackerId]: value }));
    };

    const handleSubmit = async () => {
        try {
            const targetDate = new Date(date);
            targetDate.setHours(12, 0, 0, 0);
            const timestamp = targetDate.toISOString();

            const promises = [];

            if (showProtocols) {
                const existingDoseProtocolIds = new Set(existingDoses.filter(d => !d.skipped && d.takenAt).map(d => d.protocolId));
                for (const [id, log] of Object.entries(protocolLogs)) {
                    if (log.taken && !existingDoseProtocolIds.has(id)) {
                        promises.push(logDose(id));
                    }
                }
            }

            Object.entries(trackerValues).forEach(([trackerId, value]) => {
                const tracker = trackers.find(t => t.id === trackerId);
                const isTextType = tracker?.type === 'text';
                const existingEntry = existingEntryMap[trackerId];

                if (existingEntry) {
                    promises.push(updateEntry({
                        ...existingEntry,
                        value: isTextType ? 0 : Number(value),
                        textValue: isTextType ? String(value) : undefined,
                    }));
                } else {
                    promises.push(addEntry({
                        trackerId,
                        value: isTextType ? 0 : Number(value),
                        textValue: isTextType ? String(value) : undefined,
                        notes: 'Daily Check-in',
                        timestamp
                    }));
                }
            });

            const sleepHours = Number(trackerValues['sleep_hours']);
            const sleepQuality = Number(trackerValues['sleep_quality']);

            if (!isNaN(sleepHours) && !isNaN(sleepQuality)) {
                let durationScore = 100;
                if (sleepHours < 7) durationScore -= (7 - sleepHours) * 15;
                if (sleepHours > 9) durationScore -= (sleepHours - 9) * 10;
                durationScore = Math.max(0, Math.min(100, durationScore));
                const qualityScore = sleepQuality * 10;
                const finalSleepScore = Math.round((durationScore * 0.6) + (qualityScore * 0.4));

                const scoreTracker = trackers.find(t => t.id === 'sleep_score');
                if (scoreTracker) {
                    promises.push(addEntry({
                        trackerId: 'sleep_score',
                        value: finalSleepScore,
                        timestamp,
                        notes: 'Calculated Sleep Score'
                    }));
                }
            }

            await Promise.all(promises);
            setSubmitStatus('success');
            setTimeout(() => {
                setSubmitStatus('idle');
                if (onComplete) onComplete();
            }, 1000);

        } catch (e) {
            console.error(e);
            setSubmitStatus('error');
        }
    };

    const renderInput = (tracker: TrackerDefinition) => {
        const isRequired = tracker.checkinConfig?.isRequired;
        const hasValue = trackerValues[tracker.id] !== undefined && trackerValues[tracker.id] !== null && trackerValues[tracker.id] !== '';

        return (
            <div key={tracker.id} className={`bg-white rounded-xl p-6 shadow-sm border transition-colors ${isRequired && !hasValue
                ? 'border-rose-200'
                : 'border-slate-100'
                }`}>
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-1">
                    <span className="text-xl">{tracker.emoji}</span>
                    {tracker.name}
                    {isRequired && <span className="text-rose-500 text-sm">*</span>}
                </h2>
                
                <div className="mt-4">
                    {tracker.type === 'rating' && (
                        <div className="flex gap-1.5 sm:gap-2">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                                <button
                                    key={num}
                                    type="button"
                                    onClick={() => handleTrackerChange(tracker.id, num)}
                                    className={`flex-1 py-3 sm:py-4 rounded-lg text-sm sm:text-base font-bold transition-all ${trackerValues[tracker.id] === num
                                        ? 'bg-indigo-600 text-white shadow-md scale-105 z-10'
                                        : 'bg-slate-50 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200'
                                        }`}
                                >
                                    {num}
                                </button>
                            ))}
                        </div>
                    )}

                    {tracker.type === 'boolean' && (
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => handleTrackerChange(tracker.id, 1)}
                                className={`flex-1 py-3.5 rounded-xl text-base font-bold transition-all border ${trackerValues[tracker.id] === 1
                                    ? 'bg-emerald-500 text-white border-emerald-600 shadow-md'
                                    : 'bg-slate-50 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 border-slate-200'
                                    }`}
                            >
                                ✓ Yes
                            </button>
                            <button
                                type="button"
                                onClick={() => handleTrackerChange(tracker.id, 0)}
                                className={`flex-1 py-3.5 rounded-xl text-base font-bold transition-all border ${trackerValues[tracker.id] === 0
                                    ? 'bg-slate-500 text-white border-slate-600 shadow-md'
                                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-800 border-slate-200'
                                    }`}
                            >
                                ✕ No
                            </button>
                        </div>
                    )}

                    {(tracker.type === 'number' || tracker.type === 'text') && (
                        <div className="relative">
                            <input
                                type={tracker.type === 'number' ? "number" : "text"}
                                step={tracker.id === 'sleep_hours' || tracker.name?.toLowerCase().includes('sleep') ? "0.5" : "any"}
                                value={trackerValues[tracker.id] || ''}
                                onChange={(e) => handleTrackerChange(tracker.id, tracker.type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                                placeholder={tracker.unit ? `e.g. 5 ${tracker.unit}` : "Enter value..."}
                                className="w-full px-4 py-3.5 text-base border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-slate-50 transition-shadow"
                            />
                            {tracker.unit && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium pointer-events-none">{tracker.unit}</span>}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (trackers.length === 0) {
        return (
            <div className="p-8 text-center text-slate-500 bg-white rounded-xl shadow-sm border border-slate-100">
                <div className="mb-4">No trackers defined yet.</div>
                {onManageTrackers && (
                    <button 
                        onClick={onManageTrackers}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                    >
                        Create a Tracker
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {showDatePicker && onDateChange && (
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-800">Check-in Date</h2>
                        <p className="text-xs text-slate-500">Log entries for a specific day</p>
                    </div>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="date"
                            value={format(date, 'yyyy-MM-dd')}
                            onChange={(e) => onDateChange(new Date(e.target.value + 'T12:00:00'))}
                            className="pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50"
                            required
                        />
                    </div>
                </div>
            )}

            {showProtocols && activeProtocols.length > 0 && (
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                    <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4">
                        <Pill className="text-indigo-500" size={20} /> Protocols
                    </h2>
                    <div className="space-y-3">
                        {activeProtocols.map(p => (
                            <label key={p.id} className="flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-indigo-50 transition-colors border border-slate-200">
                                <div className="min-w-0 flex-1">
                                    <div className="font-medium text-slate-800 truncate" title={p.name}>{p.name}</div>
                                    <div className="text-sm text-slate-500">{p.doseAmount} {p.doseUnit}</div>
                                </div>
                                <div className="relative shrink-0 mr-1">
                                    <input
                                        type="checkbox"
                                        className="w-6 h-6 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        checked={!!protocolLogs[p.id]?.taken}
                                        onChange={(e) => {
                                            setProtocolLogs(prev => e.target.checked
                                                ? { ...prev, [p.id]: { taken: true } }
                                                : { ...prev, [p.id]: { taken: false } }
                                            );
                                        }}
                                    />
                                </div>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            <div className="space-y-6">
                {checkinTrackers.map(tracker => renderInput(tracker))}
            </div>

            {onManageTrackers && (
                <button 
                    onClick={onManageTrackers}
                    className="w-full py-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 font-medium hover:bg-slate-50 hover:text-slate-700 transition-colors flex items-center justify-center gap-2"
                >
                    <Settings size={18} />
                    Manage Trackers
                </button>
            )}

            <div className="pt-2 pb-8">
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!isFormComplete() || submitStatus !== 'idle'}
                    className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-indigo-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                    {submitStatus === 'success' ? (
                        <>
                            <CheckCircle size={22} />
                            Saved!
                        </>
                    ) : (
                        'Save check-in'
                    )}
                </button>
                {!isFormComplete() && (
                    <p className="text-center text-slate-400 text-xs mt-3 font-medium">
                        Fill all <span className="text-rose-400">required</span> fields to complete
                    </p>
                )}
            </div>
        </div>
    );
};

export default CheckinForm;
