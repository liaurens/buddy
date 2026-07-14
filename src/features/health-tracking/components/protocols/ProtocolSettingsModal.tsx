import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import {
    getCategorySettings,
    updateCategorySettings,
    resetCategorySettings,
    type ProtocolSettings,
} from '../../../../services/settings';
import Modal from '../../../../components/ui/Modal';

interface ProtocolSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ProtocolSettingsModal: React.FC<ProtocolSettingsModalProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const [settings, setSettings] = useState<ProtocolSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Load settings when modal opens
    useEffect(() => {
        if (isOpen && user) {
            loadSettings();
        }
    }, [isOpen, user]);

    const loadSettings = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const data = await getCategorySettings(user.id, 'protocol');
            setSettings(data);
        } catch (error) {
            console.error('Failed to load protocol settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!user || !settings) return;
        setSaving(true);
        try {
            await updateCategorySettings(user.id, 'protocol', settings);
            onClose();
        } catch (error) {
            console.error('Failed to save protocol settings:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        if (!user) return;
        if (!confirm('Reset all protocol settings to defaults?')) return;
        setSaving(true);
        try {
            await resetCategorySettings(user.id, 'protocol');
            await loadSettings();
        } catch (error) {
            console.error('Failed to reset protocol settings:', error);
        } finally {
            setSaving(false);
        }
    };

    const updateSetting = <K extends keyof ProtocolSettings>(
        key: K,
        value: ProtocolSettings[K],
    ) => {
        if (settings) {
            setSettings({ ...settings, [key]: value });
        }
    };

    const footer = (
        <>
            <button
                onClick={handleReset}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                disabled={saving}
            >
                Reset to Defaults
            </button>
            <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                disabled={saving}
            >
                Cancel
            </button>
            <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50"
                disabled={saving || loading}
            >
                {saving ? 'Saving...' : 'Save Changes'}
            </button>
        </>
    );

    if (loading) {
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Protocol Settings">
                <div className="flex items-center justify-center py-8">
                    <div className="text-slate-500">Loading settings...</div>
                </div>
            </Modal>
        );
    }

    if (!settings) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Protocol Settings"
            footer={footer}
            size="lg"
        >
            <div className="space-y-6">
                {/* Reminder Settings */}
                <div>
                    <h3 className="text-lg font-medium text-slate-900 mb-4">Reminders</h3>
                    <div className="space-y-4">
                        {/* Default Dose Time */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Default Dose Time
                            </label>
                            <input
                                type="time"
                                value={settings.defaultDoseTime}
                                onChange={(e) => updateSetting('defaultDoseTime', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Enable Dose Reminders */}
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-medium text-slate-700">
                                    Enable Dose Reminders
                                </label>
                                <p className="text-xs text-slate-500">
                                    Send notifications for scheduled doses
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.enableDoseReminders}
                                onChange={(e) =>
                                    updateSetting('enableDoseReminders', e.target.checked)
                                }
                                className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            />
                        </div>

                        {/* Reminder Advance Minutes */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Reminder Advance (minutes)
                            </label>
                            <input
                                type="number"
                                value={settings.reminderAdvanceMinutes}
                                onChange={(e) =>
                                    updateSetting(
                                        'reminderAdvanceMinutes',
                                        parseInt(e.target.value) || 0,
                                    )
                                }
                                min="0"
                                max="180"
                                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Minutes before dose to send reminder
                            </p>
                        </div>

                        {/* Reminder Sound */}
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-medium text-slate-700">
                                    Reminder Sound
                                </label>
                                <p className="text-xs text-slate-500">
                                    Play sound when reminder triggers
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.reminderSound}
                                onChange={(e) => updateSetting('reminderSound', e.target.checked)}
                                className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Display Settings */}
                <div>
                    <h3 className="text-lg font-medium text-slate-900 mb-4">Display</h3>
                    <div className="space-y-4">
                        {/* Show Upcoming Count */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Show Upcoming Count
                            </label>
                            <input
                                type="number"
                                value={settings.showUpcomingCount}
                                onChange={(e) =>
                                    updateSetting(
                                        'showUpcomingCount',
                                        parseInt(e.target.value) || 0,
                                    )
                                }
                                min="1"
                                max="30"
                                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Number of upcoming doses to display
                            </p>
                        </div>

                        {/* Skip Weekends */}
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-medium text-slate-700">
                                    Skip Weekends
                                </label>
                                <p className="text-xs text-slate-500">
                                    Don't show reminders on weekends
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.skipWeekends}
                                onChange={(e) => updateSetting('skipWeekends', e.target.checked)}
                                className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default ProtocolSettingsModal;
