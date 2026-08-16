import React, { useState } from 'react';
import { useTrackers } from '../../hooks/useTrackers';
import Modal from '../../../../components/ui/Modal';
import { v4 as uuidv4 } from 'uuid';
import type {
    TrackerDefinition,
    TrackerType,
    TrackerCadence,
    TrackerScale,
    ScaleDirection,
} from '../../types';
import { trackerDefinitionSchema } from '../../../../lib/validation/schemas';

interface CreateTrackerModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingTracker?: TrackerDefinition;
}

const DEFAULT_RATING_SCALE: TrackerScale = {
    min: 1,
    max: 10,
    step: 1,
    lowLabel: 'Low',
    highLabel: 'High',
    direction: 'higher_better',
};

const DEFAULT_NUMBER_SCALE: TrackerScale = {
    min: 0,
    max: 100,
    step: 1,
    lowLabel: 'Low',
    highLabel: 'High',
    direction: 'neutral',
};

const initialFormData = (editing?: TrackerDefinition): Partial<TrackerDefinition> =>
    editing ?? {
        type: 'rating',
        group: 'Health',
        cadence: 'daily',
        scale: DEFAULT_RATING_SCALE,
        checkinConfig: {
            isRequired: false,
            inCheckin: true,
            showInDailyReport: true,
        },
    };

