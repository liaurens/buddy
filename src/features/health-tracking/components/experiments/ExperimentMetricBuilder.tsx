import React, { useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import type { ExperimentMetric, TrackerType } from '../../types';
import { v4 as uuidv4 } from 'uuid';

interface ExperimentMetricBuilderProps {
    metrics: ExperimentMetric[];
    onChange: (metrics: ExperimentMetric[]) => void;
}

const METRIC_TEMPLATES: Record<string, ExperimentMetric[]> = {
    'ADHD Medication': [
        { id: '', name: 'Focus Level', emoji: '🎯', type: 'rating', min: 1, max: 10, required: true, description: 'How focused were you today?' },
        { id: '', name: 'Concentration Hours', emoji: '⏱️', type: 'number', unit: 'hours', required: false, description: 'Hours of sustained concentration' },
        { id: '', name: 'Appetite', emoji: '🍽️', type: 'rating', min: 1, max: 10, required: false, description: 'Appetite level throughout the day' },
        { id: '', name: 'Irritability', emoji: '😤', type: 'rating', min: 1, max: 10, required: false, description: 'Level of irritability or restlessness' },
        { id: '', name: 'Side Effects', emoji: '⚠️', type: 'text', required: false, description: 'Any side effects noticed' },
        { id: '', name: 'Task Completion', emoji: '✅', type: 'boolean', required: false, description: 'Were you able to complete planned tasks?' },
    ],
    'Sleep Study': [
        { id: '', name: 'Sleep Quality', emoji: '😴', type: 'rating', min: 1, max: 10, required: true },
        { id: '', name: 'Time to Fall Asleep', emoji: '⏰', type: 'number', unit: 'minutes', required: false },
        { id: '', name: 'Morning Grogginess', emoji: '🥱', type: 'rating', min: 1, max: 10, required: false },
        { id: '', name: 'Night Wakeups', emoji: '🌙', type: 'number', required: false },
    ],
    'Supplement': [
        { id: '', name: 'Effectiveness', emoji: '📈', type: 'rating', min: 1, max: 10, required: true },
        { id: '', name: 'Energy Level', emoji: '⚡', type: 'rating', min: 1, max: 10, required: false },
        { id: '', name: 'Side Effects', emoji: '⚠️', type: 'text', required: false },
    ],
};

const EMOJIS = ['📊', '🎯', '⚡', '😴', '🧠', '💪', '❤️', '🍽️', '😤', '⚠️', '✅', '📈', '🌙', '⏰', '💊', '🏃'];

const TYPE_OPTIONS: { value: TrackerType; label: string }[] = [
    { value: 'rating', label: 'Rating (1-10)' },
    { value: 'number', label: 'Number' },
    { value: 'boolean', label: 'Yes / No' },
    { value: 'text', label: 'Text' },
];

const ExperimentMetricBuilder: React.FC<ExperimentMetricBuilderProps> = ({ metrics, onChange }) => {
    const [showAdd, setShowAdd] = useState(false);
    const [editingMetric, setEditingMetric] = useState<ExperimentMetric | null>(null);

    const addMetric = (metric: Omit<ExperimentMetric, 'id'>) => {
        onChange([...metrics, { ...metric, id: uuidv4() }]);
        setShowAdd(false);
        setEditingMetric(null);
    };

    const removeMetric = (id: string) => {
        onChange(metrics.filter(m => m.id !== id));
    };

    const applyTemplate = (templateName: string) => {
        const template = METRIC_TEMPLATES[templateName];
        if (template) {
            const newMetrics = template.map(m => ({ ...m, id: uuidv4() }));
            onChange([...metrics, ...newMetrics]);
        }
    };

    return (
        <div className="space-y-4">
            {/* Templates */}
            {metrics.length === 0 && (
                <div className="space-y-2">
                    <p className="text-sm text-slate-500">Start with a template or build your own:</p>
                    <div className="flex flex-wrap gap-2">
                        {Object.keys(METRIC_TEMPLATES).map(name => (
                            <button
                                key={name}
                                onClick={() => applyTemplate(name)}
                                className="px-3 py-1.5 text-sm bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors"
                            >
                                {name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Metric List */}
            {metrics.length > 0 && (
                <div className="space-y-2">
                    {metrics.map((metric) => (
                        <div
                            key={metric.id}
                            className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100"
                        >
                            <GripVertical size={16} className="text-slate-300 flex-shrink-0" />
                            <span className="text-lg">{metric.emoji}</span>
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-slate-800 text-sm">{metric.name}</div>
                                <div className="text-xs text-slate-500">
                                    {TYPE_OPTIONS.find(t => t.value === metric.type)?.label}
                                    {metric.unit && ` (${metric.unit})`}
                                    {metric.required && ' · Required'}
                                </div>
                            </div>
                            <button
                                onClick={() => removeMetric(metric.id)}
                                className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Metric Form */}
            {showAdd || editingMetric ? (
                <MetricForm
                    initial={editingMetric || undefined}
                    onSave={addMetric}
                    onCancel={() => { setShowAdd(false); setEditingMetric(null); }}
                />
            ) : (
                <button
                    onClick={() => setShowAdd(true)}
                    className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                >
                    <Plus size={18} /> Add Custom Metric
                </button>
            )}
        </div>
    );
};

function MetricForm({ initial, onSave, onCancel }: {
    initial?: ExperimentMetric;
    onSave: (m: Omit<ExperimentMetric, 'id'>) => void;
    onCancel: () => void;
}) {
    const [name, setName] = useState(initial?.name || '');
    const [emoji, setEmoji] = useState(initial?.emoji || '📊');
    const [type, setType] = useState<TrackerType>(initial?.type || 'rating');
    const [unit, setUnit] = useState(initial?.unit || '');
    const [required, setRequired] = useState(initial?.required ?? false);
    const [description, setDescription] = useState(initial?.description || '');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    const handleSave = () => {
        if (!name.trim()) return;
        onSave({ name: name.trim(), emoji, type, unit: unit || undefined, required, description: description || undefined });
    };

    return (
        <div className="border border-indigo-200 rounded-xl p-4 space-y-3 bg-indigo-50/30">
            <div className="flex gap-3">
                <div className="relative">
                    <button
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="w-12 h-12 bg-white border border-slate-200 rounded-xl text-xl flex items-center justify-center hover:border-indigo-300"
                    >
                        {emoji}
                    </button>
                    {showEmojiPicker && (
                        <div className="absolute top-14 left-0 z-10 bg-white border border-slate-200 rounded-xl p-2 shadow-lg grid grid-cols-4 gap-1">
                            {EMOJIS.map(e => (
                                <button
                                    key={e}
                                    onClick={() => { setEmoji(e); setShowEmojiPicker(false); }}
                                    className="w-8 h-8 text-lg hover:bg-slate-100 rounded"
                                >
                                    {e}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Metric name"
                    className="flex-1 p-2 border border-slate-200 rounded-lg text-sm"
                    autoFocus
                />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Type</label>
                    <select
                        value={type}
                        onChange={e => setType(e.target.value as TrackerType)}
                        className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                    >
                        {TYPE_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                </div>
                {type === 'number' && (
                    <div>
                        <label className="text-xs font-medium text-slate-600 mb-1 block">Unit</label>
                        <input
                            type="text"
                            value={unit}
                            onChange={e => setUnit(e.target.value)}
                            placeholder="e.g. hours, mg"
                            className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                        />
                    </div>
                )}
            </div>

            <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Description (optional)"
                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
            />

            <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                        type="checkbox"
                        checked={required}
                        onChange={e => setRequired(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                    />
                    Required
                </label>
                <div className="flex gap-2">
                    <button onClick={onCancel} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                    <button
                        onClick={handleSave}
                        disabled={!name.trim()}
                        className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                        Add
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ExperimentMetricBuilder;
