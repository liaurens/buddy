import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import {
    getCategorySettings,
    updateCategorySettings,
    resetCategorySettings,
    type TrackerSettings,
} from '../../../../services/settings';
import Modal from '../../../../components/ui/Modal';

interface TrackerSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const TrackerSettingsModal: React.FC<TrackerSettingsModalProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const [settings, setSettings] = useState<TrackerSettings | null>(null);
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
            const data = await getCategorySettings(user.id, 'tracker');
            setSettings(data);
        } catch (error) {
            console.error('Failed to load tracker settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!user || !settings) return;
        setSaving(true);
        try {
            await updateCategorySettings(user.id, 'tracker', settings);
            onClose();
        } catch (error) {
            console.error('Failed to save tracker settings:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        if (!user) return;
        if (!confirm('Reset all tracker settings to defaults?')) return;
        setSaving(true);
        try {
            await resetCategorySettings(user.id, 'tracker');
            await loadSettings();
        } catch (error) {
            console.error('Failed to reset tracker settings:', error);
        } finally {
            setSaving(false);
        }
    };

    const updateSetting = <K extends keyof TrackerSettings>(key: K, value: TrackerSettings[K]) => {
        if (settings) {
            setSettings({ ...settings, [key]: value });
        }
    };

    const footer = (
        <>
            <button
                onClick={handleReset}
                className="px-4 py-2 text-sm font-bold text-cove-muted hover:text-cove-ink transition-colors"
                disabled={saving}
            >
                Reset to Defaults
            </button>
            <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-bold text-cove-muted hover:bg-[color:var(--buddy-surface-soft)] rounded-xl transition-colors"
                disabled={saving}
            >
                Cancel
            </button>
            <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-bold text-white bg-cove-accent hover:bg-[#3a8dc7] rounded-xl transition-colors disabled:opacity-50"
                disabled={saving || loading}
            >
                {saving ? 'Saving...' : 'Save Changes'}
            </button>
        </>
    );

    if (loading) {
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Tracker Settings">
                <div className="flex items-center justify-center py-8">
                    <div className="text-cove-soft">Loading settings...</div>
                </div>
            </Modal>
        );
    }

    if (!settings) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Tracker Settings" footer={footer} size="lg">
            <div className="space-y-6">
                {/* General Settings */}
                <div>
                    <h3 className="text-lg font-bold text-cove-ink mb-4">General</h3>
                    <div className="space-y-4">
                        {/* Show Goal Progress */}
                        <div className="flex items-center justify-between">
                            <div>
                                <label
                                    htmlFor="showGoalProgress"
                                    className="text-sm font-bold text-cove-muted"
                                >
                                    Show Goal Progress
                                </label>
                                <p className="text-xs text-cove-soft">
                                    Display progress bars on tracker dashboard
                                </p>
                            </div>
                            <input
                                id="showGoalProgress"
                                name="showGoalProgress"
                                type="checkbox"
                                checked={settings.showGoalProgress}
                                onChange={(e) =>
                                    updateSetting('showGoalProgress', e.target.checked)
                                }
                                className="h-4 w-4 text-cove-accent rounded border-cove-border focus:ring-cove-accent"
                            />
                        </div>

                        {/* Hide Empty Trackers */}
                        <div className="flex items-center justify-between">
                            <div>
                                <label
                                    htmlFor="hideEmptyTrackers"
                                    className="text-sm font-bold text-cove-muted"
                                >
                                    Hide Empty Trackers
                                </label>
                                <p className="text-xs text-cove-soft">
                                    Hide trackers with no data on dashboard
                                </p>
                            </div>
                            <input
                                id="hideEmptyTrackers"
                                name="hideEmptyTrackers"
                                type="checkbox"
                                checked={settings.hideEmptyTrackers}
                                onChange={(e) =>
                                    updateSetting('hideEmptyTrackers', e.target.checked)
                                }
                                className="h-4 w-4 text-cove-accent rounded border-cove-border focus:ring-cove-accent"
                            />
                        </div>

                        {/* Tracking Streak */}
                        <div className="flex items-center justify-between">
                            <div>
                                <label
                                    htmlFor="trackingStreak"
                                    className="text-sm font-bold text-cove-muted"
                                >
                                    Show Tracking Streak
                                </label>
                                <p className="text-xs text-cove-soft">
                                    Display streak counter for consecutive tracking days
                                </p>
                            </div>
                            <input
                                id="trackingStreak"
                                name="trackingStreak"
                                type="checkbox"
                                checked={settings.trackingStreak}
                                onChange={(e) => updateSetting('trackingStreak', e.target.checked)}
                                className="h-4 w-4 text-cove-accent rounded border-cove-border focus:ring-cove-accent"
                            />
                        </div>
                    </div>
                </div>

                {/* Chart Settings */}
                <div>
                    <h3 className="text-lg font-bold text-cove-ink mb-4">Chart Display</h3>
                    <div className="space-y-4">
                        {/* Chart Type */}
                        <div>
                            <label
                                htmlFor="chartType"
                                className="block text-sm font-bold text-cove-muted mb-2"
                            >
                                Default Chart Type
                            </label>
                            <select
                                id="chartType"
                                name="chartType"
                                value={settings.chartType}
                                onChange={(e) =>
                                    updateSetting(
                                        'chartType',
                                        e.target.value as 'line' | 'bar' | 'scatter',
                                    )
                                }
                                className="app-input"
                            >
                                <option value="line">Line Chart</option>
                                <option value="bar">Bar Chart</option>
                                <option value="scatter">Scatter Plot</option>
                            </select>
                        </div>

                        {/* Chart Default Days */}
                        <div>
                            <label
                                htmlFor="chartDefaultDays"
                                className="block text-sm font-bold text-cove-muted mb-2"
                            >
                                Default Time Range
                            </label>
                            <select
                                id="chartDefaultDays"
                                name="chartDefaultDays"
                                value={settings.chartDefaultDays}
                                onChange={(e) =>
                                    updateSetting(
                                        'chartDefaultDays',
                                        parseInt(e.target.value) as 7 | 14 | 30 | 90,
                                    )
                                }
                                className="app-input"
                            >
                                <option value="7">7 days</option>
                                <option value="14">14 days</option>
                                <option value="30">30 days</option>
                                <option value="90">90 days</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Reminder Settings */}
                <div>
                    <h3 className="text-lg font-bold text-cove-ink mb-4">Reminders</h3>
                    <div className="space-y-4">
                        {/* Enable Reminders */}
                        <div className="flex items-center justify-between">
                            <div>
                                <label
                                    htmlFor="enableReminders"
                                    className="text-sm font-bold text-cove-muted"
                                >
                                    Enable Daily Reminders
                                </label>
                                <p className="text-xs text-cove-soft">
                                    Send push notifications to track metrics
                                </p>
                            </div>
                            <input
                                id="enableReminders"
                                name="enableReminders"
                                type="checkbox"
                                checked={settings.enableReminders}
                                onChange={(e) => updateSetting('enableReminders', e.target.checked)}
                                className="h-4 w-4 text-cove-accent rounded border-cove-border focus:ring-cove-accent"
                            />
                        </div>

                        {/* Default Reminder Time */}
                        {settings.enableReminders && (
                            <div>
                                <label
                                    htmlFor="defaultReminderTime"
                                    className="block text-sm font-bold text-cove-muted mb-2"
                                >
                                    Default Reminder Time
                                </label>
                                <input
                                    id="defaultReminderTime"
                                    name="defaultReminderTime"
                                    type="time"
                                    value={settings.defaultReminderTime}
                                    onChange={(e) =>
                                        updateSetting('defaultReminderTime', e.target.value)
                                    }
                                    className="app-input"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default TrackerSettingsModal;
