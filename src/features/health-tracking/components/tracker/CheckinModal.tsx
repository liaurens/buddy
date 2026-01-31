import React, { useState, useEffect, useMemo } from 'react';
import { useTracker } from '../../../../context/TrackerContext';
import { useProtocol } from '../../../../context/ProtocolContext';
import { CheckCircle, X, Pill, Moon } from 'lucide-react';
import type { TrackerDefinition, Entry, Dose } from '../../../../types';

interface CheckinModalProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: () => void;
    date?: Date; // Optional date for backdating
    existingEntries?: Entry[]; // Existing entries for the date
    existingDoses?: Dose[]; // Existing doses for the date
}

const CheckinModal: React.FC<CheckinModalProps> = ({ isOpen, onClose, onComplete, date, existingEntries = [], existingDoses = [] }) => {
    const { trackers, addEntry, updateEntry } = useTracker();
    const { protocols, logDose } = useProtocol();

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

    // Pre-populate form with existing data when modal opens
    useEffect(() => {
        if (isOpen) {
            // Populate tracker values from existing entries
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

            // Populate protocol logs from existing doses
            const initialProtocols: Record<string, { taken: boolean }> = {};
            existingDoses.forEach(dose => {
                if (!dose.skipped && dose.takenAt) {
                    initialProtocols[dose.protocolId] = { taken: true };
                }
            });
            setProtocolLogs(initialProtocols);

            setSubmitStatus('idle');
        }
    }, [isOpen, existingEntries, existingDoses, trackers]);

    if (!isOpen) return null;

    // Filter trackers that should be in the check-in
    const checkinTrackers = trackers.filter(t => t.checkinConfig?.inCheckin);

    // Group check-in trackers for better UI
    const sleepTrackers = checkinTrackers.filter(t => t.group === 'Health' && t.name.toLowerCase().includes('sleep'));
    const otherTrackers = checkinTrackers.filter(t => !sleepTrackers.includes(t));

    const activeProtocols = protocols.filter(p => p.active);

    // Check if check-in is "complete" (all required fields filled)
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
            // Use provided date (noon to avoid timezone shifts?) or current time
            const targetDate = date ? new Date(date) : new Date();
            if (date) {
                targetDate.setHours(12, 0, 0, 0);
            }
            const timestamp = targetDate.toISOString();

            // 1. Log Protocols (only new ones that weren't already logged)
            const existingDoseProtocolIds = new Set(existingDoses.filter(d => !d.skipped && d.takenAt).map(d => d.protocolId));
            for (const [id, log] of Object.entries(protocolLogs)) {
                if (log.taken && !existingDoseProtocolIds.has(id)) {
                    await logDose(id);
                }
            }

            // 2. Log Trackers - update existing or create new
            const promises = Object.entries(trackerValues).map(([trackerId, value]) => {
                const tracker = trackers.find(t => t.id === trackerId);
                const isTextType = tracker?.type === 'text';
                const existingEntry = existingEntryMap[trackerId];

                if (existingEntry) {
                    // Update existing entry
                    return updateEntry({
                        ...existingEntry,
                        value: isTextType ? 0 : Number(value),
                        textValue: isTextType ? String(value) : undefined,
                    });
                } else {
                    // Create new entry
                    return addEntry({
                        trackerId,
                        value: isTextType ? 0 : Number(value),
                        textValue: isTextType ? String(value) : undefined,
                        notes: 'Daily Check-in',
                        timestamp
                    });
                }
            });

            // 3. Calculate Sleep Score (Scientific-ish) logic... 
            // (Reusing logic from DailyReportPage if needed, or simplified)
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
                onComplete();
                onClose();
            }, 1000);

        } catch (e) {
            console.error(e);
            setSubmitStatus('error');
        }
    };

    const renderInput = (tracker: TrackerDefinition) => {
        const isRequired = tracker.checkinConfig?.isRequired;

        return (
            <div className={`p-2 rounded-lg border transition-colors ${isRequired && !trackerValues[tracker.id] && trackerValues[tracker.id] !== 0
                ? 'bg-rose-50 border-rose-100'
                : 'bg-white border-slate-100'
                }`}>
                <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium text-slate-700 flex items-center gap-1 truncate pr-1">
                        <span className="text-sm leading-none">{tracker.emoji}</span>
                        <span className="truncate">{tracker.name}</span>
                        {isRequired && <div className="h-1 w-1 rounded-full bg-rose-500 shrink-0" title="Required" />}
                    </label>
                </div>

                {tracker.type === 'rating' && (
                    <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                            <button
                                key={num}
                                onClick={() => handleTrackerChange(tracker.id, num)}
                                className={`flex-1 h-6 rounded text-[9px] font-bold transition-all ${trackerValues[tracker.id] === num
                                    ? 'bg-indigo-600 text-white shadow-sm scale-105 z-10'
                                    : 'bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600'
                                    }`}
                            >
                                {num}
                            </button>
                        ))}
                    </div>
                )}

                {tracker.type === 'boolean' && (
                    <div className="flex gap-1.5">
                        <button
                            onClick={() => handleTrackerChange(tracker.id, 1)}
                            className={`flex-1 py-1 rounded-md text-[11px] font-bold transition-all ${trackerValues[tracker.id] === 1
                                ? 'bg-emerald-500 text-white shadow-sm'
                                : 'bg-slate-50 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'
                                }`}
                        >
                            Yes
                        </button>
                        <button
                            onClick={() => handleTrackerChange(tracker.id, 0)}
                            className={`flex-1 py-1 rounded-md text-[11px] font-bold transition-all ${trackerValues[tracker.id] === 0
                                ? 'bg-slate-500 text-white shadow-sm'
                                : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                                }`}
                        >
                            No
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
                            placeholder={tracker.unit || "Value"}
                            className="w-full text-xs pl-2 pr-8 py-1 border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none bg-slate-50/50"
                        />
                        {tracker.unit && <span className="absolute right-2 top-1 text-slate-400 text-[10px] font-medium pointer-events-none">{tracker.unit}</span>}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
            <div className="min-h-screen p-3 flex flex-col max-w-xl mx-auto">
                <div className="flex justify-between items-center text-white mb-4 mt-1">
                    <h2 className="text-xl font-bold">Daily Check-in</h2>
                    <button onClick={onClose} className="p-1.5 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-3 flex-1 pb-4">
                    {/* 1. Protocols */}
                    {activeProtocols.length > 0 && (
                        <section className="bg-white rounded-xl p-3 shadow-md">
                            <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-1.5 uppercase tracking-wide text-slate-500">
                                <Pill className="text-indigo-500" size={16} /> Protocols
                            </h3>
                            <div className="space-y-2">
                                {activeProtocols.map(p => (
                                    <label key={p.id} className="flex items-center justify-between gap-2 p-2 bg-slate-50 rounded-lg cursor-pointer hover:bg-indigo-50 transition-colors ring-1 ring-slate-100">
                                        <div className="min-w-0 flex-1">
                                            <div className="font-medium text-sm text-slate-800 truncate" title={p.name}>{p.name}</div>
                                            <div className="text-xs text-slate-500">{p.doseAmount} {p.doseUnit}</div>
                                        </div>
                                        <div className="relative shrink-0">
                                            <input
                                                type="checkbox"
                                                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
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
                        </section>
                    )}

                    {/* 2. Sleep Section */}
                    {(sleepTrackers.length > 0) && (
                        <section className="bg-white rounded-xl p-3 shadow-md space-y-2">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Moon size={14} /> Sleep
                            </h3>
                            <div className="space-y-2">
                                {sleepTrackers.map(t => (
                                    <div key={t.id}>{renderInput(t)}</div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* 3. Grouped Trackers */}
                    {Object.entries(
                        otherTrackers.reduce((acc, t) => {
                            const group = t.group || 'Other';
                            if (!acc[group]) acc[group] = [];
                            acc[group].push(t);
                            return acc;
                        }, {} as Record<string, TrackerDefinition[]>)
                    ).map(([group, trackers]) => (
                        <section key={group} className="bg-white rounded-xl p-3 shadow-md space-y-2">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                {group}
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {trackers.map(tracker => (
                                    <div key={tracker.id} className={tracker.type === 'boolean' || tracker.type === 'rating' ? '' : 'col-span-1 sm:col-span-2'}>
                                        {renderInput(tracker)}
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>

                {/* Footer Action */}
                <div className="mt-4 pt-3 pb-6">
                    <div className="max-w-xl mx-auto">
                        <button
                            onClick={handleSubmit}
                            disabled={!isFormComplete() || submitStatus !== 'idle'}
                            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-lg shadow-lg shadow-indigo-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            {submitStatus === 'success' ? (
                                <>
                                    <CheckCircle size={20} />
                                    Saved!
                                </>
                            ) : (
                                'Complete Check-in'
                            )}
                        </button>
                        {!isFormComplete() && (
                            <p className="text-center text-slate-400 text-xs mt-2 font-medium">
                                Fill all <span className="text-rose-400">required</span> fields to complete
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CheckinModal;
