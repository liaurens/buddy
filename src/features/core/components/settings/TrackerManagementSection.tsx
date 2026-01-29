import React, { useState } from 'react';
import { Plus, Trash2, Save, X } from 'lucide-react';
import type { TrackerDefinition, TrackerType } from '../../../../types';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '../../../../components/ui/Toast';
import { trackerDefinitionSchema } from '../../../../lib/validation/schemas';

interface TrackerManagementSectionProps {
    trackers: TrackerDefinition[];
    onAddTracker: (tracker: TrackerDefinition) => Promise<void>;
    onDeleteTracker: (id: string) => Promise<void>;
    onUpdateTracker: (tracker: TrackerDefinition) => Promise<void>;
}

export const TrackerManagementSection: React.FC<TrackerManagementSectionProps> = ({
    trackers,
    onAddTracker,
    onDeleteTracker,
    onUpdateTracker,
}) => {
    const toast = useToast();
    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const [newEmoji, setNewEmoji] = useState('');
    const [newType, setNewType] = useState<TrackerType>('number');
    const [newUnit, setNewUnit] = useState('');
    const [newGroup, setNewGroup] = useState('');
    const [hasGoal, setHasGoal] = useState(false);
    const [goalTarget, setGoalTarget] = useState<string>('');
    const [goalCondition, setGoalCondition] = useState<'gt' | 'lt' | 'eq'>('gt');

    const handleAddTracker = async (e: React.FormEvent) => {
        e.preventDefault();

        // Prepare tracker data for validation
        const trackerData = {
            name: newName,
            emoji: newEmoji || undefined,
            type: newType,
            unit: newUnit || undefined,
            group: newGroup || 'Custom',
            goal: hasGoal && goalTarget ? {
                target: parseFloat(goalTarget),
                condition: goalCondition
            } : undefined
        };

        // Validate input
        try {
            const validatedData = trackerDefinitionSchema.parse(trackerData);

            const newTracker: TrackerDefinition = {
                id: uuidv4(),
                ...validatedData,
                emoji: validatedData.emoji || '', // Ensure emoji is always a string
            };

            await onAddTracker(newTracker);
            toast.success('Tracker added successfully!');
            setIsAdding(false);
            resetForm();
        } catch (error: any) {
            // Handle Zod validation errors
            if (error.name === 'ZodError') {
                const firstError = error.errors[0];
                toast.error(firstError.message);
            } else {
                console.error('Failed to add tracker:', error);
                toast.error(`Failed to add tracker: ${error.message || String(error)}`);
            }
        }
    };

    const resetForm = () => {
        setNewName('');
        setNewEmoji('');
        setNewType('number');
        setNewUnit('');
        setNewGroup('');
        setHasGoal(false);
        setGoalTarget('');
        setGoalCondition('gt');
    };

    const handleUpdateTrackerConfig = async (tracker: TrackerDefinition, config: Partial<TrackerDefinition['checkinConfig']>) => {
        const updatedTracker = {
            ...tracker,
            checkinConfig: {
                ...(tracker.checkinConfig || { isRequired: false, inCheckin: true }),
                ...config
            }
        };

        try {
            await onUpdateTracker(updatedTracker);
        } catch (error) {
            console.error('Failed to update tracker:', error);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-slate-800">Manage Trackers</h2>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                    {isAdding ? <X size={16} /> : <Plus size={16} />}
                    {isAdding ? 'Cancel' : 'Add New'}
                </button>
            </div>

            {isAdding && (
                <form onSubmit={handleAddTracker} className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="w-full px-3 py-2 rounded border border-slate-200 text-sm"
                                placeholder="e.g. Water"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Emoji</label>
                            <input
                                type="text"
                                value={newEmoji}
                                onChange={(e) => setNewEmoji(e.target.value)}
                                className="w-full px-3 py-2 rounded border border-slate-200 text-sm"
                                placeholder=""
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                            <select
                                value={newType}
                                onChange={(e) => setNewType(e.target.value as TrackerType)}
                                className="w-full px-3 py-2 rounded border border-slate-200 text-sm"
                            >
                                <option value="number">Number</option>
                                <option value="rating">Rating (1-10)</option>
                                <option value="boolean">Yes/No</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Unit (Optional)</label>
                            <input
                                type="text"
                                value={newUnit}
                                onChange={(e) => setNewUnit(e.target.value)}
                                className="w-full px-3 py-2 rounded border border-slate-200 text-sm"
                                placeholder="e.g. L, min"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Group</label>
                        <input
                            type="text"
                            value={newGroup}
                            onChange={(e) => setNewGroup(e.target.value)}
                            className="w-full px-3 py-2 rounded border border-slate-200 text-sm"
                            placeholder="e.g. Health"
                        />
                    </div>

                    {/* Goal Setting */}
                    <div className="pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-2 mb-2">
                            <input
                                type="checkbox"
                                id="hasGoal"
                                checked={hasGoal}
                                onChange={(e) => setHasGoal(e.target.checked)}
                                className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <label htmlFor="hasGoal" className="text-sm font-medium text-slate-700">Set a Daily Goal?</label>
                        </div>

                        {hasGoal && (
                            <div className="flex gap-2 animate-in fade-in slide-in-from-top-1">
                                <select
                                    value={goalCondition}
                                    onChange={(e) => setGoalCondition(e.target.value as any)}
                                    className="w-1/3 px-3 py-2 rounded border border-slate-200 text-sm"
                                >
                                    <option value="gt">More than (&gt;)</option>
                                    <option value="lt">Less than (&lt;)</option>
                                    <option value="eq">Equal to (=)</option>
                                </select>
                                <input
                                    type="number"
                                    value={goalTarget}
                                    onChange={(e) => setGoalTarget(e.target.value)}
                                    className="flex-1 px-3 py-2 rounded border border-slate-200 text-sm"
                                    placeholder="Target value"
                                    required
                                />
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium"
                    >
                        <Save size={16} /> Save Tracker
                    </button>
                </form>
            )}

            <div className="space-y-2">
                {trackers.map((tracker) => (
                    <div key={tracker.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">{tracker.emoji}</span>
                            <div>
                                <p className="font-medium text-slate-900">{tracker.name}</p>
                                <p className="text-xs text-slate-500">
                                    {tracker.type} {tracker.unit ? `• ${tracker.unit}` : ''} • {tracker.group}
                                </p>
                                {tracker.goal && (
                                    <p className="text-xs text-emerald-600 font-medium">
                                        Goal: {tracker.goal.condition === 'gt' ? '>' : tracker.goal.condition === 'lt' ? '<' : '='} {tracker.goal.target}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Check-in Configuration */}
                            <div className="flex flex-col gap-1">
                                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer hover:text-slate-800" title="Show in daily check-in">
                                    <input
                                        type="checkbox"
                                        checked={tracker.checkinConfig?.inCheckin ?? true}
                                        onChange={(e) => handleUpdateTrackerConfig(tracker, { inCheckin: e.target.checked })}
                                        className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                                    />
                                    Check-in
                                </label>
                                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer hover:text-slate-800" title="Required in daily check-in">
                                    <input
                                        type="checkbox"
                                        checked={tracker.checkinConfig?.isRequired ?? false}
                                        onChange={(e) => handleUpdateTrackerConfig(tracker, { isRequired: e.target.checked })}
                                        className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                                    />
                                    Required
                                </label>
                                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer hover:text-slate-800" title="Show in daily report">
                                    <input
                                        type="checkbox"
                                        checked={tracker.checkinConfig?.showInDailyReport ?? false}
                                        onChange={(e) => handleUpdateTrackerConfig(tracker, { showInDailyReport: e.target.checked })}
                                        className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                                    />
                                    Daily Report
                                </label>
                            </div>
                            <button
                                onClick={() => onDeleteTracker(tracker.id)}
                                className="text-slate-400 hover:text-rose-500 transition-colors ml-auto"
                                title="Delete Tracker"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
