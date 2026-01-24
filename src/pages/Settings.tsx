import React, { useState, useEffect } from 'react';
import { useTracker } from '../context/TrackerContext';
import { useAuth } from '../hooks/useAuth';
import { supabase, getSetting, setSetting } from '../services/supabase';
import type { TrackerDefinition, TrackerType } from '../types';
import { Plus, Trash2, Download, Upload, Save, X, Cloud, LogOut, Zap, Copy, RefreshCw, Check, Brain, AlertCircle, Calendar } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { initializeAIService, AIService } from '../services/ai';
import { fetchICalFeed } from '../services/calendar';

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

    // AI Configuration state
    const [aiProvider, setAiProvider] = useState<'openai' | 'anthropic' | 'gemini'>('gemini');
    const [aiApiKey, setAiApiKey] = useState('');
    const [aiModel, setAiModel] = useState('');
    const [isSavingAI, setIsSavingAI] = useState(false);
    const [isTestingConnection, setIsTestingConnection] = useState(false);
    const [connectionTestResult, setConnectionTestResult] = useState<{ success: boolean; message: string } | null>(null);

    // Calendar Configuration state
    const [calendarUrl, setCalendarUrl] = useState('');
    const [calendarName, setCalendarName] = useState('');
    const [isSavingCalendar, setIsSavingCalendar] = useState(false);
    const [isTestingCalendar, setIsTestingCalendar] = useState(false);
    const [calendarTestResult, setCalendarTestResult] = useState<{ success: boolean; message: string; eventCount?: number } | null>(null);
    const [lastCalendarSync, setLastCalendarSync] = useState<string | null>(null);

    // Load existing API key on mount
    useEffect(() => {
        if (user?.id) {
            getSetting(user.id, 'quick_note_api_key').then(key => {
                if (key) setApiKey(key);
            });
        }
    }, [user?.id]);

    // Load AI configuration on mount
    useEffect(() => {
        if (user?.id) {
            Promise.all([
                getSetting(user.id, 'ai_provider'),
                getSetting(user.id, 'ai_api_key'),
                getSetting(user.id, 'ai_model'),
            ]).then(([provider, key, model]) => {
                if (provider) setAiProvider(provider as 'openai' | 'anthropic' | 'gemini');
                if (key) setAiApiKey(key);
                if (model) setAiModel(model);
            });
        }
    }, [user?.id]);

    // Load calendar configuration on mount
    useEffect(() => {
        if (user?.id) {
            Promise.all([
                getSetting(user.id, 'calendar_url'),
                getSetting(user.id, 'calendar_name'),
                getSetting(user.id, 'calendar_last_sync'),
            ]).then(([url, name, lastSync]) => {
                if (url) setCalendarUrl(url);
                if (name) setCalendarName(name);
                if (lastSync) setLastCalendarSync(lastSync);
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

    const handleSaveAIConfig = async () => {
        if (!user?.id || !aiApiKey.trim()) {
            alert('Please enter an API key');
            return;
        }

        setIsSavingAI(true);
        setConnectionTestResult(null);

        try {
            await Promise.all([
                setSetting(user.id, 'ai_provider', aiProvider),
                setSetting(user.id, 'ai_api_key', aiApiKey.trim()),
                aiModel.trim() ? setSetting(user.id, 'ai_model', aiModel.trim()) : Promise.resolve(),
            ]);

            // Initialize AI service with new config
            initializeAIService({
                provider: aiProvider,
                apiKey: aiApiKey.trim(),
                model: aiModel.trim() || undefined,
            });

            alert('AI configuration saved successfully!');
        } catch (error) {
            console.error('Failed to save AI config:', error);
            alert('Failed to save AI configuration');
        } finally {
            setIsSavingAI(false);
        }
    };

    const handleTestAIConnection = async () => {
        if (!aiApiKey.trim()) {
            alert('Please enter an API key first');
            return;
        }

        setIsTestingConnection(true);
        setConnectionTestResult(null);

        try {
            const service = new AIService({
                provider: aiProvider,
                apiKey: aiApiKey.trim(),
                model: aiModel.trim() || undefined,
            });

            const result = await service.testConnection();

            setConnectionTestResult({
                success: result.success,
                message: result.success
                    ? `Connection successful! Ready to use ${aiProvider === 'gemini' ? 'Gemini' : aiProvider === 'openai' ? 'OpenAI' : 'Anthropic'} for daily planning.`
                    : `Connection failed: ${result.error || 'Unknown error'}`,
            });
        } catch (error: any) {
            setConnectionTestResult({
                success: false,
                message: `Connection failed: ${error.message || 'Unknown error'}`,
            });
        } finally {
            setIsTestingConnection(false);
        }
    };

    const handleSaveCalendarConfig = async () => {
        if (!user?.id || !calendarUrl.trim()) {
            alert('Please enter a calendar URL');
            return;
        }

        setIsSavingCalendar(true);
        setCalendarTestResult(null);

        try {
            await Promise.all([
                setSetting(user.id, 'calendar_url', calendarUrl.trim()),
                setSetting(user.id, 'calendar_name', calendarName.trim() || 'My Calendar'),
            ]);

            alert('Calendar configuration saved successfully!');
        } catch (error) {
            console.error('Failed to save calendar config:', error);
            alert('Failed to save calendar configuration');
        } finally {
            setIsSavingCalendar(false);
        }
    };

    const handleTestCalendarSync = async () => {
        if (!calendarUrl.trim()) {
            alert('Please enter a calendar URL first');
            return;
        }

        setIsTestingCalendar(true);
        setCalendarTestResult(null);

        try {
            const result = await fetchICalFeed(calendarUrl.trim());

            if (result.success) {
                // Save last sync time
                if (user?.id) {
                    await setSetting(user.id, 'calendar_last_sync', result.syncedAt);
                    setLastCalendarSync(result.syncedAt);
                }

                setCalendarTestResult({
                    success: true,
                    message: `Successfully synced ${result.events.length} event${result.events.length !== 1 ? 's' : ''} from calendar!`,
                    eventCount: result.events.length,
                });
            } else {
                setCalendarTestResult({
                    success: false,
                    message: `Sync failed: ${result.error || 'Unknown error'}`,
                });
            }
        } catch (error: any) {
            setCalendarTestResult({
                success: false,
                message: `Sync failed: ${error.message || 'Unknown error'}`,
            });
        } finally {
            setIsTestingCalendar(false);
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

            {/* AI Configuration */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-4">
                    <Brain className="text-indigo-600" size={24} />
                    <h2 className="text-xl font-semibold text-slate-800">AI Configuration</h2>
                </div>
                <p className="text-sm text-slate-500 mb-6">
                    Configure AI provider for daily planning assistance. Your API key is stored securely and never shared.
                </p>

                <div className="space-y-4">
                    {/* Provider Selection */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">AI Provider</label>
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                type="button"
                                onClick={() => setAiProvider('gemini')}
                                className={`p-3 rounded-lg border-2 transition-all ${
                                    aiProvider === 'gemini'
                                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                                }`}
                            >
                                <div className="font-medium">Gemini</div>
                                <div className="text-xs text-slate-500">Free tier ✓</div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setAiProvider('openai')}
                                className={`p-3 rounded-lg border-2 transition-all ${
                                    aiProvider === 'openai'
                                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                                }`}
                            >
                                <div className="font-medium">OpenAI</div>
                                <div className="text-xs text-slate-500">GPT-4 models</div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setAiProvider('anthropic')}
                                className={`p-3 rounded-lg border-2 transition-all ${
                                    aiProvider === 'anthropic'
                                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                                }`}
                            >
                                <div className="font-medium">Anthropic</div>
                                <div className="text-xs text-slate-500">Claude models</div>
                            </button>
                        </div>
                    </div>

                    {/* API Key Input */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            API Key
                            <span className="text-xs text-slate-500 ml-2">
                                ({aiProvider === 'gemini' ? 'Get from aistudio.google.com' : aiProvider === 'openai' ? 'Get from platform.openai.com' : 'Get from console.anthropic.com'})
                            </span>
                        </label>
                        <input
                            type="password"
                            value={aiApiKey}
                            onChange={(e) => setAiApiKey(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-mono"
                            placeholder={aiProvider === 'gemini' ? 'AI...' : aiProvider === 'openai' ? 'sk-...' : 'sk-ant-...'}
                        />
                    </div>

                    {/* Model Selection (Optional) */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Model (Optional)
                            <span className="text-xs text-slate-500 ml-2">Leave empty for default</span>
                        </label>
                        <input
                            type="text"
                            value={aiModel}
                            onChange={(e) => setAiModel(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                            placeholder={aiProvider === 'gemini' ? 'gemini-2.0-flash-exp' : aiProvider === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-20250514'}
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleSaveAIConfig}
                            disabled={isSavingAI || !aiApiKey.trim()}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                            {isSavingAI ? (
                                <>
                                    <RefreshCw size={16} className="animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save size={16} />
                                    Save Configuration
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleTestAIConnection}
                            disabled={isTestingConnection || !aiApiKey.trim()}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                            {isTestingConnection ? (
                                <>
                                    <RefreshCw size={16} className="animate-spin" />
                                    Testing...
                                </>
                            ) : (
                                <>
                                    <Zap size={16} />
                                    Test
                                </>
                            )}
                        </button>
                    </div>

                    {/* Connection Test Result */}
                    {connectionTestResult && (
                        <div className={`p-3 rounded-lg border flex items-start gap-2 ${
                            connectionTestResult.success
                                ? 'bg-green-50 border-green-200'
                                : 'bg-red-50 border-red-200'
                        }`}>
                            <AlertCircle
                                size={16}
                                className={connectionTestResult.success ? 'text-green-600 mt-0.5' : 'text-red-600 mt-0.5'}
                            />
                            <p className={`text-sm ${
                                connectionTestResult.success ? 'text-green-800' : 'text-red-800'
                            }`}>
                                {connectionTestResult.message}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Calendar Integration */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-4">
                    <Calendar className="text-purple-600" size={24} />
                    <h2 className="text-xl font-semibold text-slate-800">Calendar Integration</h2>
                </div>
                <p className="text-sm text-slate-500 mb-6">
                    Connect your iPhone calendar or Google Calendar to automatically import events into your daily plan.
                </p>

                <div className="space-y-4">
                    {/* Calendar Name */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Calendar Name
                            <span className="text-xs text-slate-500 ml-2">(Optional)</span>
                        </label>
                        <input
                            type="text"
                            value={calendarName}
                            onChange={(e) => setCalendarName(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                            placeholder="My Calendar"
                        />
                    </div>

                    {/* iCal URL */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            iCal/Webcal URL
                            <span className="text-xs text-slate-500 ml-2">
                                (Get from iPhone Calendar → Settings → Accounts)
                            </span>
                        </label>
                        <input
                            type="url"
                            value={calendarUrl}
                            onChange={(e) => setCalendarUrl(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm font-mono"
                            placeholder="https://calendar.google.com/calendar/ical/..."
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Supports: Apple iCloud Calendar, Google Calendar public links
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleSaveCalendarConfig}
                            disabled={isSavingCalendar || !calendarUrl.trim()}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                            {isSavingCalendar ? (
                                <>
                                    <RefreshCw size={16} className="animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save size={16} />
                                    Save Configuration
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleTestCalendarSync}
                            disabled={isTestingCalendar || !calendarUrl.trim()}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                            {isTestingCalendar ? (
                                <>
                                    <RefreshCw size={16} className="animate-spin" />
                                    Testing...
                                </>
                            ) : (
                                <>
                                    <RefreshCw size={16} />
                                    Test Sync
                                </>
                            )}
                        </button>
                    </div>

                    {/* Last Sync Info */}
                    {lastCalendarSync && (
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <p className="text-xs text-slate-600">
                                <strong>Last synced:</strong> {new Date(lastCalendarSync).toLocaleString()}
                            </p>
                        </div>
                    )}

                    {/* Sync Test Result */}
                    {calendarTestResult && (
                        <div className={`p-3 rounded-lg border flex items-start gap-2 ${
                            calendarTestResult.success
                                ? 'bg-green-50 border-green-200'
                                : 'bg-red-50 border-red-200'
                        }`}>
                            <AlertCircle
                                size={16}
                                className={calendarTestResult.success ? 'text-green-600 mt-0.5' : 'text-red-600 mt-0.5'}
                            />
                            <div className="flex-1">
                                <p className={`text-sm ${
                                    calendarTestResult.success ? 'text-green-800' : 'text-red-800'
                                }`}>
                                    {calendarTestResult.message}
                                </p>
                                {calendarTestResult.success && calendarTestResult.eventCount !== undefined && (
                                    <p className="text-xs text-green-700 mt-1">
                                        Events in the next 7 days: {calendarTestResult.eventCount}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
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
