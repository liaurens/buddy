import React, { useState } from 'react';
import { useTracker } from '../../../../context/TrackerContext';
import Modal from '../../../../components/ui/Modal';
import { v4 as uuidv4 } from 'uuid';
import type { TrackerDefinition, TrackerType } from '../../types';

interface CreateTrackerModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingTracker?: TrackerDefinition; // Optional: if provided, we're editing
}

const CreateTrackerModal: React.FC<CreateTrackerModalProps> = ({ isOpen, onClose, editingTracker }) => {
    const { addTracker, updateTracker } = useTracker();
    const [step, setStep] = useState(1); // 1: Basic, 2: Config, 3: Goal/Checkin

    const [formData, setFormData] = useState<Partial<TrackerDefinition>>(
        editingTracker || {
            type: 'number',
            group: 'Health',
            checkinConfig: {
                isRequired: false,
                inCheckin: true,
                showInDailyReport: true
            }
        }
    );

    const [hasGoal, setHasGoal] = useState(!!editingTracker?.goal);
    const [goalTarget, setGoalTarget] = useState<number>(editingTracker?.goal?.target || 0);
    const [goalCondition, setGoalCondition] = useState<'gt' | 'lt' | 'eq'>(editingTracker?.goal?.condition || 'gt');

    const handleSave = async () => {
        if (!formData.name || !formData.type) return;

        const trackerData: TrackerDefinition = {
            id: editingTracker?.id || uuidv4(),
            name: formData.name,
            emoji: formData.emoji || '📊',
            type: formData.type,
            unit: formData.unit,
            group: formData.group || 'Other',
            checkinConfig: formData.checkinConfig,
            goal: hasGoal ? {
                target: goalTarget,
                condition: goalCondition
            } : undefined
        };

        if (editingTracker) {
            await updateTracker(trackerData);
        } else {
            await addTracker(trackerData);
        }

        onClose();
        // Reset form
        setStep(1);
        setFormData({
            type: 'number',
            group: 'Health',
            checkinConfig: {
                isRequired: false,
                inCheckin: true,
                showInDailyReport: true
            }
        });
        setHasGoal(false);
        setGoalTarget(0);
        setGoalCondition('gt');
    };

    const updateField = (field: keyof TrackerDefinition, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const footer = (
        <div className="flex justify-between w-full">
            {step > 1 ? (
                <button
                    onClick={() => setStep(step - 1)}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                >
                    Back
                </button>
            ) : (
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                >
                    Cancel
                </button>
            )}

            {step < 2 ? (
                <button
                    onClick={() => setStep(step + 1)}
                    disabled={!formData.name}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors disabled:opacity-50"
                >
                    Next
                </button>
            ) : (
                <button
                    onClick={handleSave}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
                >
                    {editingTracker ? 'Save Changes' : 'Create Tracker'}
                </button>
            )}
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editingTracker ? 'Edit Tracker' : 'Create New Tracker'}
            footer={footer}
        >
            <div className="space-y-6">
                {step === 1 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                            <input
                                type="text"
                                value={formData.name || ''}
                                onChange={e => updateField('name', e.target.value)}
                                placeholder="e.g. Sleep, Steps, Mood"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                autoFocus
                            />
                        </div>

                        <div className="flex gap-4">
                            <div className="w-24">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Emoji</label>
                                <input
                                    type="text"
                                    value={formData.emoji || ''}
                                    onChange={e => updateField('emoji', e.target.value)}
                                    placeholder="📊"
                                    className="w-full text-center px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Group</label>
                                <select
                                    value={formData.group || 'Health'}
                                    onChange={e => updateField('group', e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="Health">Health</option>
                                    <option value="Fitness">Fitness</option>
                                    <option value="Mental">Mental</option>
                                    <option value="Productivity">Productivity</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Type</label>
                            <div className="grid grid-cols-2 gap-2">
                                {(['number', 'rating', 'boolean', 'text'] as TrackerType[]).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => updateField('type', type)}
                                        className={`px-3 py-2 rounded-lg border text-sm font-medium text-left capitalize transition-all ${formData.type === type
                                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-1 ring-indigo-500'
                                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                            }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        {(formData.type === 'number' || formData.type === 'text') && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Unit (Optional)</label>
                                <input
                                    type="text"
                                    value={formData.unit || ''}
                                    onChange={e => updateField('unit', e.target.value)}
                                    placeholder="e.g. kg, hours, mg"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        )}

                        {(formData.type === 'number' || formData.type === 'rating') && (
                            <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium text-slate-700">Set Goal</label>
                                    <input
                                        type="checkbox"
                                        checked={hasGoal}
                                        onChange={e => setHasGoal(e.target.checked)}
                                        className="h-4 w-4 text-indigo-600 rounded"
                                    />
                                </div>

                                {hasGoal && (
                                    <div className="flex gap-2 animate-in fade-in slide-in-from-top-1">
                                        <select
                                            value={goalCondition}
                                            onChange={e => setGoalCondition(e.target.value as any)}
                                            className="w-1/3 px-3 py-2 text-sm border border-slate-300 rounded-lg"
                                        >
                                            <option value="gt">More than</option>
                                            <option value="lt">Less than</option>
                                            <option value="eq">Exactly</option>
                                        </select>
                                        <input
                                            type="number"
                                            value={goalTarget}
                                            onChange={e => setGoalTarget(parseFloat(e.target.value))}
                                            className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg"
                                            placeholder="Target value"
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="space-y-3">
                            <h3 className="text-sm font-medium text-slate-900">Check-in Configuration</h3>

                            <label className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                                <span className="text-sm text-slate-700">Include in Daily Check-in</span>
                                <input
                                    type="checkbox"
                                    checked={formData.checkinConfig?.inCheckin}
                                    onChange={e => updateField('checkinConfig', { ...formData.checkinConfig, inCheckin: e.target.checked })}
                                    className="h-4 w-4 text-indigo-600 rounded"
                                />
                            </label>

                            {formData.checkinConfig?.inCheckin && (
                                <label className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                                    <span className="text-sm text-slate-700">Required Field</span>
                                    <input
                                        type="checkbox"
                                        checked={formData.checkinConfig?.isRequired}
                                        onChange={e => updateField('checkinConfig', { ...formData.checkinConfig, isRequired: e.target.checked })}
                                        className="h-4 w-4 text-indigo-600 rounded"
                                    />
                                </label>
                            )}

                            <label className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                                <span className="text-sm text-slate-700">Show in Daily Report</span>
                                <input
                                    type="checkbox"
                                    checked={formData.checkinConfig?.showInDailyReport}
                                    onChange={e => updateField('checkinConfig', { ...formData.checkinConfig, showInDailyReport: e.target.checked })}
                                    className="h-4 w-4 text-indigo-600 rounded"
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
