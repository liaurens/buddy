import React, { useState } from 'react';
import { useTracker } from '../context/TrackerContext';
import { db } from '../services/db';
import type { TrackerDefinition, TrackerType } from '../types';
import { Plus, Trash2, Download, Upload, Save, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const Settings: React.FC = () => {
    const { trackers, addTracker, deleteTracker, exportData, importData } = useTracker();
    const [isAdding, setIsAdding] = useState(false);
    const [importText, setImportText] = useState('');
    const [showImport, setShowImport] = useState(false);

    // New Tracker State
    const [newName, setNewName] = useState('');
    const [newEmoji, setNewEmoji] = useState('📝');
    const [newType, setNewType] = useState<TrackerType>('number');
    const [newUnit, setNewUnit] = useState('');
    const [newGroup, setNewGroup] = useState('');

    // Goal State
    const [hasGoal, setHasGoal] = useState(false);
    const [goalTarget, setGoalTarget] = useState<string>('');
    const [goalCondition, setGoalCondition] = useState<'gt' | 'lt' | 'eq'>('gt');

    const handleAddTracker = async (e: React.FormEvent) => {
        e.preventDefault();
        const newTracker: TrackerDefinition = {
            id: uuidv4(),
            name: newName,
            emoji: newEmoji,
            type: newType,
            unit: newUnit || undefined,
            group: newGroup || 'Custom',
            goal: hasGoal && goalTarget ? {
                target: parseFloat(goalTarget),
                condition: goalCondition
            } : undefined
        };
        try {
            await addTracker(newTracker);
            alert('Tracker added successfully!');
            setIsAdding(false);
            resetForm();
        } catch (error) {
            console.error('Failed to add tracker:', error);
            alert(`Failed to add tracker: ${(error as Error).message || String(error)}`);
        }
    };

    const resetForm = () => {
        setNewName('');
        setNewEmoji('📝');
        setNewType('number');
        setNewUnit('');
        setNewGroup('');
        setHasGoal(false);
        setGoalTarget('');
        setGoalCondition('gt');
    };

    const handleResetDatabase = async () => {
        if (confirm('⚠️ ARE YOU SURE? This will delete ALL data (trackers, entries, protocols). This cannot be undone.')) {
            try {
                await db.delete();
                window.location.reload();
            } catch (error) {
                console.error('Failed to delete database:', error);
                alert('Failed to reset database. See console for details.');
            }
        }
    };

    const handleExport = async () => {
        const data = await exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `life-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleImport = async () => {
        if (await importData(importText)) {
            alert('Data imported successfully!');
            setImportText('');
            setShowImport(false);
        } else {
            alert('Failed to import data. Invalid format.');
        }
    };

    return (
        <div className="space-y-6">
            {/* Tracker Management */}
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
                                    placeholder="💧"
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
                                        {tracker.type} • {tracker.unit || 'No unit'} • {tracker.group}
                                    </p>
                                    {tracker.goal && (
                                        <p className="text-xs text-emerald-600 font-medium">
                                            Goal: {tracker.goal.condition === 'gt' ? '>' : tracker.goal.condition === 'lt' ? '<' : '='} {tracker.goal.target}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                {/* Check-in Configuration */}
                                <div className="flex items-center gap-2">
                                    <label className="flex items-center gap-1 text-xs text-slate-500 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={tracker.checkinConfig?.inCheckin ?? true}
                                            onChange={async (e) => {
                                                await db.trackers.update(tracker.id, {
                                                    checkinConfig: {
                                                        ...(tracker.checkinConfig || { isRequired: false }),
                                                        inCheckin: e.target.checked
                                                    }
                                                });
                                            }}
                                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                        />
                                        Show
                                    </label>
                                    <label className="flex items-center gap-1 text-xs text-slate-500 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={tracker.checkinConfig?.isRequired ?? false}
                                            onChange={async (e) => {
                                                await db.trackers.update(tracker.id, {
                                                    checkinConfig: {
                                                        ...(tracker.checkinConfig || { inCheckin: true }),
                                                        isRequired: e.target.checked
                                                    }
                                                });
                                            }}
                                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                        />
                                        Req
                                    </label>
                                </div>
                                <button
                                    onClick={() => deleteTracker(tracker.id)}
                                    className="text-slate-400 hover:text-rose-500 transition-colors"
                                    title="Delete Tracker"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Data Management */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <h2 className="font-bold text-slate-800">Data Management</h2>
                </div>
                <div className="p-4 space-y-4">
                    <div className="flex gap-4">
                        <button
                            onClick={handleExport}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium transition-colors"
                        >
                            <Download size={20} /> Export Data
                        </button>
                        <button
                            onClick={() => setShowImport(!showImport)}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium transition-colors"
                        >
                            <Upload size={20} /> Import Data
                        </button>
                    </div>

                    {showImport && (
                        <div className="space-y-3 p-4 bg-slate-50 rounded-xl animate-in fade-in slide-in-from-top-2">
                            <label className="block text-sm font-medium text-slate-700">Paste JSON Data</label>
                            <textarea
                                value={importText}
                                onChange={(e) => setImportText(e.target.value)}
                                className="w-full h-32 p-3 text-sm font-mono border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder='{"entries": [...], "trackers": [...] }'
                            />
                            <button
                                onClick={handleImport}
                                className="w-full py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
                            >
                                Import Data
                            </button>
                        </div>
                    )}

                    <div className="pt-4 border-t border-slate-100">
                        <h3 className="font-bold text-rose-600 mb-2 text-sm uppercase tracking-wider">Danger Zone</h3>
                        <button
                            onClick={handleResetDatabase}
                            className="w-full py-3 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl font-bold hover:bg-rose-100 transition-colors flex items-center justify-center gap-2"
                        >
                            <Trash2 size={20} /> Reset Database (Start Over)
                        </button>
                        <p className="text-xs text-center text-slate-400 mt-2">
                            Fixes "UpgradeError" by deleting all data and recreating the database.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
