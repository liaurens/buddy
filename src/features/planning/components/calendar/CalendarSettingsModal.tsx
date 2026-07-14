import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import {
    getCategorySettings,
    updateCategorySettings,
    resetCategorySettings,
    type CalendarSettings,
} from '../../../../services/settings';
import Modal from '../../../../components/ui/Modal';
import { syncCalendar, type SyncResult } from '../../services/calendar-sync.service';
import { calendarConfigSchema } from '../../../../lib/validation/schemas';
import GoogleCalendarConnect from './GoogleCalendarConnect';

interface CalendarSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CalendarSettingsModal: React.FC<CalendarSettingsModalProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const [settings, setSettings] = useState<CalendarSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
    const [urlError, setUrlError] = useState<string | null>(null);

    // Returns the validation error for the current URL, or null when valid/empty.
    const validateUrl = (): string | null => {
        if (!settings?.calendarUrl) return null;
        const result = calendarConfigSchema.safeParse({
            calendarUrl: settings.calendarUrl,
            calendarName: settings.calendarName || undefined,
        });
        return result.success ? null : (result.error.issues[0]?.message ?? 'Invalid calendar URL');
    };

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
            const data = await getCategorySettings(user.id, 'calendar');
            setSettings(data);
        } catch (error) {
            console.error('Failed to load calendar settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!user || !settings) return;
        const error = validateUrl();
        setUrlError(error);
        if (error) return;
        setSaving(true);
        try {
            await updateCategorySettings(user.id, 'calendar', settings);
            onClose();
        } catch (error) {
            console.error('Failed to save calendar settings:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleSyncNow = async () => {
        if (!user || !settings) return;
        const error = validateUrl();
        setUrlError(error);
        if (error) return;
        // Save first so the latest URL is used
        setSyncing(true);
        setSyncResult(null);
        try {
            if (settings.calendarUrl) {
                await updateCategorySettings(user.id, 'calendar', {
                    calendarUrl: settings.calendarUrl,
                });
            }
            const result = await syncCalendar(user.id);
            setSyncResult(result);
            // Reload to show new lastSyncTime
            await loadSettings();
        } catch (e) {
            setSyncResult({
                eventsFound: 0,
                eventsUpserted: 0,
                skipped: 0,
                error: e instanceof Error ? e.message : 'Unknown error',
            });
        } finally {
            setSyncing(false);
        }
    };

    const handleReset = async () => {
        if (!user) return;
        if (!confirm('Reset all calendar settings to defaults?')) return;
        setSaving(true);
        try {
            await resetCategorySettings(user.id, 'calendar');
            await loadSettings();
        } catch (error) {
            console.error('Failed to reset calendar settings:', error);
        } finally {
            setSaving(false);
        }
    };

    const updateSetting = <K extends keyof CalendarSettings>(
        key: K,
        value: CalendarSettings[K],
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
            <Modal isOpen={isOpen} onClose={onClose} title="Calendar Settings">
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
            title="Calendar Settings"
            footer={footer}
            size="lg"
        >
            <div className="space-y-6">
                {/* Google Calendar write integration */}
                <div>
                    <h3 className="text-lg font-medium text-slate-900 mb-4">Google Calendar</h3>
                    <GoogleCalendarConnect />
                </div>

                {/* Calendar Source Settings (read-only iCal feed) */}
                <div>
                    <h3 className="text-lg font-medium text-slate-900 mb-4">Calendar Source</h3>
                    <div className="space-y-4">
                        {/* Calendar URL */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Calendar URL
                            </label>
                            <input
                                type="text"
                                value={settings.calendarUrl || ''}
                                onChange={(e) =>
                                    updateSetting('calendarUrl', e.target.value || null)
                                }
                                placeholder="e.g., https://calendar.google.com/..."
                                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Calendar feed URL or iCal link
                            </p>
                            {urlError && <p className="text-xs text-red-600 mt-1">{urlError}</p>}
                            <button
                                type="button"
                                onClick={handleSyncNow}
                                disabled={syncing || !settings.calendarUrl}
                                className="mt-2 px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors disabled:opacity-50"
                            >
                                {syncing ? 'Syncing…' : 'Sync now'}
                            </button>
                            {syncResult && (
                                <p
                                    className={`text-xs mt-2 ${syncResult.error ? 'text-red-600' : 'text-emerald-700'}`}
                                >
                                    {syncResult.error
                                        ? `Sync failed: ${syncResult.error}`
                                        : `Synced ${syncResult.eventsUpserted} event${syncResult.eventsUpserted === 1 ? '' : 's'}${syncResult.skipped > 0 ? ` (${syncResult.skipped} skipped)` : ''}.`}
                                </p>
                            )}
                        </div>

                        {/* Calendar Name */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Calendar Name
                            </label>
                            <input
                                type="text"
                                value={settings.calendarName}
                                onChange={(e) => updateSetting('calendarName', e.target.value)}
                                placeholder="e.g., Work Calendar"
                                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Display name for this calendar
                            </p>
                        </div>
                    </div>
                </div>

                {/* Sync Settings */}
                <div>
                    <h3 className="text-lg font-medium text-slate-900 mb-4">Synchronization</h3>
                    <div className="space-y-4">
                        {/* Auto Sync Enabled */}
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-medium text-slate-700">
                                    Enable Auto-Sync
                                </label>
                                <p className="text-xs text-slate-500">
                                    Automatically sync calendar events
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.autoSyncEnabled}
                                onChange={(e) => updateSetting('autoSyncEnabled', e.target.checked)}
                                className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            />
                        </div>

                        {/* Sync Interval */}
                        {settings.autoSyncEnabled && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Sync Interval (Minutes)
                                </label>
                                <select
                                    value={settings.syncIntervalMinutes}
                                    onChange={(e) =>
                                        updateSetting(
                                            'syncIntervalMinutes',
                                            parseInt(e.target.value),
                                        )
                                    }
                                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="5">5 minutes</option>
                                    <option value="15">15 minutes</option>
                                    <option value="30">30 minutes</option>
                                    <option value="60">1 hour</option>
                                    <option value="240">4 hours</option>
                                    <option value="1440">1 day</option>
                                </select>
                            </div>
                        )}

                        {/* Last Sync Time (Display Only) */}
                        {settings.lastSyncTime && (
                            <div className="p-3 bg-slate-50 rounded-md">
                                <p className="text-xs text-slate-600">
                                    Last synced:{' '}
                                    <span className="font-medium">
                                        {new Date(settings.lastSyncTime).toLocaleString()}
                                    </span>
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Display Settings */}
                <div>
                    <h3 className="text-lg font-medium text-slate-900 mb-4">Display</h3>
                    <div className="space-y-4">
                        {/* Show in Planning */}
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-medium text-slate-700">
                                    Show in Planning
                                </label>
                                <p className="text-xs text-slate-500">
                                    Display calendar events in planning view
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.showInPlanning}
                                onChange={(e) => updateSetting('showInPlanning', e.target.checked)}
                                className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            />
                        </div>

                        {/* Include All-Day Events */}
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-medium text-slate-700">
                                    Include All-Day Events
                                </label>
                                <p className="text-xs text-slate-500">
                                    Show all-day events in calendar view
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.includeAllDayEvents}
                                onChange={(e) =>
                                    updateSetting('includeAllDayEvents', e.target.checked)
                                }
                                className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            />
                        </div>

                        {/* Minimum Event Duration */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Minimum Event Duration (Minutes)
                            </label>
                            <input
                                type="number"
                                min="5"
                                max="120"
                                step="5"
                                value={settings.minEventDurationMinutes}
                                onChange={(e) =>
                                    updateSetting(
                                        'minEventDurationMinutes',
                                        parseInt(e.target.value),
                                    )
                                }
                                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Hide events shorter than this duration
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default CalendarSettingsModal;
