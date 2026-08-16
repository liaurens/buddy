import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import {
    getCategorySettings,
    updateCategorySettings,
    resetCategorySettings,
    type PomodoroSettings,
} from '../../../services/settings';
import Modal from '../../../components/ui/Modal';

interface PomodoroSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const PomodoroSettingsModal: React.FC<PomodoroSettingsModalProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const [settings, setSettings] = useState<PomodoroSettings | null>(null);
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
            const data = await getCategorySettings(user.id, 'pomodoro');
            setSettings(data);
        } catch (error) {
            console.error('Failed to load pomodoro settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!user || !settings) return;
        setSaving(true);
        try {
            await updateCategorySettings(user.id, 'pomodoro', settings);
            onClose();
        } catch (error) {
            console.error('Failed to save pomodoro settings:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        if (!user) return;
        if (!confirm('Reset all pomodoro settings to defaults?')) return;
        setSaving(true);
        try {
            await resetCategorySettings(user.id, 'pomodoro');
            await loadSettings();
        } catch (error) {
            console.error('Failed to reset pomodoro settings:', error);
        } finally {
            setSaving(false);
        }
    };

    const updateSetting = <K extends keyof PomodoroSettings>(
        key: K,
        value: PomodoroSettings[K],
    ) => {
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
            <Modal isOpen={isOpen} onClose={onClose} title="Pomodoro Settings">
                <div className="flex items-center justify-center py-8">
                    <div className="text-cove-soft">Loading settings...</div>
                </div>
            </Modal>
        );
    }

    if (!settings) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Pomodoro Settings"
            footer={footer}
            size="lg"
        >
            <div className="space-y-6">
                {/* Timer Durations */}
                <div>
                    <h3 className="text-lg font-bold text-cove-ink mb-4">Timer Durations</h3>
                    <div className="space-y-4">
                        {/* Work Duration */}
                        <div>
                            <label className="block text-sm font-bold text-cove-muted mb-2">
                                Work Duration (minutes)
                            </label>
                            <input
                                type="number"
                                value={settings.workDuration}
                                onChange={(e) =>
                                    updateSetting('workDuration', parseInt(e.target.value) || 25)
                                }
                                min="10"
                                max="60"
                                className="app-input"
                            />
                        </div>

                        {/* Short Break Duration */}
                        <div>
                            <label className="block text-sm font-bold text-cove-muted mb-2">
                                Short Break Duration (minutes)
                            </label>
                            <input
                                type="number"
                                value={settings.shortBreakDuration}
                                onChange={(e) =>
                                    updateSetting(
                                        'shortBreakDuration',
                                        parseInt(e.target.value) || 5,
                                    )
                                }
                                min="3"
                                max="15"
                                className="app-input"
                            />
                        </div>

                        {/* Long Break Duration */}
                        <div>
                            <label className="block text-sm font-bold text-cove-muted mb-2">
                                Long Break Duration (minutes)
                            </label>
                            <input
                                type="number"
                                value={settings.longBreakDuration}
                                onChange={(e) =>
                                    updateSetting(
                                        'longBreakDuration',
                                        parseInt(e.target.value) || 15,
                                    )
                                }
                                min="10"
                                max="30"
                                className="app-input"
                            />
                        </div>

                        {/* Long Break Interval */}
                        <div>
                            <label className="block text-sm font-bold text-cove-muted mb-2">
                                Long Break After (sessions)
                            </label>
                            <input
                                type="number"
                                value={settings.longBreakInterval}
                                onChange={(e) =>
                                    updateSetting(
                                        'longBreakInterval',
                                        parseInt(e.target.value) || 4,
                                    )
                                }
                                min="2"
                                max="8"
                                className="app-input"
                            />
                            <p className="text-xs text-cove-soft mt-1">
                                Number of work sessions before taking a long break
                            </p>
                        </div>
                    </div>
                </div>

                {/* Automation Settings */}
                <div>
                    <h3 className="text-lg font-bold text-cove-ink mb-4">Automation</h3>
                    <div className="space-y-4">
                        {/* Auto Start Breaks */}
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-bold text-cove-muted">
                                    Auto-Start Breaks
                                </label>
                                <p className="text-xs text-cove-soft">
                                    Automatically start break after work session ends
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.autoStartBreaks}
                                onChange={(e) => updateSetting('autoStartBreaks', e.target.checked)}
                                className="h-4 w-4 text-cove-accent rounded border-cove-border focus:ring-cove-accent"
                            />
                        </div>

                        {/* Auto Start Pomodoros */}
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-bold text-cove-muted">
                                    Auto-Start Work Sessions
                                </label>
                                <p className="text-xs text-cove-soft">
                                    Automatically start work after break ends
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.autoStartPomodoros}
                                onChange={(e) =>
                                    updateSetting('autoStartPomodoros', e.target.checked)
                                }
                                className="h-4 w-4 text-cove-accent rounded border-cove-border focus:ring-cove-accent"
                            />
                        </div>
                    </div>
                </div>

                {/* Sound Settings */}
                <div>
                    <h3 className="text-lg font-bold text-cove-ink mb-4">Sound</h3>
                    <div className="space-y-4">
                        {/* Sound Enabled */}
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-bold text-cove-muted">
                                    Completion Sound
                                </label>
                                <p className="text-xs text-cove-soft">
                                    Play sound when timer completes
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.soundEnabled}
                                onChange={(e) => updateSetting('soundEnabled', e.target.checked)}
                                className="h-4 w-4 text-cove-accent rounded border-cove-border focus:ring-cove-accent"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default PomodoroSettingsModal;