const CreateTrackerModal: React.FC<CreateTrackerModalProps> = ({
    isOpen,
    onClose,
    editingTracker,
}) => {
    const { addTracker, updateTracker } = useTrackers();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState<Partial<TrackerDefinition>>(
        initialFormData(editingTracker),
    );

    const [hasGoal, setHasGoal] = useState(!!editingTracker?.goal);
    const [goalTarget, setGoalTarget] = useState<number>(editingTracker?.goal?.target || 0);
    const [goalCondition, setGoalCondition] = useState<'gt' | 'lt' | 'eq'>(
        editingTracker?.goal?.condition || 'gt',
    );
    const [formError, setFormError] = useState<string | null>(null);

    const cadence = (formData.cadence ?? 'daily') as TrackerCadence;
    const usesScale = formData.type === 'rating' || formData.type === 'number';

    const reset = () => {
        setStep(1);
        setFormData(initialFormData());
        setHasGoal(false);
        setGoalTarget(0);
        setGoalCondition('gt');
    };

    const handleSave = async () => {
        if (!formData.name || !formData.type) return;

        const validation = trackerDefinitionSchema.safeParse({
            name: formData.name,
            emoji: formData.emoji || undefined,
            type: formData.type,
            unit: formData.unit || undefined,
            group: formData.group || 'Other',
            goal: hasGoal ? { target: goalTarget, condition: goalCondition } : undefined,
        });
        if (!validation.success) {
            setFormError(validation.error.issues[0]?.message ?? 'Invalid tracker');
            return;
        }
        setFormError(null);

        const trackerData: TrackerDefinition = {
            id: editingTracker?.id || uuidv4(),
            name: formData.name,
            emoji: formData.emoji || '📊',
            type: formData.type,
            unit: formData.unit,
            group: formData.group || 'Other',
            cadence,
            scale: usesScale ? formData.scale : undefined,
            checkinConfig: {
                isRequired: cadence === 'episodic' ? false : !!formData.checkinConfig?.isRequired,
                inCheckin: formData.checkinConfig?.inCheckin ?? true,
                showInDailyReport: formData.checkinConfig?.showInDailyReport,
            },
            goal: hasGoal ? { target: goalTarget, condition: goalCondition } : undefined,
        };

        if (editingTracker) await updateTracker(trackerData);
        else await addTracker(trackerData);

        onClose();
        reset();
    };

    const updateField = <K extends keyof TrackerDefinition>(
        field: K,
        value: TrackerDefinition[K],
    ) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const updateScale = (patch: Partial<TrackerScale>) => {
        const base =
            formData.scale ??
            (formData.type === 'number' ? DEFAULT_NUMBER_SCALE : DEFAULT_RATING_SCALE);
        setFormData((prev) => ({ ...prev, scale: { ...base, ...patch } }));
    };

    const updateCheckin = (
        patch: Partial<{ isRequired: boolean; inCheckin: boolean; showInDailyReport: boolean }>,
    ) => {
        updateField('checkinConfig', {
            isRequired: formData.checkinConfig?.isRequired ?? false,
            inCheckin: formData.checkinConfig?.inCheckin ?? false,
            showInDailyReport: formData.checkinConfig?.showInDailyReport,
            ...patch,
        });
    };

    const handleTypeChange = (type: TrackerType) => {
        setFormData((prev) => {
            const next: Partial<TrackerDefinition> = { ...prev, type };
            if ((type === 'rating' || type === 'number') && !prev.scale) {
                next.scale = type === 'rating' ? DEFAULT_RATING_SCALE : DEFAULT_NUMBER_SCALE;
            }
            if (type === 'boolean' || type === 'text') {
                next.scale = undefined;
            }
            return next;
        });
    };

    const totalSteps = usesScale ? 3 : 2;
    const lastStep = totalSteps;
    const canAdvance = step === 1 ? !!formData.name : true;

    const footer = (
        <div className="w-full">
            {formError && <p className="text-xs text-cove-danger-deep mb-2">{formError}</p>}
            <div className="flex justify-between w-full">
                {step > 1 ? (
                    <button
                        onClick={() => setStep(step - 1)}
                        className="px-4 py-2 text-sm font-bold text-cove-muted hover:bg-[color:var(--buddy-surface-soft)] rounded-xl transition-colors"
                    >
                        Back
                    </button>
                ) : (
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-bold text-cove-muted hover:bg-[color:var(--buddy-surface-soft)] rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                )}

                {step < lastStep ? (
                    <button
                        onClick={() => {
                            let next = step + 1;
                            // skip scale step for boolean/text
                            if (next === 2 && !usesScale) next = 3;
                            setStep(Math.min(next, lastStep));
                        }}
                        disabled={!canAdvance}
                        className="px-4 py-2 text-sm font-bold text-white bg-cove-accent hover:bg-[#3a8dc7] rounded-xl transition-colors disabled:opacity-50"
                    >
                        Next
                    </button>
                ) : (
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 text-sm font-bold text-white bg-cove-accent hover:bg-[#3a8dc7] rounded-xl transition-colors"
                    >
                        {editingTracker ? 'Save changes' : 'Create tracker'}
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editingTracker ? 'Edit tracker' : 'Create new tracker'}
            footer={footer}
        >
            <div className="space-y-6">
                {/* Step 1 — Identity & cadence */}
                {step === 1 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                        <div>
                            <label className="block text-sm font-bold text-cove-muted mb-1">
                                Name
                            </label>
                            <input
                                type="text"
                                value={formData.name || ''}
                                onChange={(e) => updateField('name', e.target.value)}
                                placeholder="e.g. Sleep, Steps, Mood"
                                className="app-input"
                                autoFocus
                            />
                        </div>

                        <div className="flex gap-4">
                            <div className="w-24">
                                <label className="block text-sm font-bold text-cove-muted mb-1">
                                    Emoji
                                </label>
                                <input
                                    type="text"
                                    value={formData.emoji || ''}
                                    onChange={(e) => updateField('emoji', e.target.value)}
                                    placeholder="📊"
                                    className="w-full text-center px-3 py-2 border border-cove-border rounded-xl focus:ring-2 focus:ring-cove-accent outline-none"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-bold text-cove-muted mb-1">
                                    Group
                                </label>
                                <select
                                    value={formData.group || 'Health'}
                                    onChange={(e) => updateField('group', e.target.value)}
                                    className="app-input"
                                >
                                    <option value="Sleep">Sleep</option>
                                    <option value="Body">Body</option>
                                    <option value="Mental">Mental</option>
                                    <option value="Diet">Diet</option>
                                    <option value="Fitness">Fitness</option>
                                    <option value="Productivity">Productivity</option>
                                    <option value="Journal">Journal</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-cove-muted mb-2">
                                Type
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {(['rating', 'number', 'boolean', 'text'] as TrackerType[]).map(
                                    (type) => (
                                        <button
                                            key={type}
                                            onClick={() => handleTypeChange(type)}
                                            className={`px-3 py-2 rounded-xl border text-sm font-bold text-left capitalize transition-all ${
                                                formData.type === type
                                                    ? 'bg-cove-tint-blue border-cove-accent text-cove-ink ring-1 ring-cove-accent'
                                                    : 'bg-white border-cove-border text-cove-muted hover:border-cove-border'
                                            }`}
                                        >
                                            {type}
                                        </button>
                                    ),
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-cove-muted mb-2">
                                Cadence
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {(
                                    [
                                        {
                                            v: 'daily',
                                            label: 'Daily',
                                            hint: 'Logged every day in the check-in',
                                        },
                                        {
                                            v: 'episodic',
                                            label: 'Episodic',
                                            hint: 'Only when it happens (e.g. alcohol)',
                                        },
                                    ] as { v: TrackerCadence; label: string; hint: string }[]
                                ).map((opt) => (
                                    <button
                                        key={opt.v}
                                        onClick={() => updateField('cadence', opt.v)}
                                        className={`px-3 py-2 rounded-xl border text-left transition-all ${
                                            cadence === opt.v
                                                ? 'bg-cove-tint-blue border-cove-accent ring-1 ring-cove-accent'
                                                : 'bg-white border-cove-border hover:border-cove-border'
                                        }`}
                                    >
                                        <div className="text-sm font-bold text-cove-ink">
                                            {opt.label}
                                        </div>
                                        <div className="text-xs text-cove-soft mt-0.5">
                                            {opt.hint}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 2 — Scale (only for rating/number) */}
                {step === 2 && usesScale && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                        <div>
                            <h3 className="text-sm font-bold text-cove-ink mb-1">Scale</h3>
                            <p className="text-xs text-cove-soft">
                                Make the scale unambiguous — what do the endpoints mean and which
                                direction is "good"?
                            </p>
                        </div>

                        {formData.type === 'number' && (
                            <div>
                                <label className="block text-sm font-bold text-cove-muted mb-1">
                                    Unit (optional)
                                </label>
                                <input
                                    type="text"
                                    value={formData.unit || ''}
                                    onChange={(e) => updateField('unit', e.target.value)}
                                    placeholder="e.g. hrs, mg, glasses"
                                    className="app-input"
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className="block text-xs font-bold text-cove-muted mb-1">
                                    Min
                                </label>
                                <input
                                    type="number"
                                    value={formData.scale?.min ?? 0}
                                    onChange={(e) =>
                                        updateScale({ min: parseFloat(e.target.value) })
                                    }
                                    className="app-input"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-cove-muted mb-1">
                                    Max
                                </label>
                                <input
                                    type="number"
                                    value={formData.scale?.max ?? 10}
                                    onChange={(e) =>
                                        updateScale({ max: parseFloat(e.target.value) })
                                    }
                                    className="app-input"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-cove-muted mb-1">
                                    Step
                                </label>
                                <input
                                    type="number"
                                    step="any"
                                    value={formData.scale?.step ?? 1}
                                    onChange={(e) =>
                                        updateScale({ step: parseFloat(e.target.value) })
                                    }
                                    className="app-input"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs font-bold text-cove-muted mb-1">
                                    Low end label
                                </label>
                                <input
                                    type="text"
                                    value={formData.scale?.lowLabel ?? ''}
                                    onChange={(e) => updateScale({ lowLabel: e.target.value })}
                                    placeholder="e.g. Drained"
                                    className="app-input"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-cove-muted mb-1">
                                    High end label
                                </label>
                                <input
                                    type="text"
                                    value={formData.scale?.highLabel ?? ''}
                                    onChange={(e) => updateScale({ highLabel: e.target.value })}
                                    placeholder="e.g. Energized"
                                    className="app-input"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-cove-muted mb-2">
                                Direction
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {(
                                    [
                                        { v: 'higher_better', label: 'Higher is better' },
                                        { v: 'lower_better', label: 'Lower is better' },
                                        { v: 'neutral', label: 'Neither' },
                                    ] as { v: ScaleDirection; label: string }[]
                                ).map((opt) => (
                                    <button
                                        key={opt.v}
                                        onClick={() => updateScale({ direction: opt.v })}
                                        className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                                            formData.scale?.direction === opt.v
                                                ? 'bg-cove-tint-blue border-cove-accent text-cove-ink ring-1 ring-cove-accent'
                                                : 'bg-white border-cove-border text-cove-muted hover:border-cove-border'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 bg-[color:var(--buddy-surface-soft)] rounded-xl border border-cove-border">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-bold text-cove-muted">
                                    Set a goal
                                </label>
                                <input
                                    type="checkbox"
                                    checked={hasGoal}
                                    onChange={(e) => setHasGoal(e.target.checked)}
                                    className="h-4 w-4 text-cove-accent rounded"
                                />
                            </div>
                            {hasGoal && (
                                <div className="flex gap-2 animate-in fade-in slide-in-from-top-1">
                                    <select
                                        value={goalCondition}
                                        onChange={(e) =>
                                            setGoalCondition(e.target.value as 'gt' | 'lt' | 'eq')
                                        }
                                        className="w-1/3 px-3 py-2 text-sm border border-cove-border rounded-xl"
                                    >
                                        <option value="gt">More than</option>
                                        <option value="lt">Less than</option>
                                        <option value="eq">Exactly</option>
                                    </select>
                                    <input
                                        type="number"
                                        value={goalTarget}
                                        onChange={(e) => setGoalTarget(parseFloat(e.target.value))}
                                        className="flex-1 px-3 py-2 text-sm border border-cove-border rounded-xl"
                                        placeholder="Target value"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Step 3 — Check-in config */}
                {step === 3 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                        {formData.type === 'text' && (
                            <div>
                                <label className="block text-sm font-bold text-cove-muted mb-1">
                                    Unit (optional)
                                </label>
                                <input
                                    type="text"
                                    value={formData.unit || ''}
                                    onChange={(e) => updateField('unit', e.target.value)}
                                    placeholder="e.g. notes"
                                    className="app-input"
                                />
                            </div>
                        )}

                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-cove-ink">Check-in</h3>

                            <label className="flex items-center justify-between p-3 border border-cove-border rounded-xl">
                                <div>
                                    <span className="text-sm text-cove-muted">
                                        Show in check-in
                                    </span>
                                    <p className="text-xs text-cove-soft">
                                        {cadence === 'episodic'
                                            ? 'Appears as a chip at the bottom of the daily check-in'
                                            : 'Appears in the daily check-in form'}
                                    </p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={formData.checkinConfig?.inCheckin}
                                    onChange={(e) => updateCheckin({ inCheckin: e.target.checked })}
                                    className="h-4 w-4 text-cove-accent rounded"
                                />
                            </label>

                            {formData.checkinConfig?.inCheckin && cadence !== 'episodic' && (
                                <label className="flex items-center justify-between p-3 border border-cove-border rounded-xl">
                                    <div>
                                        <span className="text-sm text-cove-muted">
                                            Required field
                                        </span>
                                        <p className="text-xs text-cove-soft">
                                            Block save until this is filled
                                        </p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={formData.checkinConfig?.isRequired}
                                        onChange={(e) =>
                                            updateCheckin({ isRequired: e.target.checked })
                                        }
                                        className="h-4 w-4 text-cove-accent rounded"
                                    />
                                </label>
                            )}

                            <label className="flex items-center justify-between p-3 border border-cove-border rounded-xl">
                                <span className="text-sm text-cove-muted">
                                    Show in daily report
                                </span>
                                <input
                                    type="checkbox"
                                    checked={formData.checkinConfig?.showInDailyReport}
                                    onChange={(e) =>
                                        updateCheckin({ showInDailyReport: e.target.checked })
                                    }
                                    className="h-4 w-4 text-cove-accent rounded"
                                />
                            </label>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default CreateTrackerModal;
