import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useTracker } from '../../../context/TrackerContext';
import { User, LogOut, Download, Upload, Trash2, Zap, Copy, RefreshCw, Check } from 'lucide-react';
import { getSetting, setSetting, supabase } from '../../../services/supabase';
import { useToast } from '../../../components/ui/Toast';
import { dataImportSchema } from '../../../lib/validation/schemas';
import { v4 as uuidv4 } from 'uuid';
import { NotificationPermissionPrompt } from '../../../components/notifications';
import { showLocalNotification, scheduleNotificationIn } from '../../../services/notifications';

const AccountPage: React.FC = () => {
    const { user, signOut } = useAuth();
    const { exportData, importData } = useTracker();
    const toast = useToast();

    // Data Management State
    const [importText, setImportText] = useState('');
    const [showImport, setShowImport] = useState(false);

    // API Key State
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [apiKeyCopied, setApiKeyCopied] = useState(false);
    const [isGeneratingKey, setIsGeneratingKey] = useState(false);

    // Load API key
    useEffect(() => {
        if (user?.id) {
            getSetting(user.id, 'quick_note_api_key').then(key => {
                if (key) setApiKey(key);
            });
        }
    }, [user?.id]);

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
        } catch (error: any) {
            if (error.name === 'SyntaxError') {
                toast.error('Invalid JSON format. Please check your input.');
            } else if (error.name === 'ZodError') {
                const firstError = error.errors[0];
                toast.error(`Validation error: ${firstError.message}`);
            } else {
                toast.error('Failed to import data. Invalid format.');
            }
        }
    };

    const handleResetDatabase = async () => {
        if (confirm('ARE YOU SURE? This will delete ALL your data (trackers, entries, protocols). This cannot be undone.')) {
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
            const newKey = `qn_${uuidv4().replace(/-/g, '')}`;
            await setSetting(user.id, 'quick_note_api_key', newKey);
            setApiKey(newKey);
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
            await showLocalNotification(
                'Test Notification',
                'This is a test from Buddy App! 🎉',
                { testData: 'immediate' }
            );
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
                { testData: 'scheduled' }
            );
            toast.success('Notification scheduled for 1 minute from now');
        } catch (error) {
            console.error('Schedule failed:', error);
            toast.error('Failed to schedule notification');
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-4 pb-24 space-y-6">
            {/* Page Header */}
            <header>
                <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600">
                        <User size={24} />
                    </div>
                    Account
                </h1>
            </header>

            {/* Account Info */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 rounded-xl shadow-sm text-white">
                <div className="flex items-center gap-3 mb-4">
                    <User size={24} />
                    <h2 className="text-xl font-semibold">Profile</h2>
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

            {/* Notifications Section */}
            {user?.id && (
                <div className="space-y-3">
                    <NotificationPermissionPrompt
                        userId={user.id}
                        showCloseButton={false}
                    />

                    {/* Test Notification Buttons */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">Test Notifications</h3>
                        <div className="flex gap-2">
                            <button
                                onClick={handleTestNotificationNow}
                                className="flex-1 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium"
                            >
                                Send Now
                            </button>
                            <button
                                onClick={handleTestNotificationScheduled}
                                className="flex-1 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors text-sm font-medium"
                            >
                                Schedule (1 min)
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            First enable notifications above, then test with these buttons
                        </p>
                    </div>
                </div>
            )}

            {/* Quick Notes API Section */}
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

            {/* Data Management Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50">
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
                        <div className="space-y-3 p-4 bg-slate-50 rounded-xl">
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

export default AccountPage;
