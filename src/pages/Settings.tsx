import React, { useState, useEffect } from 'react';
import { useTracker } from '../context/TrackerContext';
import { useAuth } from '../hooks/useAuth';
import { supabase, getSetting, setSetting } from '../services/supabase';
import type { TrackerDefinition, TrackerType } from '../types';
import { Plus, Trash2, Download, Upload, Save, X, Cloud, LogOut, Zap, Copy, RefreshCw, Check } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const Settings: React.FC = () => {
    const { trackers, addTracker, deleteTracker, updateTracker, exportData, importData } = useTracker();
    const { user, signOut } = useAuth();
    const [isAdding, setIsAdding] = useState(false);
    const [importText, setImportText] = useState('');
    const [showImport, setShowImport] = useState(false);

    // Quick Notes API Key state
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [apiKeyCopied, setApiKeyCopied] = useState(false);
    const [isGeneratingKey, setIsGeneratingKey] = useState(false);

    // Load existing API key on mount
    useEffect(() => {
        if (user?.id) {
            getSetting(user.id, 'quick_note_api_key').then(key => {
                if (key) setApiKey(key);
            });
        }
    }, [user?.id]);

    const generateApiKey = async () => {
        if (!user?.id) return;
        setIsGeneratingKey(true);
        try {
            const newKey = `qn_${uuidv4().replace(/-/g, '')}`;
            await setSetting(user.id, 'quick_note_api_key', newKey);
            setApiKey(newKey);
        } catch (error) {
            console.error('Failed to generate API key:', error);
            alert('Failed to generate API key');
        } finally {
            setIsGeneratingKey(false);
        }
    };

    const copyApiKey = () => {
        if (apiKey) {
            navigator.clipboard.writeText(apiKey);
            setApiKeyCopied(true);
            setTimeout(() => setApiKeyCopied(false), 2000);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut();
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    // New Tracker State
    const [newName, setNewName] = useState('');
    const [newEmoji, setNewEmoji] = useState('');
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
        setNewEmoji('');
        setNewType('number');
        setNewUnit('');
        setNewGroup('');
        setHasGoal(false);
        setGoalTarget('');
        setGoalCondition('gt');
    };

    const handleResetDatabase = async () => {
        if (confirm('ARE YOU SURE? This will delete ALL your data (trackers, entries, protocols). This cannot be undone.')) {
            if (!user?.id) return;
            try {
                // Delete all user data from Supabase
                await Promise.all([
                    supabase.from('entries').delete().eq('user_id', user.id),
                    supabase.from('doses').delete().eq('user_id', user.id),
                    supabase.from('cycles').delete().eq('user_id', user.id),
                    supabase.from('correlations').delete().eq('user_id', user.id),
                ]);
                await supabase.from('experiments').delete().eq('user_id', user.id);
                await supabase.from('protocols').delete().eq('user_id', user.id);
                await supabase.from('trackers').delete().eq('user_id', user.id);
                await supabase.from('strategies').delete().eq('user_id', user.id);
                await supabase.from('todos').delete().eq('user_id', user.id);
                await supabase.from('settings').delete().eq('user_id', user.id);

                window.location.reload();
            } catch (error) {
                console.error('Failed to delete data:', error);
                alert('Failed to reset data. See console for details.');
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

    const handleUpdateTrackerConfig = async (tracker: TrackerDefinition, config: Partial<TrackerDefinition['checkinConfig']>) => {
        const updatedTracker = {
            ...tracker,
            checkinConfig: {
                ...(tracker.checkinConfig || { isRequired: false, inCheckin: true }),
                ...config
            }
        };

        try {
            await updateTracker(updatedTracker);
        } catch (error) {
            console.error('Failed to update tracker:', error);
        }
    };

    return (
        <div className="space-y-6">
            {/* Account Section */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 rounded-xl shadow-sm text-white">
                <div className="flex items-center gap-3 mb-4">
                    <Cloud size={24} />
                    <h2 className="text-xl font-semibold">Account</h2>
                </div>

                <div className="space-y-4">
                    <div className="bg-white/20 rounded-lg p-4">
                        <p className="text-sm opacity-90">Logged in as:</p>
                        <p className="font-semibold text-lg">{user?.email}</p>
                        <p className="text-xs opacity-75 mt-1">
                            Data synced across all devices
                        </p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-medium transition-colors"
                    >
                        <LogOut size={18} /> Log Out
                    </button>
                </div>
            </div>

            {/* Quick Notes API */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-4">
                    <Zap className="text-cyan-600" size={24} />
                    <h2 className="text-xl font-semibold text-slate-800">Quick Notes API</h2>
                </div>
                <p className="text-sm text-slate-500 mb-4">
                    Use this API key with iPhone Shortcuts to quickly capture notes via back-tap.
                </p>

                {apiKey ? (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <code className="flex-1 p-3 bg-slate-100 rounded-lg text-sm font-mono text-slate-700 truncate">
                                {apiKey}
                            </code>
                            <button
                                onClick={copyApiKey}
                                className="p-3 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                title="Copy"
                            >
                                {apiKeyCopied ? <Check size={18} className="text-green-600" /> : <Copy size={18} className="text-slate-600" />}
                            </button>
                        </div>
                        <button
                            onClick={generateApiKey}
                            disabled={isGeneratingKey}
                            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800"
                        >
                            <RefreshCw size={14} className={isGeneratingKey ? 'animate-spin' : ''} />
                            Regenerate Key
                        </button>
                        <div className="mt-4 p-3 bg-cyan-50 rounded-lg border border-cyan-100">
                            <p className="text-xs text-cyan-800">
                                <strong>Endpoint:</strong> Your Supabase URL + <code>/functions/v1/quick-note</code>
                            </p>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={generateApiKey}
                        disabled={isGeneratingKey}
                        className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 font-medium"
                    >
                        {isGeneratingKey ? (
                            <RefreshCw size={16} className="animate-spin" />
                        ) : (
                            <Zap size={16} />
                        )}
                        Generate API Key
                    </button>
                )}
            </div>

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
                                    onClick={() => deleteTracker(tracker.id)}
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
                            <Trash2 size={20} /> Delete All Data
                        </button>
                        <p className="text-xs text-center text-slate-400 mt-2">
                            This will permanently delete all your data from the cloud.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
