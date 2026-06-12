import React, { useState, useEffect, useMemo } from 'react';
import { useTrackers } from '../../hooks/useTrackers';
import { useProtocols } from '../../hooks/useProtocols';
import { CheckCircle, Pill, Calendar, Settings, Plus, Check, X } from 'lucide-react';
import type { TrackerDefinition, TrackerScale, ScaleDirection, Entry, Dose } from '../../types';
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

const DEFAULT_SCALE: TrackerScale = {
    min: 1, max: 10, step: 1, lowLabel: 'Low', highLabel: 'High', direction: 'higher_better',
};

// Color a rating button based on its position in the scale and direction.
// Returns Tailwind classes for the *selected* state. Unselected uses neutral slate.
function ratingTone(value: number, scale: TrackerScale): string {
    const { min, max, direction } = scale;
    const t = (value - min) / Math.max(1, max - min); // 0..1
    const goodness =
        direction === 'higher_better' ? t :
        direction === 'lower_better' ? 1 - t :
        0.5;

    if (direction === 'neutral') return 'bg-indigo-600 text-white border-indigo-700';
    if (goodness >= 0.75) return 'bg-emerald-500 text-white border-emerald-600';
    if (goodness >= 0.5)  return 'bg-lime-500 text-white border-lime-600';
    if (goodness >= 0.25) return 'bg-amber-500 text-white border-amber-600';
    return 'bg-rose-500 text-white border-rose-600';
}

function captionForDirection(value: number, scale: TrackerScale): string {
    const { min, max, lowLabel, highLabel, direction } = scale;
    const t = (value - min) / Math.max(1, max - min);
    if (direction === 'neutral') return `${value} / ${max}`;
    const leaning = t >= 0.5 ? highLabel : lowLabel;
    return `${value} / ${max} — leaning ${leaning.toLowerCase()}`;
}

interface RatingScaleProps {
    scale: TrackerScale;
    value: number | undefined;
    onChange: (n: number) => void;
}

