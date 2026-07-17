import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useTrackers } from '../../health-tracking/hooks/useTrackers';
import {
    User,
    LogOut,
    Download,
    Upload,
    Trash2,
    Zap,
    Copy,
    RefreshCw,
    Check,
    Brain,
} from 'lucide-react';
import AssistantDevPanel from '../../assistant/components/AssistantDevPanel';
import { supabase } from '../../../services/supabase';
import type { AISettings } from '../../../services/settings';
import {
    getAIConfigStatus,
    saveAIConfig,
    testAIConfig,
} from '../../assistant/services/ai-actions.service';
import {
    clearPrivateAccountData,
    getCaptureTokenStatus,
    rotateCaptureToken,
} from '../../assistant/services/capture-token.service';
import { useToast } from '../../../components/ui/Toast';
import { dataImportSchema, aiConfigSchema } from '../../../lib/validation/schemas';
import { NotificationPermissionPrompt } from '../../../components/notifications';
import { showLocalNotification, scheduleNotificationIn } from '../../../services/notifications';

interface AccountPageProps {
    embedded?: boolean;
}

const AccountPage: React.FC<AccountPageProps> = ({ embedded = false }) => {
    const { user, signOut } = useAuth();
    const { exportData, importData } = useTrackers();
    const toast = useToast();

    // Data Management State
    const [importText, setImportText] = useState('');
    const [showImport, setShowImport] = useState(false);

    // API Key State
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
    const [apiKeyPrefix, setApiKeyPrefix] = useState<string | null>(null);
    const [apiKeyCopied, setApiKeyCopied] = useState(false);
    const [isGeneratingKey, setIsGeneratingKey] = useState(false);

    // AI Settings State
    const [aiSettings, setAiSettings] = useState<AISettings | null>(null);
    const [aiSaving, setAiSaving] = useState(false);
    const [aiTesting, setAiTesting] = useState(false);
    const [aiConfigured, setAiConfigured] = useState(false);

    // Load API key and AI settings
    useEffect(() => {
        if (user?.id) {
            getCaptureTokenStatus()
                .then((status) => {
                    setApiKeyConfigured(status.configured);
                    setApiKeyPrefix(status.prefix);
                })
                .catch((error) => console.error('Failed to load capture token status:', error));
            getAIConfigStatus()
                .then((status) => {
                    setAiConfigured(status.configured);
                    setAiSettings({
                        aiProvider: status.provider,
                        aiApiKey: null,
                        aiModel: status.model,
                    });
                })
                .catch(() => {
                    setAiSettings({ aiProvider: 'openai', aiApiKey: null, aiModel: null });
                });
        }
    }, [user?.id]);

    const handleSaveAiSettings = async () => {
        if (!user?.id || !aiSettings) return;
        // Validate key format when one is set (empty key = AI disabled, allowed)
        if (aiSettings.aiApiKey) {
            const result = aiConfigSchema.safeParse({
                provider: aiSettings.aiProvider,
                apiKey: aiSettings.aiApiKey,
                model: aiSettings.aiModel ?? undefined,
            });
            if (!result.success) {
                toast.error(result.error.issues[0]?.message ?? 'Invalid AI settings');
                return;
            }
        }
        setAiSaving(true);
        try {
            const status = await saveAIConfig({
                provider: aiSettings.aiProvider,
                apiKey: aiSettings.aiApiKey || undefined,
                model: aiSettings.aiModel,
            });
            setAiConfigured(status.configured);
            setAiSettings({ ...aiSettings, aiApiKey: null });
            toast.success('AI settings saved');
        } catch (error) {
            console.error('Failed to save AI settings:', error);
            toast.error('Failed to save AI settings');
        } finally {
            setAiSaving(false);
        }
    };

    const handleTestAiSettings = async () => {
        if (!aiSettings) return;
        setAiTesting(true);
        try {
            await testAIConfig({
                provider: aiSettings.aiProvider,
                apiKey: aiSettings.aiApiKey || undefined,
                model: aiSettings.aiModel,
            });
            toast.success('AI connection works');
        } catch (error) {
            console.error('AI connection test failed:', error);
            toast.error(error instanceof Error ? error.message : 'AI connection failed');
        } finally {
            setAiTesting(false);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut();
        } catch (error) {
            console.error('Logout failed:', error);
            toast.error('Failed to log out');
        }
    };

    // Data Management Functions
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
        toast.success('Data exported successfully');
    };

    const handleImport = async () => {
        try {
            const parsedData = JSON.parse(importText);
            const validatedData = dataImportSchema.parse(parsedData);

            if (await importData(JSON.stringify(validatedData))) {
                toast.success('Data imported successfully!');
                setImportText('');
                setShowImport(false);
            } else {
                toast.error('Failed to import data. Please try again.');
            }
        } catch (error: unknown) {
            if (error instanceof SyntaxError) {
                toast.error('Invalid JSON format. Please check your input.');
            } else if (error instanceof Error && error.name === 'ZodError') {
                toast.error(`Validation error: ${error.message}`);
            } else {
                toast.error('Failed to import data. Invalid format.');
            }
        }
    };

    const handleResetDatabase = async () => {
        if (
            confirm(
                'ARE YOU SURE? This will delete ALL your data (trackers, entries, protocols). This cannot be undone.',
            )
        ) {
            if (!user?.id) return;
            try {
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
                await clearPrivateAccountData();

                toast.success('All data deleted');
                setTimeout(() => window.location.reload(), 1000);
            } catch (error) {
                console.error('Failed to delete data:', error);
                toast.error('Failed to reset data. See console for details.');
            }
        }
    };

    // API Key Functions
    const generateApiKey = async () => {
        if (!user?.id) return;
        setIsGeneratingKey(true);
        try {
            const result = await rotateCaptureToken();
            setApiKey(result.token);
            setApiKeyConfigured(true);
            setApiKeyPrefix(result.prefix);
            toast.success('API key generated');
        } catch (error) {
            console.error('Failed to generate API key:', error);
            toast.error('Failed to generate API key');
        } finally {
            setIsGeneratingKey(false);
        }
    };

    const copyApiKey = () => {
        if (apiKey) {
            navigator.clipboard.writeText(apiKey);
            setApiKeyCopied(true);
            toast.success('API key copied');
            setTimeout(() => setApiKeyCopied(false), 2000);
        }
    };

    // Test Notification Functions
    const handleTestNotificationNow = async () => {
        try {
            await showLocalNotification('Test Notification', 'This is a test from Buddy App! 🎉', {
                testData: 'immediate',
            });
            toast.success('Notification sent!');
        } catch (error) {
            console.error('Test notification failed:', error);
            toast.error('Failed to send notification. Check permissions.');
        }
    };

    const handleTestNotificationScheduled = async () => {
        if (!user?.id) return;
        try {
            await scheduleNotificationIn(
                user.id,
                'tracker',
                'tracker_reminder',
                1, // 1 minute from now
                'Scheduled Test',
                'This notification was scheduled 1 minute ago! ⏰',
                { testData: 'scheduled' },
            );
            toast.success('Notification scheduled for 1 minute from now');
        } catch (error) {
            console.error('Schedule failed:', error);
            toast.error('Failed to schedule notification');
        }
    };

    return (
        <div className={embedded ? 'space-y-5' : 'app-page-readable'}>
            {/* Page Header */}
            {!embedded && (
                <header>
                    <div className="px-1 pb-1 pt-1.5 text-[22px] font-black text-cove-ink">
                        Account
                    </div>
                    <div className="px-1 pb-4 text-[13.5px] font-semibold text-cove-muted">
                        Your profile, AI setup, capture key, and data.
                    </div>
                </header>
            )}

            {/* Account Info */}
            <div className="rounded-[20px] bg-cove-accent p-5 text-white shadow-cove-strong">
                <div className="flex items-center gap-3 mb-4">
                    <User size={24} />
                    <h2 className="text-lg font-extrabold">Profile</h2>
                </div>

                <div className="space-y-4">
                    <div className="bg-white/20 rounded-[14px] p-4">
                        <p className="text-sm font-semibold opacity-90">Logged in as:</p>
                        <p className="font-extrabold text-lg">{user?.email}</p>
                        <p className="text-xs font-semibold opacity-75 mt-1">
                            Data synced across all devices
                        </p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 py-2 bg-white/20 hover:bg-white/30 rounded-[12px] font-extrabold transition-colors"
                    >
                        <LogOut size={18} /> Log Out
                    </button>
                </div>
            </div>

            {/* AI Provider Settings */}
            <div className="app-surface p-5">
                <div className="flex items-center gap-3 mb-4">
                    <Brain className="text-cove-accent" size={24} />
                    <div>
                        <h2 className="text-[15px] font-extrabold text-cove-ink">AI Provider</h2>
                        <p className="text-xs font-semibold text-cove-muted">
                            Powers the Buddy Assistant and AI planning
                        </p>
                    </div>
                </div>

                {aiSettings ? (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-cove-ink mb-1">
                                Provider
                            </label>
                            <select
                                value={aiSettings.aiProvider}
                                onChange={(e) =>
                                    setAiSettings({
                                        ...aiSettings,
                                        aiProvider: e.target.value as AISettings['aiProvider'],
                                    })
                                }
                                className="w-full rounded-[12px] border border-cove-border px-3 py-2 text-sm font-semibold text-cove-ink focus:outline-none focus:ring-2 focus:ring-cove-accent-pale"
                            >
                                <option value="openai">OpenAI</option>
                                <option value="anthropic">Anthropic</option>
                                <option value="gemini">Google Gemini</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-cove-ink mb-1">
                                API Key
                            </label>
                            <input
                                type="password"
                                placeholder={
                                    aiConfigured
                                        ? 'Saved securely - enter to replace'
                                        : 'Enter your API key'
                                }
                                value={aiSettings.aiApiKey || ''}
                                onChange={(e) =>
                                    setAiSettings({
                                        ...aiSettings,
                                        aiApiKey: e.target.value || null,
                                    })
                                }
                                className="w-full rounded-[12px] border border-cove-border px-3 py-2 text-sm font-semibold text-cove-ink focus:outline-none focus:ring-2 focus:ring-cove-accent-pale"
                            />
                            <p className="text-xs font-semibold text-cove-soft mt-1">
                                The saved key is only available to the server and is never returned
                                to this browser.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-cove-ink mb-1">
                                Model (optional)
                            </label>
                            <input
                                type="text"
                                placeholder="Leave blank for default"
                                value={aiSettings.aiModel || ''}
                                onChange={(e) =>
                                    setAiSettings({
                                        ...aiSettings,
                                        aiModel: e.target.value || null,
                                    })
                                }
                                className="w-full rounded-[12px] border border-cove-border px-3 py-2 text-sm font-semibold text-cove-ink focus:outline-none focus:ring-2 focus:ring-cove-accent-pale"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={handleTestAiSettings}
                                disabled={aiSaving || aiTesting}
                                className="rounded-[12px] bg-[#eef6fa] px-4 py-2 text-sm font-extrabold text-cove-muted hover:bg-cove-track transition-colors disabled:opacity-50"
                            >
                                {aiTesting ? 'Testing...' : 'Test connection'}
                            </button>
                            <button
                                onClick={handleSaveAiSettings}
                                disabled={aiSaving || aiTesting}
                                className="app-primary-button py-2"
                            >
                                {aiSaving ? 'Saving...' : 'Save settings'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm font-semibold text-cove-soft">Loading...</p>
                )}
            </div>

            {/* Notifications Section */}
            {user?.id && (
                <div className="space-y-3">
                    <NotificationPermissionPrompt userId={user.id} showCloseButton={false} />

                    {/* Test Notification Buttons */}
                    <div className="app-surface p-4">
                        <h3 className="text-[14.5px] font-extrabold text-cove-ink mb-3">
                            Test Notifications
                        </h3>
                        <div className="flex gap-2">
                            <button
                                onClick={handleTestNotificationNow}
                                className="flex-1 px-4 py-2 bg-cove-tint-blue text-cove-accent rounded-[12px] hover:bg-cove-accent-pale transition-colors text-sm font-extrabold"
                            >
                                Send Now
                            </button>
                            <button
                                onClick={handleTestNotificationScheduled}
                                className="flex-1 px-4 py-2 bg-cove-tint-purple text-cove-purple rounded-[12px] hover:bg-cove-tint-purple/70 transition-colors text-sm font-extrabold"
                            >
                                Schedule (1 min)
                            </button>
                        </div>
                        <p className="text-xs font-semibold text-cove-muted mt-2">
                            First enable notifications above, then test with these buttons
                        </p>
                    </div>
                </div>
            )}

            {/* Quick Capture API Section */}
            <div className="app-surface p-5">
                <div className="flex items-center gap-3 mb-4">
                    <Zap className="text-cove-accent" size={24} />
                    <h2 className="text-[15px] font-extrabold text-cove-ink">
                        Quick Capture API (iPhone Shortcut)
                    </h2>
                </div>
                <p className="text-sm font-semibold text-cove-muted mb-4">
                    Use this API key with an iPhone Shortcut to capture anything via Siri /
                    back-tap. Free text → AI figures it out. Prefix with a flag (e.g.{' '}
                    <code>-remind 14:00 …</code>) to skip AI.
                </p>

                {apiKeyConfigured ? (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <code className="flex-1 p-3 bg-[#eef6fa] rounded-[12px] text-sm font-mono text-cove-ink truncate">
                                {apiKey ?? `${apiKeyPrefix ?? 'qn_'}••••••••••••••••••••`}
                            </code>
                            {apiKey && (
                                <button
                                    onClick={copyApiKey}
                                    className="p-3 bg-[#eef6fa] hover:bg-cove-track rounded-[12px] transition-colors"
                                    title="Copy"
                                >
                                    {apiKeyCopied ? (
                                        <Check size={18} className="text-cove-success" />
                                    ) : (
                                        <Copy size={18} className="text-cove-muted" />
                                    )}
                                </button>
                            )}
                        </div>
                        {!apiKey && (
                            <p className="text-xs font-semibold text-cove-muted">
                                The token is stored as a one-way hash. Rotate it to reveal a new
                                token once.
                            </p>
                        )}
                        <button
                            onClick={generateApiKey}
                            disabled={isGeneratingKey}
                            className="flex items-center gap-2 text-sm font-bold text-cove-muted hover:text-cove-ink"
                        >
                            <RefreshCw
                                size={14}
                                className={isGeneratingKey ? 'animate-spin' : ''}
                            />
                            Rotate Key
                        </button>
                        <div className="mt-4 p-3 bg-cove-tint-blue rounded-[12px] space-y-2">
                            <p className="text-xs font-semibold text-cove-ink">
                                <strong>Endpoint:</strong>{' '}
                                <code>{`<supabase-url>/functions/v1/assistant`}</code> (POST)
                            </p>
                            <p className="text-xs font-semibold text-cove-ink">
                                <strong>Body:</strong>{' '}
                                <code>{`{ "input": "<text>", "api_key": "<key above>", "source": "iphone" }`}</code>
                            </p>
                            <p className="text-xs font-semibold text-cove-ink">
                                <strong>Response:</strong> JSON with <code>success</code>,{' '}
                                <code>action_taken</code>, <code>data</code>. Show{' '}
                                <code>action_taken</code> in a Notification action to confirm.
                            </p>
                        </div>
                        <div className="mt-2 p-3 bg-[#eef6fa] rounded-[12px]">
                            <p className="text-xs font-extrabold text-cove-ink mb-2">
                                Flag cheat sheet (skip AI):
                            </p>
                            <ul className="text-xs text-cove-muted space-y-1 font-mono">
                                <li>
                                    <code>-task</code> / <code>-todo</code> &nbsp; fix bike by
                                    friday
                                </li>
                                <li>
                                    <code>-done</code> &nbsp; fix bike
                                </li>
                                <li>
                                    <code>-note</code> &nbsp; idea for the chapter intro
                                </li>
                                <li>
                                    <code>-find</code> &nbsp; machine learning
                                </li>
                                <li>
                                    <code>-shop</code> / <code>-boodschap</code> &nbsp; milk, eggs
                                </li>
                                <li>
                                    <code>-remind</code> &nbsp; 14:00 call dentist &nbsp;
                                    <em>(needs a time)</em>
                                </li>
                                <li>
                                    <code>-mood</code> &nbsp; 4 feeling good
                                </li>
                                <li>
                                    <code>-checkin</code> &nbsp; sleep 7 energy 3
                                </li>
                                <li>
                                    <code>-journal</code> &nbsp; today I learned…
                                </li>
                                <li>
                                    <code>-goal</code> &nbsp; read 20 books this year
                                </li>
                                <li>
                                    <code>-study</code> &nbsp; linear algebra 2h
                                </li>
                                <li>
                                    <code>-agenda</code> &nbsp; <em>(today's calendar)</em>
                                </li>
                                <li>
                                    <code>-habits</code> &nbsp; <em>(streaks &amp; open tasks)</em>
                                </li>
                            </ul>
                            <p className="text-[11px] font-semibold text-cove-soft mt-2">
                                No flag → AI routes it. Slash form (<code>/task …</code>) works too.
                            </p>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={generateApiKey}
                        disabled={isGeneratingKey}
                        className="app-primary-button"
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

            {/* AI Debug Panel */}
            {user?.id && <AssistantDevPanel userId={user.id} />}

            {/* Data Management Section */}
            <div className="app-surface overflow-hidden">
                <div className="p-4 bg-[#eef6fa]">
                    <h2 className="text-[14.5px] font-extrabold text-cove-ink">Data Management</h2>
                </div>
                <div className="p-4 space-y-4">
                    <div className="flex gap-4">
                        <button
                            onClick={handleExport}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#eef6fa] text-cove-muted rounded-[14px] hover:bg-cove-track font-extrabold transition-colors"
                        >
                            <Download size={20} /> Export Data
                        </button>
                        <button
                            onClick={() => setShowImport(!showImport)}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#eef6fa] text-cove-muted rounded-[14px] hover:bg-cove-track font-extrabold transition-colors"
                        >
                            <Upload size={20} /> Import Data
                        </button>
                    </div>

                    {showImport && (
                        <div className="space-y-3 p-4 bg-[#eef6fa] rounded-[14px]">
                            <label className="block text-sm font-bold text-cove-ink">
                                Paste JSON Data
                            </label>
                            <textarea
                                value={importText}
                                onChange={(e) => setImportText(e.target.value)}
                                className="w-full h-32 p-3 text-sm font-mono border border-cove-border rounded-[12px] bg-white text-cove-ink focus:ring-2 focus:ring-cove-accent-pale outline-none"
                                placeholder='{"entries": [...], "trackers": [...] }'
                            />
                            <button onClick={handleImport} className="app-primary-button w-full">
                                Import Data
                            </button>
                        </div>
                    )}

                    <div className="pt-4 border-t border-cove-border/50">
                        <h3 className="font-extrabold text-cove-pink mb-2 text-sm uppercase tracking-wider">
                            Danger Zone
                        </h3>
                        <button
                            onClick={handleResetDatabase}
                            className="w-full py-3 bg-cove-tint-pink text-cove-pink rounded-[14px] font-extrabold hover:bg-cove-pink/20 transition-colors flex items-center justify-center gap-2"
                        >
                            <Trash2 size={20} /> Delete All Data
                        </button>
                        <p className="text-xs font-semibold text-center text-cove-soft mt-2">
                            This will permanently delete all your data from the cloud.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccountPage;
