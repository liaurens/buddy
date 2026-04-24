/**
 * Notifications Settings Page
 *
 * Enables push, manages the morning/midday/night routine reminder times,
 * and toggles task-due + calendar-event reminders. Persists to settings
 * category `notifications` and reschedules `scheduled_notifications` rows
 * on save.
 */

import React, { useEffect, useState } from 'react';
import { Bell, Check, AlertCircle, Sun, CloudSun, Moon, CheckSquare, Calendar, Smartphone } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import {
    getCategorySettings,
    updateCategorySettings,
    type NotificationsSettings,
} from '../../../services/settings';
import {
    subscribeToPush,
    unsubscribeFromPush,
    isSubscribed,
    getNotificationPermission,
    isPushSupported,
    showLocalNotification,
} from '../../../services/notifications/push.service';
import { reapplyNotificationSchedule } from '../services/notifications-schedule.service';

const NotificationsPage: React.FC = () => {
    const { user } = useAuth();
    const [settings, setSettings] = useState<NotificationsSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [pushSubscribed, setPushSubscribed] = useState(false);
    const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
    const pushSupported = isPushSupported();

    useEffect(() => {
        if (!user?.id) return;
        (async () => {
            setLoading(true);
            try {
                const s = await getCategorySettings(user.id, 'notifications');
                setSettings(s);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load settings');
            } finally {
                setLoading(false);
            }
        })();
    }, [user?.id]);

    useEffect(() => {
        if (!pushSupported) return;
        setPushPermission(getNotificationPermission());
        isSubscribed().then(setPushSubscribed);
    }, [pushSupported]);

    if (!user) return null;

    const update = <K extends keyof NotificationsSettings>(key: K, value: NotificationsSettings[K]) => {
        setSettings(prev => prev ? { ...prev, [key]: value } : prev);
        setSuccess(null);
    };

    const handleEnablePush = async () => {
        if (!user?.id) return;
        setError(null);
        try {
            await subscribeToPush(user.id);
            setPushSubscribed(true);
            setPushPermission(getNotificationPermission());
            update('pushEnabled', true);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to enable push');
        }
    };

    const handleDisablePush = async () => {
        if (!user?.id) return;
        setError(null);
        try {
            await unsubscribeFromPush(user.id);
            setPushSubscribed(false);
            update('pushEnabled', false);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to disable push');
        }
    };

    const handleTest = async () => {
        setError(null);
        try {
            await showLocalNotification('Test notification', 'If you see this, local notifications work.', {});
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Test failed');
        }
    };

    const handleSave = async () => {
        if (!user?.id || !settings) return;
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            await updateCategorySettings(user.id, 'notifications', settings);
            await reapplyNotificationSchedule(user.id, settings);
            setSuccess('Saved. Routine reminders rescheduled.');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    if (loading || !settings) {
        return <div className="text-center py-12 text-sm text-slate-400">Loading…</div>;
    }

    return (
        <div className="max-w-2xl mx-auto pb-24 space-y-5">
            <header className="pt-2">
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <Bell size={24} className="text-indigo-600" /> Notifications
                </h1>
                <p className="text-sm text-slate-500">Reminders for your routines, tasks, and calendar.</p>
            </header>

            {/* Push status */}
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                <div className="flex items-center gap-2">
                    <Smartphone size={18} className="text-slate-500" />
                    <h2 className="font-semibold text-slate-900">Push on this device</h2>
                </div>
                {!pushSupported ? (
                    <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        This browser does not support push notifications. On iPhone, you must first add the app to your home screen and open it from there.
                    </p>
                ) : pushSubscribed ? (
                    <div className="space-y-2">
                        <p className="text-sm text-emerald-700 flex items-center gap-2">
                            <Check size={16} /> Push is enabled on this device (permission: {pushPermission}).
                        </p>
                        <div className="flex gap-2 flex-wrap">
                            <button onClick={handleTest} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
                                Send test notification
                            </button>
                            <button onClick={handleDisablePush} className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                                Disable push
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <p className="text-sm text-slate-600">
                            Push is not enabled. You'll only see in-app banners while the app is open.
                        </p>
                        <button onClick={handleEnablePush} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                            Enable push
                        </button>
                    </div>
                )}
            </section>

            {/* Routine reminders */}
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
                <h2 className="font-semibold text-slate-900">Daily routine reminders</h2>

                <RoutineRow
                    icon={<Sun size={18} className="text-amber-500" />}
                    label="Morning"
                    enabled={settings.morningEnabled}
                    time={settings.morningTime}
                    onToggle={v => update('morningEnabled', v)}
                    onTimeChange={v => update('morningTime', v)}
                />
                <RoutineRow
                    icon={<CloudSun size={18} className="text-sky-500" />}
                    label="Midday"
                    enabled={settings.middayEnabled}
                    time={settings.middayTime}
                    onToggle={v => update('middayEnabled', v)}
                    onTimeChange={v => update('middayTime', v)}
                />
                <RoutineRow
                    icon={<Moon size={18} className="text-indigo-500" />}
                    label="Night"
                    enabled={settings.nightEnabled}
                    time={settings.nightTime}
                    onToggle={v => update('nightEnabled', v)}
                    onTimeChange={v => update('nightTime', v)}
                />
            </section>

            {/* Task due */}
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CheckSquare size={18} className="text-emerald-500" />
                        <h2 className="font-semibold text-slate-900">Task due reminders</h2>
                    </div>
                    <ToggleSwitch checked={settings.taskDueEnabled} onChange={v => update('taskDueEnabled', v)} />
                </div>
                {settings.taskDueEnabled && (
                    <label className="flex items-center gap-3 text-sm text-slate-600">
                        Notify me
                        <input
                            type="number"
                            min={0}
                            max={240}
                            value={settings.taskDueAdvanceMinutes}
                            onChange={e => update('taskDueAdvanceMinutes', Number(e.target.value))}
                            className="w-20 px-2 py-1 border border-slate-200 rounded-lg"
                        />
                        minutes before the task's due time
                    </label>
                )}
            </section>

            {/* Calendar event */}
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Calendar size={18} className="text-rose-500" />
                        <h2 className="font-semibold text-slate-900">Calendar event reminders</h2>
                    </div>
                    <ToggleSwitch checked={settings.calendarEventEnabled} onChange={v => update('calendarEventEnabled', v)} />
                </div>
                {settings.calendarEventEnabled && (
                    <label className="flex items-center gap-3 text-sm text-slate-600">
                        Notify me
                        <input
                            type="number"
                            min={0}
                            max={240}
                            value={settings.calendarEventAdvanceMinutes}
                            onChange={e => update('calendarEventAdvanceMinutes', Number(e.target.value))}
                            className="w-20 px-2 py-1 border border-slate-200 rounded-lg"
                        />
                        minutes before an event starts
                    </label>
                )}
            </section>

            {/* Feedback + Save */}
            {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-2">
                    <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /> {error}
                </p>
            )}
            {success && (
                <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-start gap-2">
                    <Check size={16} className="flex-shrink-0 mt-0.5" /> {success}
                </p>
            )}

            <div className="sticky bottom-4 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 shadow-lg"
                >
                    {saving ? 'Saving…' : 'Save changes'}
                </button>
            </div>
        </div>
    );
};

const RoutineRow: React.FC<{
    icon: React.ReactNode;
    label: string;
    enabled: boolean;
    time: string;
    onToggle: (v: boolean) => void;
    onTimeChange: (v: string) => void;
}> = ({ icon, label, enabled, time, onToggle, onTimeChange }) => (
    <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm font-medium text-slate-800 flex-1">{label}</span>
        <input
            type="time"
            value={time}
            disabled={!enabled}
            onChange={e => onTimeChange(e.target.value)}
            className="px-2 py-1 text-sm border border-slate-200 rounded-lg disabled:opacity-40"
        />
        <ToggleSwitch checked={enabled} onChange={onToggle} />
    </div>
);

const ToggleSwitch: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
    <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-slate-300'}`}
        aria-pressed={checked}
    >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
);

export default NotificationsPage;
