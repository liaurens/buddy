import React, { useState, useEffect } from 'react';
import { useTrackers } from '../../hooks/useTrackers';
import { useProtocols } from '../../hooks/useProtocols';
import { useExperiments } from '../../hooks/useExperiments';
import { X, ArrowRight, ArrowLeft, FlaskConical, CheckCircle, Plus, Trash2 } from 'lucide-react';
import { format, addWeeks } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import type { ExperimentMetric, ExperimentPhase } from '../../types';
import ExperimentMetricBuilder from './ExperimentMetricBuilder';

interface ExperimentWizardProps {
    onClose: () => void;
}

const TOTAL_STEPS = 5;

const ExperimentWizard: React.FC<ExperimentWizardProps> = ({ onClose }) => {
    const { trackers } = useTrackers();
    const { protocols } = useProtocols();
    const { addExperiment } = useExperiments();
    const [step, setStep] = useState(1);

    // Step 1: Basics
    const [name, setName] = useState('');
    const [hypothesis, setHypothesis] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');

    // Step 2: Variables
    const [independentIds, setIndependentIds] = useState<string[]>([]);
    const [tracker2Id, setTracker2Id] = useState('');

    // Step 3: Custom Metrics
    const [customMetrics, setCustomMetrics] = useState<ExperimentMetric[]>([]);

    // Step 4: Phases & Schedule
    const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [phases, setPhases] = useState<ExperimentPhase[]>([]);
    const [checkinSchedule, setCheckinSchedule] = useState<'daily' | 'twice_daily' | 'weekly'>(
        'daily',
    );

    // Auto-generate name when variables selected
    useEffect(() => {
        if (!name && (independentIds.length > 0 || tracker2Id)) {
            const t1s = independentIds
                .map(
                    (id) =>
                        trackers.find((t) => t.id === id)?.name ||
                        protocols.find((p) => p.id === id)?.name,
                )
                .filter(Boolean);
            const t2 = trackers.find((t) => t.id === tracker2Id);
            if (t1s.length > 0 && t2) {
                setName(`Effect of ${t1s.join(' + ')} on ${t2.name}`);
            }
        }
    }, [independentIds, tracker2Id]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleNext = () => setStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
    const handleBack = () => setStep((prev) => Math.max(prev - 1, 1));

    const addTag = () => {
        if (tagInput.trim() && !tags.includes(tagInput.trim())) {
            setTags([...tags, tagInput.trim()]);
            setTagInput('');
        }
    };

    const addPhase = () => {
        const lastPhase = phases[phases.length - 1];
        const phaseStart = lastPhase?.endDate || startDate;
        const isFirst = phases.length === 0;
        const newPhase: ExperimentPhase = {
            id: uuidv4(),
            name: isFirst ? 'Baseline' : `Phase ${phases.length + 1}`,
            startDate: phaseStart,
            endDate: format(addWeeks(new Date(phaseStart), 1), 'yyyy-MM-dd'),
            order: phases.length,
            isBaseline: isFirst,
        };
        setPhases([...phases, newPhase]);
    };

    const setBaselinePhase = (id: string) => {
        setPhases(phases.map((p) => ({ ...p, isBaseline: p.id === id })));
    };

    const updatePhase = (id: string, updates: Partial<ExperimentPhase>) => {
        setPhases(phases.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    };

    const removePhase = (id: string) => {
        setPhases(phases.filter((p) => p.id !== id).map((p, i) => ({ ...p, order: i })));
    };

    const handleSubmit = async () => {
        await addExperiment({
            name: name || 'Untitled Experiment',
            hypothesis: hypothesis || undefined,
            description: description || undefined,
            tracker1Id: independentIds[0] || '',
            independentIds,
            tracker2Id,
            startDate: new Date(startDate).toISOString(),
            status: 'active',
            phases,
            customMetrics,
            checkinSchedule,
            tags,
        });
        onClose();
    };

    // Validation
    const isStep1Valid = !!name.trim();
    const isStep2Valid = true; // Variables are optional now (custom metrics may be enough)
    const isStep3Valid = true; // Custom metrics optional
    const isStep4Valid = !!startDate;

    const canProceed = () => {
        if (step === 1) return isStep1Valid;
        if (step === 2) return isStep2Valid;
        if (step === 3) return isStep3Valid;
        if (step === 4) return isStep4Valid;
        return true;
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-4 border-b border-cove-border flex items-center justify-between">
                    <div className="flex items-center gap-2 text-cove-accent">
                        <FlaskConical size={24} />
                        <h2 className="font-bold text-lg">New Experiment</h2>
                    </div>
                    <button onClick={onClose} className="text-cove-faint hover:text-cove-muted">
                        <X size={24} />
                    </button>
                </div>

                {/* Steps indicator */}
                <div className="flex p-4 gap-2">
                    {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
                        <div
                            key={s}
                            className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-cove-accent' : 'bg-cove-track'}`}
                        />
                    ))}
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {/* Step 1: Basics */}
                    {step === 1 && (
                        <div className="space-y-5">
                            <div className="text-center mb-4">
                                <h3 className="text-xl font-semibold text-cove-ink">The Basics</h3>
                                <p className="text-cove-soft text-sm">What are you testing?</p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-cove-muted mb-1">
                                    Name
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. Starting Ritalin 10mg"
                                    className="w-full p-3 border border-cove-border rounded-xl"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-cove-muted mb-1">
                                    Hypothesis
                                </label>
                                <textarea
                                    value={hypothesis}
                                    onChange={(e) => setHypothesis(e.target.value)}
                                    placeholder="e.g. Ritalin will improve my focus and reduce mid-afternoon energy crashes"
                                    className="w-full p-3 border border-cove-border rounded-xl resize-none"
                                    rows={3}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-cove-muted mb-1">
                                    Description (optional)
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Any additional context..."
                                    className="w-full p-3 border border-cove-border rounded-xl resize-none"
                                    rows={2}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-cove-muted mb-1">
                                    Tags
                                </label>
                                <div className="flex gap-2 mb-2 flex-wrap">
                                    {tags.map((tag) => (
                                        <span
                                            key={tag}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-cove-tint-blue text-cove-ink rounded-full text-xs"
                                        >
                                            {tag}
                                            <button
                                                onClick={() =>
                                                    setTags(tags.filter((t) => t !== tag))
                                                }
                                                className="hover:text-cove-ink"
                                            >
                                                <X size={12} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addTag();
                                            }
                                        }}
                                        placeholder="Add a tag..."
                                        className="flex-1 p-2 border border-cove-border rounded-xl text-sm"
                                    />
                                    <button
                                        onClick={addTag}
                                        className="p-2 bg-[color:var(--buddy-surface-soft)] text-cove-muted rounded-xl hover:bg-cove-track"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Variables */}
                    {step === 2 && (
                        <div className="space-y-5">
                            <div className="text-center mb-4">
                                <h3 className="text-xl font-semibold text-cove-ink">
                                    Link Trackers (Optional)
                                </h3>
                                <p className="text-cove-soft text-sm">
                                    Link to existing trackers for correlation analysis
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-cove-muted mb-2">
                                    Independent Variable(s) — The Cause
                                </label>
                                <div className="border border-cove-border rounded-xl bg-[color:var(--buddy-surface-soft)] max-h-48 overflow-y-auto p-2 space-y-1">
                                    <div className="text-xs font-semibold text-cove-faint uppercase tracking-wider px-2 py-1">
                                        Trackers
                                    </div>
                                    {trackers.map((t) => (
                                        <label
                                            key={t.id}
                                            className="flex items-center gap-2 p-2 hover:bg-white rounded-xl cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={independentIds.includes(t.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked)
                                                        setIndependentIds((prev) => [
                                                            ...prev,
                                                            t.id,
                                                        ]);
                                                    else
                                                        setIndependentIds((prev) =>
                                                            prev.filter((id) => id !== t.id),
                                                        );
                                                }}
                                                className="w-4 h-4 text-cove-accent rounded"
                                            />
                                            <span className="text-sm">
                                                {t.emoji} {t.name}
                                            </span>
                                        </label>
                                    ))}
                                    <div className="text-xs font-semibold text-cove-faint uppercase tracking-wider px-2 py-1 mt-2">
                                        Protocols
                                    </div>
                                    {protocols
                                        .filter((p) => p.active)
                                        .map((p) => (
                                            <label
                                                key={p.id}
                                                className="flex items-center gap-2 p-2 hover:bg-white rounded-xl cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={independentIds.includes(p.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked)
                                                            setIndependentIds((prev) => [
                                                                ...prev,
                                                                p.id,
                                                            ]);
                                                        else
                                                            setIndependentIds((prev) =>
                                                                prev.filter((id) => id !== p.id),
                                                            );
                                                    }}
                                                    className="w-4 h-4 text-cove-accent rounded"
                                                />
                                                <span className="text-sm">💊 {p.name}</span>
                                            </label>
                                        ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-cove-muted mb-1">
                                    Dependent Variable — The Effect
                                </label>
                                <select
                                    value={tracker2Id}
                                    onChange={(e) => setTracker2Id(e.target.value)}
                                    className="w-full p-3 border border-cove-border rounded-xl bg-[color:var(--buddy-surface-soft)]"
                                >
                                    <option value="">None (use custom metrics only)</option>
                                    {trackers.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.emoji} {t.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <p className="text-xs text-cove-soft">
                                You can skip this step and rely entirely on custom metrics in the
                                next step.
                            </p>
                        </div>
                    )}

                    {/* Step 3: Custom Metrics */}
                    {step === 3 && (
                        <div className="space-y-4">
                            <div className="text-center mb-2">
                                <h3 className="text-xl font-semibold text-cove-ink">
                                    Custom Check-in Metrics
                                </h3>
                                <p className="text-cove-soft text-sm">
                                    What will you measure daily?
                                </p>
                            </div>
                            <ExperimentMetricBuilder
                                metrics={customMetrics}
                                onChange={setCustomMetrics}
                            />
                        </div>
                    )}

                    {/* Step 4: Phases & Schedule */}
                    {step === 4 && (
                        <div className="space-y-5">
                            <div className="text-center mb-2">
                                <h3 className="text-xl font-semibold text-cove-ink">
                                    Phases & Schedule
                                </h3>
                                <p className="text-cove-soft text-sm">
                                    Structure your experiment timeline
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-cove-muted mb-1">
                                    Start Date
                                </label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full p-3 border border-cove-border rounded-xl"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-cove-muted mb-1">
                                    Check-in Frequency
                                </label>
                                <select
                                    value={checkinSchedule}
                                    onChange={(e) =>
                                        setCheckinSchedule(e.target.value as typeof checkinSchedule)
                                    }
                                    className="w-full p-3 border border-cove-border rounded-xl bg-[color:var(--buddy-surface-soft)]"
                                >
                                    <option value="daily">Daily</option>
                                    <option value="twice_daily">Twice daily</option>
                                    <option value="weekly">Weekly</option>
                                </select>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-bold text-cove-muted">
                                        Phases (optional)
                                    </label>
                                    <button
                                        onClick={addPhase}
                                        className="text-xs px-2 py-1 bg-cove-tint-blue text-cove-ink rounded-xl hover:bg-cove-accent-pale"
                                    >
                                        <Plus size={12} className="inline mr-1" /> Add Phase
                                    </button>
                                </div>
                                <p className="text-xs text-cove-soft mb-3">
                                    e.g. Baseline week → 10mg week → 20mg week
                                </p>

                                <div className="space-y-2">
                                    {phases.map((phase, i) => (
                                        <div
                                            key={phase.id}
                                            className="border border-cove-border rounded-xl p-3 space-y-2"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold text-cove-faint w-4">
                                                    {i + 1}
                                                </span>
                                                <input
                                                    type="text"
                                                    value={phase.name}
                                                    onChange={(e) =>
                                                        updatePhase(phase.id, {
                                                            name: e.target.value,
                                                        })
                                                    }
                                                    className="flex-1 p-1.5 border border-cove-border rounded-xl text-sm"
                                                    placeholder="Phase name"
                                                />
                                                <button
                                                    onClick={() => removePhase(phase.id)}
                                                    className="text-cove-faint hover:text-cove-danger"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                            <div className="flex gap-2">
                                                <input
                                                    type="date"
                                                    value={phase.startDate}
                                                    onChange={(e) =>
                                                        updatePhase(phase.id, {
                                                            startDate: e.target.value,
                                                        })
                                                    }
                                                    className="flex-1 p-1.5 border border-cove-border rounded-xl text-xs"
                                                />
                                                <span className="text-cove-faint self-center text-xs">
                                                    to
                                                </span>
                                                <input
                                                    type="date"
                                                    value={phase.endDate || ''}
                                                    onChange={(e) =>
                                                        updatePhase(phase.id, {
                                                            endDate: e.target.value || undefined,
                                                        })
                                                    }
                                                    className="flex-1 p-1.5 border border-cove-border rounded-xl text-xs"
                                                />
                                            </div>
                                            <label className="flex items-center gap-2 text-xs text-cove-muted cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="baseline-phase"
                                                    checked={!!phase.isBaseline}
                                                    onChange={() => setBaselinePhase(phase.id)}
                                                    className="accent-cove-accent"
                                                />
                                                <span>
                                                    Baseline phase (used as comparison in analysis)
                                                </span>
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 5: Review */}
                    {step === 5 && (
                        <div className="space-y-4">
                            <div className="text-center">
                                <div className="w-14 h-14 bg-cove-tint-blue text-cove-accent rounded-full flex items-center justify-center mx-auto mb-3">
                                    <FlaskConical size={28} />
                                </div>
                                <h3 className="text-xl font-semibold text-cove-ink">
                                    Ready to Start?
                                </h3>
                            </div>

                            <div className="bg-[color:var(--buddy-surface-soft)] p-4 rounded-xl space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-cove-soft">Name</span>
                                    <span className="font-bold text-cove-ink truncate ml-2">
                                        {name}
                                    </span>
                                </div>
                                {hypothesis && (
                                    <div>
                                        <div className="text-cove-soft mb-1">Hypothesis</div>
                                        <div className="text-cove-muted text-xs">{hypothesis}</div>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-cove-soft">Custom Metrics</span>
                                    <span className="font-bold text-cove-ink">
                                        {customMetrics.length}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-cove-soft">Phases</span>
                                    <span className="font-bold text-cove-ink">
                                        {phases.length || 'Single phase'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-cove-soft">Start Date</span>
                                    <span className="font-bold text-cove-ink">
                                        {format(new Date(startDate), 'MMM d, yyyy')}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-cove-soft">Check-ins</span>
                                    <span className="font-bold text-cove-ink capitalize">
                                        {checkinSchedule.replace('_', ' ')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-cove-border flex justify-between">
                    <button
                        onClick={handleBack}
                        disabled={step === 1}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold ${step === 1 ? 'text-cove-faint cursor-not-allowed' : 'text-cove-muted hover:bg-[color:var(--buddy-surface-soft)]'}`}
                    >
                        <ArrowLeft size={18} /> Back
                    </button>

                    {step < TOTAL_STEPS ? (
                        <button
                            onClick={handleNext}
                            disabled={!canProceed()}
                            className={`flex items-center gap-2 px-6 py-2 rounded-xl font-bold text-white ${!canProceed() ? 'bg-cove-accent-pale cursor-not-allowed' : 'bg-cove-accent hover:bg-[#3a8dc7]'}`}
                        >
                            Next <ArrowRight size={18} />
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            className="flex items-center gap-2 px-6 py-2 rounded-xl font-bold text-white bg-cove-accent hover:bg-[#3a8dc7] shadow-cove"
                        >
                            <CheckCircle size={18} /> Start Experiment
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExperimentWizard;