const RatingScale: React.FC<RatingScaleProps> = ({ scale, value, onChange }) => {
    const step = scale.step ?? 1;
    const buttons = useMemo(() => {
        const arr: number[] = [];
        for (let n = scale.min; n <= scale.max; n += step) arr.push(n);
        return arr;
    }, [scale.min, scale.max, step]);

    const directionHint: Record<ScaleDirection, string> = {
        higher_better: '↑ better',
        lower_better: '↓ better',
        neutral: '',
    };

    return (
        <div className="space-y-2">
            <div className="flex items-end justify-between text-xs">
                <span className="font-medium text-slate-500">{scale.lowLabel}</span>
                {scale.direction !== 'neutral' && (
                    <span className="text-slate-400">{directionHint[scale.direction]}</span>
                )}
                <span className="font-medium text-slate-500 text-right">{scale.highLabel}</span>
            </div>
            <div className="flex gap-1">
                {buttons.map(n => {
                    const selected = value === n;
                    return (
                        <button
                            key={n}
                            type="button"
                            onClick={() => onChange(n)}
                            className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all border ${
                                selected
                                    ? `${ratingTone(n, scale)} shadow-md scale-105 z-10`
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            {n}
                        </button>
                    );
                })}
            </div>
            {value !== undefined && (
                <p className="text-xs text-slate-500 pt-1">{captionForDirection(Number(value), scale)}</p>
            )}
        </div>
    );
};

const CheckinForm: React.FC<CheckinFormProps> = ({
    date,
    onDateChange,
    showProtocols = true,
    showDatePicker = false,
    onComplete,
    onManageTrackers,
    existingEntries = EMPTY_ARRAY,
    existingDoses = EMPTY_ARRAY,
}) => {
    const { trackers, addEntry, updateEntry } = useTrackers();
    const { protocols, logDose } = useProtocols();

    const [trackerValues, setTrackerValues] = useState<Record<string, number | string>>({});
    const [protocolLogs, setProtocolLogs] = useState<Record<string, { taken: boolean }>>({});
    const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

    // Episodic UI state: which tracker's mini-form is open, transient values, and ids that just logged successfully
    const [openEpisodic, setOpenEpisodic] = useState<string | null>(null);
    const [episodicDraft, setEpisodicDraft] = useState<Record<string, number | string>>({});
    const [episodicLogged, setEpisodicLogged] = useState<Set<string>>(new Set());
    const [episodicError, setEpisodicError] = useState<string | null>(null);

    const existingEntryMap = useMemo(() => {
        const map: Record<string, Entry> = {};
        existingEntries.forEach(entry => { map[entry.trackerId] = entry; });
        return map;
    }, [existingEntries]);

    useEffect(() => {
        const initialValues: Record<string, number | string> = {};
        existingEntries.forEach(entry => {
            const tracker = trackers.find(t => t.id === entry.trackerId);
            if (tracker) {
                initialValues[entry.trackerId] = tracker.type === 'text' ? (entry.textValue || '') : entry.value;
            }
        });
        setTrackerValues(initialValues);

        const initialProtocols: Record<string, { taken: boolean }> = {};
        existingDoses.forEach(dose => {
            if (!dose.skipped && dose.takenAt) initialProtocols[dose.protocolId] = { taken: true };
        });
        setProtocolLogs(initialProtocols);

        // Pre-mark episodic trackers that already have an entry for this date as logged
        const alreadyLogged = new Set<string>();
        existingEntries.forEach(entry => {
            const tracker = trackers.find(t => t.id === entry.trackerId);
            if (tracker?.cadence === 'episodic') alreadyLogged.add(entry.trackerId);
        });
        setEpisodicLogged(alreadyLogged);
        setOpenEpisodic(null);
        setEpisodicDraft({});

        setSubmitStatus('idle');
    }, [existingEntries, existingDoses, trackers, date]);

    const dailyTrackers = trackers.filter(t => (t.cadence ?? 'daily') === 'daily' && t.checkinConfig?.inCheckin);
    const episodicTrackers = trackers.filter(t => t.cadence === 'episodic' && t.checkinConfig?.inCheckin);
    const activeProtocols = protocols.filter(p => p.active);

    const isFormComplete = () => {
        for (const tracker of dailyTrackers) {
            if (tracker.checkinConfig?.isRequired) {
                const v = trackerValues[tracker.id];
                if (v === undefined || v === null || v === '') return false;
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

            const promises: Promise<unknown>[] = [];

            if (showProtocols) {
                const existingDoseProtocolIds = new Set(
                    existingDoses.filter(d => !d.skipped && d.takenAt).map(d => d.protocolId)
                );
                for (const [id, log] of Object.entries(protocolLogs)) {
                    if (log.taken && !existingDoseProtocolIds.has(id)) promises.push(logDose(id));
                }
            }

            Object.entries(trackerValues).forEach(([trackerId, value]) => {
                const tracker = trackers.find(t => t.id === trackerId);
                if (!tracker) return;
                const isText = tracker.type === 'text';
                const existingEntry = existingEntryMap[trackerId];

                if (existingEntry) {
                    promises.push(updateEntry({
                        ...existingEntry,
                        value: isText ? 0 : Number(value),
                        textValue: isText ? String(value) : undefined,
                    }));
                } else {
                    promises.push(addEntry({
                        trackerId,
                        value: isText ? 0 : Number(value),
                        textValue: isText ? String(value) : undefined,
                        notes: 'Daily Check-in',
                        timestamp,
                    }));
                }
            });

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

    const saveEpisodic = async (tracker: TrackerDefinition) => {
        const draft = episodicDraft[tracker.id];
        if (draft === undefined || draft === '') return;
        try {
            setEpisodicError(null);
            const targetDate = new Date(date);
            targetDate.setHours(12, 0, 0, 0);
            const isText = tracker.type === 'text';
            await addEntry({
                trackerId: tracker.id,
                value: isText ? 0 : Number(draft),
                textValue: isText ? String(draft) : undefined,
                notes: 'Episodic log',
                timestamp: targetDate.toISOString(),
            });
            setEpisodicLogged(prev => new Set(prev).add(tracker.id));
            setOpenEpisodic(null);
            setEpisodicDraft(prev => {
                const next = { ...prev };
                delete next[tracker.id];
                return next;
            });
        } catch (e) {
            console.error(e);
            setEpisodicError('Could not save. Try again.');
        }
    };

    const renderInput = (tracker: TrackerDefinition) => {
        const isRequired = tracker.checkinConfig?.isRequired;
        const value = trackerValues[tracker.id];
        const hasValue = value !== undefined && value !== null && value !== '';
        const scale = tracker.scale ?? DEFAULT_SCALE;

        return (
            <div
                key={tracker.id}
                className={`bg-white rounded-2xl p-5 border transition-colors ${
                    isRequired && !hasValue ? 'border-rose-200' : 'border-slate-100'
                }`}
            >
                <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2 mb-3">
                    <span className="text-xl">{tracker.emoji}</span>
                    <span>{tracker.name}</span>
                    {isRequired && <span className="text-rose-500 text-sm">*</span>}
                </h2>

                {tracker.type === 'rating' && (
                    <RatingScale
                        scale={scale}
                        value={typeof value === 'number' ? value : undefined}
                        onChange={(n) => handleTrackerChange(tracker.id, n)}
                    />
                )}

                {tracker.type === 'boolean' && (
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => handleTrackerChange(tracker.id, 1)}
                            className={`flex-1 py-3 rounded-xl text-base font-bold transition-all border ${
                                value === 1
                                    ? 'bg-emerald-500 text-white border-emerald-600 shadow-md'
                                    : 'bg-slate-50 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 border-slate-200'
                            }`}
                        >
                            ✓ Yes
                        </button>
                        <button
                            type="button"
                            onClick={() => handleTrackerChange(tracker.id, 0)}
                            className={`flex-1 py-3 rounded-xl text-base font-bold transition-all border ${
                                value === 0
                                    ? 'bg-slate-500 text-white border-slate-600 shadow-md'
                                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                            }`}
                        >
                            ✕ No
                        </button>
                    </div>
                )}

                {tracker.type === 'number' && (
                    <div>
                        <div className="relative">
                            <input
                                type="number"
                                step={tracker.scale?.step ?? 'any'}
                                min={tracker.scale?.min}
                                max={tracker.scale?.max}
                                value={value ?? ''}
                                onChange={(e) => handleTrackerChange(tracker.id, e.target.value === '' ? '' : parseFloat(e.target.value))}
                                placeholder={tracker.unit ? `e.g. 5 ${tracker.unit}` : 'Enter value...'}
                                className="w-full px-4 py-3 text-base border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-slate-50"
                            />
                            {tracker.unit && (
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium pointer-events-none">
                                    {tracker.unit}
                                </span>
                            )}
                        </div>
                        {tracker.scale && tracker.scale.direction !== 'neutral' && (
                            <p className="text-xs text-slate-400 mt-2">
                                {tracker.scale.lowLabel} ({tracker.scale.min}) — {tracker.scale.highLabel} ({tracker.scale.max}) ·{' '}
                                {tracker.scale.direction === 'higher_better' ? 'higher is better' : 'lower is better'}
                            </p>
                        )}
                    </div>
                )}

                {tracker.type === 'text' && (
                    <textarea
                        value={value ?? ''}
                        onChange={(e) => handleTrackerChange(tracker.id, e.target.value)}
                        placeholder="Write a note..."
                        rows={3}
                        className="w-full px-4 py-3 text-base border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-slate-50 resize-none"
                    />
                )}
            </div>
        );
    };

    const renderEpisodicEditor = (tracker: TrackerDefinition) => {
        const scale = tracker.scale ?? DEFAULT_SCALE;
        const draft = episodicDraft[tracker.id];

        return (
            <div className="mt-3 bg-white border border-indigo-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                        <span className="text-lg">{tracker.emoji}</span>
                        Log {tracker.name.toLowerCase()}
                    </h3>
                    <button
                        type="button"
                        onClick={() => { setOpenEpisodic(null); setEpisodicError(null); }}
                        className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md"
                        aria-label="Close"
                    >
                        <X size={16} />
                    </button>
                </div>

                {tracker.type === 'rating' && (
                    <RatingScale
                        scale={scale}
                        value={typeof draft === 'number' ? draft : undefined}
                        onChange={(n) => setEpisodicDraft(prev => ({ ...prev, [tracker.id]: n }))}
                    />
                )}

                {tracker.type === 'number' && (
                    <div className="relative">
                        <input
                            type="number"
                            step={scale.step ?? 'any'}
                            min={scale.min}
                            max={scale.max}
                            value={draft ?? ''}
                            onChange={(e) => setEpisodicDraft(prev => ({
                                ...prev,
                                [tracker.id]: e.target.value === '' ? '' : parseFloat(e.target.value),
                            }))}
                            placeholder={tracker.unit ? `e.g. 2 ${tracker.unit}` : 'Enter value...'}
                            autoFocus
                            className="w-full px-4 py-3 text-base border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50"
                        />
                        {tracker.unit && (
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium pointer-events-none">
                                {tracker.unit}
                            </span>
                        )}
                    </div>
                )}

                {tracker.type === 'boolean' && (
                    <div className="flex gap-3">
                        {[1, 0].map(v => (
                            <button
                                key={v}
                                type="button"
                                onClick={() => setEpisodicDraft(prev => ({ ...prev, [tracker.id]: v }))}
                                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border ${
                                    draft === v
                                        ? (v === 1 ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-slate-500 text-white border-slate-600')
                                        : 'bg-slate-50 text-slate-600 border-slate-200'
                                }`}
                            >
                                {v === 1 ? '✓ Yes' : '✕ No'}
                            </button>
                        ))}
                    </div>
                )}

                {tracker.type === 'text' && (
                    <textarea
                        value={draft ?? ''}
                        onChange={(e) => setEpisodicDraft(prev => ({ ...prev, [tracker.id]: e.target.value }))}
                        placeholder="Describe..."
                        rows={2}
                        autoFocus
                        className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50 resize-none"
                    />
                )}

                {episodicError && <p className="text-xs text-rose-600">{episodicError}</p>}

                <button
                    type="button"
                    onClick={() => saveEpisodic(tracker)}
                    disabled={episodicDraft[tracker.id] === undefined || episodicDraft[tracker.id] === ''}
                    className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                >
                    Log it
                </button>
            </div>
        );
    };

    if (trackers.length === 0) {
        return (
            <div className="p-8 text-center text-slate-500 bg-white rounded-2xl shadow-sm border border-slate-100">
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
        <div className="max-w-2xl mx-auto space-y-5">
            {showDatePicker && onDateChange && (
                <div className="bg-white rounded-2xl p-5 border border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-semibold text-slate-800">Check-in date</h2>
                        <p className="text-xs text-slate-500">Log entries for a specific day</p>
                    </div>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="date"
                            value={format(date, 'yyyy-MM-dd')}
                            onChange={(e) => onDateChange(new Date(e.target.value + 'T12:00:00'))}
                            className="pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50"
                            required
                        />
                    </div>
                </div>
            )}

            {showProtocols && activeProtocols.length > 0 && (
                <div className="bg-white rounded-2xl p-5 border border-slate-100">
                    <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2 mb-3">
                        <Pill className="text-indigo-500" size={18} /> Protocols
                    </h2>
                    <div className="space-y-2">
                        {activeProtocols.map(p => (
                            <label
                                key={p.id}
                                className="flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-indigo-50 transition-colors border border-slate-200"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="font-medium text-slate-800 truncate" title={p.name}>{p.name}</div>
                                    <div className="text-xs text-slate-500">{p.doseAmount} {p.doseUnit}</div>
                                </div>
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    checked={!!protocolLogs[p.id]?.taken}
                                    onChange={(e) =>
                                        setProtocolLogs(prev =>
                                            e.target.checked
                                                ? { ...prev, [p.id]: { taken: true } }
                                                : { ...prev, [p.id]: { taken: false } }
                                        )
                                    }
                                />
                            </label>
                        ))}
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {dailyTrackers.map(tracker => renderInput(tracker))}
            </div>

            {episodicTrackers.length > 0 && (
                <div className="bg-white rounded-2xl p-5 border border-slate-100">
                    <h2 className="text-base font-semibold text-slate-800 mb-1">Anything occasional?</h2>
                    <p className="text-xs text-slate-500 mb-3">Only log these when they actually happened.</p>
                    <div className="flex flex-wrap gap-2">
                        {episodicTrackers.map(tracker => {
                            const logged = episodicLogged.has(tracker.id);
                            const isOpen = openEpisodic === tracker.id;
                            return (
                                <button
                                    key={tracker.id}
                                    type="button"
                                    onClick={() => setOpenEpisodic(isOpen ? null : tracker.id)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                                        logged
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : isOpen
                                                ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-indigo-300'
                                    }`}
                                >
                                    <span>{tracker.emoji}</span>
                                    <span>{tracker.name}</span>
                                    {logged ? <Check size={13} /> : <Plus size={13} />}
                                </button>
                            );
                        })}
                    </div>
                    {openEpisodic && (() => {
                        const tracker = episodicTrackers.find(t => t.id === openEpisodic);
                        return tracker ? renderEpisodicEditor(tracker) : null;
                    })()}
                </div>
            )}

            {onManageTrackers && (
                <button
                    onClick={onManageTrackers}
                    className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-500 font-medium hover:bg-slate-50 hover:text-slate-700 transition-colors flex items-center justify-center gap-2"
                >
                    <Settings size={18} />
                    Manage trackers
                </button>
            )}

            <div className="pt-2 pb-8">
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!isFormComplete() || submitStatus !== 'idle'}
                    className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-indigo-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-2"
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
