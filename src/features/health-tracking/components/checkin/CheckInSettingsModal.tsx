import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import { useTrackers } from '../../hooks/useTrackers';
import {
    getCategorySettings,
    updateCategorySettings,
    resetCategorySettings,
    type CheckInSettings,
} from '../../../../services/settings';
import Modal from '../../../../components/ui/Modal';
import { CheckSquare, Square } from 'lucide-react';

interface CheckInSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CheckInSettingsModal: React.FC<CheckInSettingsModalProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const { trackers, updateTracker } = useTrackers();
    const [settings, setSettings] = useState<CheckInSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'general' | 'trackers'>('general');

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
            const data = await getCategorySettings(user.id, 'checkIn');
            setSettings(data);
        } catch (error) {
            console.error('Failed to load check-in settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!user || !settings) return;
        setSaving(true);
        try {
            await updateCategorySettings(user.id, 'checkIn', settings);
            onClose();
        } catch (error) {
            console.error('Failed to save check-in settings:', error);
        } finally {
            setSaving(false);
        }
    };

    const toggleTrackerInCheckIn = async (trackerId: string) => {
        const tracker = trackers.find((t) => t.id === trackerId);
        if (!tracker) return;

        const newConfig = {
            isRequired: tracker.checkinConfig?.isRequired ?? false,
            inCheckin: !tracker.checkinConfig?.inCheckin,
            showInDailyReport: tracker.checkinConfig?.showInDailyReport,
        };

        await updateTracker({
            ...tracker,
            checkinConfig: newConfig,
        });
    };

    const toggleTrackerRequired = async (trackerId: string) => {
        const tracker = trackers.find((t) => t.id === trackerId);
        if (!tracker) return;

        const newConfig = {
            isRequired: !tracker.checkinConfig?.isRequired,
            inCheckin: tracker.checkinConfig?.inCheckin ?? true,
            showInDailyReport: tracker.checkinConfig?.showInDailyReport,
        };

        await updateTracker({
            ...tracker,
            checkinConfig: newConfig,
        });
    };

    const toggleShowInReport = async (trackerId: string) => {
        const tracker = trackers.find((t) => t.id === trackerId);
        if (!tracker) return;

        const newConfig = {
            isRequired: tracker.checkinConfig?.isRequired ?? false,
            inCheckin: tracker.checkinConfig?.inCheckin ?? true,
            showInDailyReport: !tracker.checkinConfig?.showInDailyReport,
        };

        await updateTracker({
            ...tracker,
            checkinConfig: newConfig,
        });
    };

    const handleReset = async () => {
        if (!user) return;
        if (!confirm('Reset all check-in settings to defaults?')) return;
        setSaving(true);
        try {
            await resetCategorySettings(user.id, 'checkIn');
            await loadSettings();
        } catch (error) {
            console.error('Failed to reset check-in settings:', error);
        } finally {
            setSaving(false);
        }
    };

    const updateSetting = <K extends keyof CheckInSettings>(key: K, value: CheckInSettings[K]) => {
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
            <Modal isOpen={isOpen} onClose={onClose} title="Check-In Settings">
                <div className="flex items-center justify-center py-8">
                    <div className="text-cove-soft">Loading settings...</div>
                </div>
            </Modal>
        );
    }

    if (!settings) return null;

    // Group trackers by group
    const groupedTrackers = trackers.reduce(
        (acc, tracker) => {
            const group = tracker.group || 'Other';
            if (!acc[group]) acc[group] = [];
            acc[group].push(tracker);
            return acc;
        },
        {} as Record<string, typeof trackers>,
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Check-In Settings"
            footer={footer}
            size="lg"
        >
            {/* Tab Navigation */}
            <div className="flex gap-2 mb-6 border-b border-cove-border">
                <button
                    onClick={() => setActiveTab('general')}
                    className={`px-4 py-2 text-sm font-bold transition-colors ${
                        activeTab === 'general'
                            ? 'text-cove-accent border-b-2 border-cove-accent'
                            : 'text-cove-muted hover:text-cove-ink'
                    }`}
                >
                    General
                </button>
                <button
                    onClick={() => setActiveTab('trackers')}
                    className={`px-4 py-2 text-sm font-bold transition-colors ${
                        activeTab === 'trackers'
                            ? 'text-cove-accent border-b-2 border-cove-accent'
                            : 'text-cove-muted hover:text-cove-ink'
                    }`}
                >
                    Manage Trackers
                </button>
            </div>

            {activeTab === 'general' ? (
                <div className="space-y-6">
                    {/* Reminder Settings */}
                    <div>
                        <h3 className="text-lg font-bold text-cove-ink mb-4">Reminders</h3>
                        <div className="space-y-4">
                            {/* Daily Reminder Time */}
                            <div>
                                <label className="block text-sm font-bold text-cove-muted mb-2">
                                    Daily Reminder Time
                                </label>
                                <input
                                    type="time"
                                    value={settings.dailyReminderTime}
                                    onChange={(e) =>
                                        updateSetting('dailyReminderTime', e.target.value)
                                    }
                                    className="app-input"
                                />
                            </div>

                            {/* Enable Daily Reminder */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="text-sm font-bold text-cove-muted">
                                        Enable Daily Reminder
                                    </label>
                                    <p className="text-xs text-cove-soft">
                                        Send daily notification for check-in
                                    </p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={settings.enableDailyReminder}
                                    onChange={(e) =>
                                        updateSetting('enableDailyReminder', e.target.checked)
                                    }
                                    className="h-4 w-4 text-cove-accent rounded border-cove-border focus:ring-cove-accent"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Display Settings */}
                    <div>
                        <h3 className="text-lg font-bold text-cove-ink mb-4">Display</h3>
                        <div className="space-y-4">
                            {/* Show Recent Check-Ins */}
                            <div>
                                <label className="block text-sm font-bold text-cove-muted mb-2">
                                    Show Recent Check-Ins (count)
                                </label>
                                <input
                                    type="number"
                                    value={settings.showRecentCheckIns}
                                    onChange={(e) =>
                                        updateSetting(
                                            'showRecentCheckIns',
                                            parseInt(e.target.value) || 0,
                                        )
                                    }
                                    min="1"
                                    max="30"
                                    className="app-input"
                                />
                                <p className="text-xs text-cove-soft mt-1">
                                    Number of recent check-ins to display
                                </p>
                            </div>

                            {/* Completion Celebration */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="text-sm font-bold text-cove-muted">
                                        Completion Celebration
                                    </label>
                                    <p className="text-xs text-cove-soft">
                                        Show celebration when check-in is complete
                                    </p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={settings.completionCelebration}
                                    onChange={(e) =>
                                        updateSetting('completionCelebration', e.target.checked)
                                    }
                                    className="h-4 w-4 text-cove-accent rounded border-cove-border focus:ring-cove-accent"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="bg-cove-tint-blue border border-cove-accent-pale rounded-xl p-4 mb-4">
                        <p className="text-sm text-cove-ink">
                            <strong>Tip:</strong> Toggle which trackers appear in your daily
                            check-in, mark them as required, or show them in your daily report.
                        </p>
                    </div>

                    {Object.entries(groupedTrackers).map(([group, groupTrackers]) => (
                        <div key={group} className="space-y-3">
                            <h3 className="text-sm font-bold text-cove-soft uppercase tracking-wider">
                                {group}
                            </h3>
                            <div className="space-y-2">
                                {groupTrackers.map((tracker) => {
                                    const inCheckIn = tracker.checkinConfig?.inCheckin ?? false;
                                    const isRequired = tracker.checkinConfig?.isRequired ?? false;
                                    const showInReport =
                                        tracker.checkinConfig?.showInDailyReport ?? false;

                                    return (
                                        <div
                                            key={tracker.id}
                                            className={`p-4 rounded-xl border transition-all ${
                                                inCheckIn
                                                    ? 'bg-cove-tint-blue/50 border-cove-accent-pale'
                                                    : 'bg-[color:var(--buddy-surface-soft)] border-cove-border'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <button
                                                    onClick={() =>
                                                        toggleTrackerInCheckIn(tracker.id)
                                                    }
                                                    className="mt-0.5 text-cove-faint hover:text-cove-accent transition-colors"
                                                >
                                                    {inCheckIn ? (
                                                        <CheckSquare
                                                            size={20}
                                                            className="text-cove-accent"
                                                        />
                                                    ) : (
                                                        <Square size={20} />
                                                    )}
                                                </button>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="text-lg">
                                                            {tracker.emoji}
                                                        </span>
                                                        <span className="font-bold text-cove-ink">
                                                            {tracker.name}
                                                        </span>
                                                        {tracker.unit && (
                                                            <span className="text-xs text-cove-soft">
                                                                ({tracker.unit})
                                                            </span>
                                                        )}
                                                    </div>

                                                    {inCheckIn && (
                                                        <div className="flex gap-4 text-sm">
                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isRequired}
                                                                    onChange={() =>
                                                                        toggleTrackerRequired(
                                                                            tracker.id,
                                                                        )
                                                                    }
                                                                    className="h-4 w-4 text-cove-accent rounded border-cove-border"
                                                                />
                                                                <span className="text-cove-muted">
                                                                    Required
                                                                </span>
                                                            </label>

                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={showInReport}
                                                                    onChange={() =>
                                                                        toggleShowInReport(
                                                                            tracker.id,
                                                                        )
                                                                    }
                                                                    className="h-4 w-4 text-cove-accent rounded border-cove-border"
                                                                />
                                                                <span className="text-cove-muted">
                                                                    Show in Report
                                                                </span>
                                                            </label>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {trackers.length === 0 && (
                        <div className="text-center py-12">
                            <p className="text-cove-soft mb-4">No trackers yet</p>
                            <p className="text-sm text-cove-faint">
                                Create trackers in the Health Tracking section first
                            </p>
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
};

export default CheckInSettingsModal;
