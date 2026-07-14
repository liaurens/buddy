import React, { useState, useEffect } from 'react';
import { CheckCircle, Calendar, Trash2, Tag } from 'lucide-react';
import type { ExperimentMetric, ExperimentCheckinEntry, ExperimentPhase } from '../../types';
import { format } from 'date-fns';
import { getCurrentPhaseForDate } from './ExperimentPhaseTimeline';

interface ExperimentCheckinFormProps {
    metrics: ExperimentMetric[];
    phases: ExperimentPhase[];
    date: string;
    existingEntries?: ExperimentCheckinEntry[];
    onSave: (
        date: string,
        entries: { metricId: string; value?: number; textValue?: string; phaseId?: string }[],
    ) => Promise<void>;
    onDelete?: (date: string) => Promise<void>;
}

const NOTES_METRIC_ID = '__notes';

const ExperimentCheckinForm: React.FC<ExperimentCheckinFormProps> = ({
    metrics,
    phases,
    date,
    existingEntries = [],
    onSave,
    onDelete,
}) => {
    const [values, setValues] = useState<Record<string, number | string>>({});
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const currentPhase =
        phases.length > 0 ? getCurrentPhaseForDate(phases, new Date(date)) : undefined;

    // Pre-populate from existing entries
    useEffect(() => {
        const initial: Record<string, number | string> = {};
        let loadedNotes = '';
        existingEntries.forEach((entry) => {
            if (entry.metricId === NOTES_METRIC_ID) {
                loadedNotes = entry.textValue ?? '';
                return;
            }
            if (entry.textValue) {
                initial[entry.metricId] = entry.textValue;
            } else if (entry.value !== undefined) {
                initial[entry.metricId] = entry.value;
            }
        });
        setNotes(loadedNotes);
        setValues(initial);
        setSaved(false);
    }, [existingEntries, date]);

    const setValue = (metricId: string, val: number | string) => {
        setValues((prev) => ({ ...prev, [metricId]: val }));
        setSaved(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const phase = getCurrentPhaseForDate(phases, new Date(date));
            const entries: {
                metricId: string;
                value?: number;
                textValue?: string;
                phaseId?: string;
            }[] = metrics
                .filter((m) => values[m.id] !== undefined && values[m.id] !== '')
                .map((m) => ({
                    metricId: m.id,
                    value: typeof values[m.id] === 'number' ? (values[m.id] as number) : undefined,
                    textValue:
                        typeof values[m.id] === 'string' ? (values[m.id] as string) : undefined,
                    phaseId: phase?.id,
                }));

            entries.push({ metricId: NOTES_METRIC_ID, textValue: notes, phaseId: phase?.id });

            await onSave(date, entries);
            setSaved(true);
        } finally {
            setSaving(false);
        }
    };

    const requiredFilled = metrics
        .filter((m) => m.required)
        .every((m) => values[m.id] !== undefined && values[m.id] !== '');

    if (metrics.length === 0) {
        return (
            <div className="text-center py-8 text-slate-400">
                <p>No custom metrics defined yet.</p>
                <p className="text-sm mt-1">Add metrics in the Settings tab.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Calendar size={14} />
                    <span>{format(new Date(date), 'EEEE, MMM d')}</span>
                </div>
                {currentPhase && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-violet-50 text-violet-700 rounded-lg text-xs font-medium">
                        <Tag size={11} />
                        <span>{currentPhase.name}</span>
                    </div>
                )}
            </div>

            <div className="space-y-4">
                {metrics.map((metric) => (
                    <div key={metric.id} className="space-y-1.5">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <span>{metric.emoji}</span>
                            <span>{metric.name}</span>
                            {metric.required && (
                                <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                            )}
                        </label>
                        {metric.description && (
                            <p className="text-xs text-slate-400">{metric.description}</p>
                        )}
                        {renderInput(metric, values[metric.id], (val) => setValue(metric.id, val))}
                    </div>
                ))}
            </div>

            <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <span>📝</span>
                    <span>Notes for today</span>
                    <span className="text-xs font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                    value={notes}
                    onChange={(e) => {
                        setNotes(e.target.value);
                        setSaved(false);
                    }}
                    placeholder="How did it go? Any observations or context..."
                    rows={2}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
            </div>

            <div className="flex gap-3">
                {existingEntries.length > 0 && onDelete && (
                    <button
                        onClick={async () => {
                            if (window.confirm('Delete check-in for this date?')) {
                                setSaving(true);
                                try {
                                    await onDelete(date);
                                    setValues({});
                                    setSaved(false);
                                } finally {
                                    setSaving(false);
                                }
                            }
                        }}
                        disabled={saving}
                        className="px-4 py-3 rounded-xl font-medium transition-all bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:opacity-50 flex items-center justify-center"
                        title="Delete check-in for this date"
                    >
                        <Trash2 size={18} />
                    </button>
                )}
                <button
                    onClick={handleSave}
                    disabled={saving || !requiredFilled}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all ${
                        saved
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50'
                    }`}
                >
                    {saved ? (
                        <>
                            <CheckCircle size={18} /> Saved
                        </>
                    ) : saving ? (
                        'Saving...'
                    ) : (
                        'Save Check-in'
                    )}
                </button>
            </div>
        </div>
    );
};

function renderInput(
    metric: ExperimentMetric,
    value: number | string | undefined,
    onChange: (val: number | string) => void,
) {
    switch (metric.type) {
        case 'rating': {
            const max = metric.max || 10;
            const min = metric.min || 1;
            const count = max - min + 1;
            return (
                <div
                    className="grid gap-1"
                    style={{ gridTemplateColumns: `repeat(${Math.min(count, 10)}, 1fr)` }}
                >
                    {Array.from({ length: count }, (_, i) => {
                        const val = min + i;
                        const isSelected = value === val;
                        return (
                            <button
                                key={val}
                                onClick={() => onChange(val)}
                                className={`py-2 rounded-lg text-sm font-medium transition-all ${
                                    isSelected
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {val}
                            </button>
                        );
                    })}
                </div>
            );
        }
        case 'boolean':
            return (
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => onChange(1)}
                        className={`py-2.5 rounded-lg text-sm font-medium transition-all ${
                            value === 1
                                ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-400'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        Yes
                    </button>
                    <button
                        onClick={() => onChange(0)}
                        className={`py-2.5 rounded-lg text-sm font-medium transition-all ${
                            value === 0
                                ? 'bg-rose-100 text-rose-700 ring-2 ring-rose-400'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        No
                    </button>
                </div>
            );
        case 'number':
            return (
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        step="0.5"
                        value={value ?? ''}
                        onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            onChange(isNaN(v) ? '' : v);
                        }}
                        className="flex-1 p-2.5 border border-slate-200 rounded-lg text-sm"
                        placeholder="Enter value"
                    />
                    {metric.unit && <span className="text-sm text-slate-500">{metric.unit}</span>}
                </div>
            );
        case 'text':
            return (
                <textarea
                    value={value ?? ''}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm resize-none"
                    rows={2}
                    placeholder="Enter notes..."
                />
            );
        default:
            return null;
    }
}

export default ExperimentCheckinForm;
