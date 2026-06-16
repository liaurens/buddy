/**
 * Notifications Settings Page
 *
 * Enables push, manages the morning/midday/night routine reminder times and
 * weekdays, task/calendar reminder tuning (advance + cadence), off-track
 * nudges, quiet hours, rate limit, and a live view of the scheduled queue.
 * Persists to settings category `notifications` and reschedules
 * `scheduled_notifications` rows on save.
 */

import React, { useEffect, useState } from 'react';
import { Bell, Check, AlertCircle, Sun, CloudSun, Moon, CheckSquare, Calendar, Smartphone, AlertTriangle, MoonStar, Share, Eye } from 'lucide-react';
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
import PushHealthCard from '../components/PushHealthCard';
import NotificationQueueCard from '../components/NotificationQueueCard';
import DayOfWeekPicker from '../components/DayOfWeekPicker';

const CADENCE_OPTIONS: Array<{ value: NotificationsSettings['taskReminderCadence']; label: string; hint: string }> = [
    { value: 'single', label: 'Single', hint: 'One reminder before the due time. Quietest.' },
    { value: 'smart', label: 'Smart', hint: 'Before, at due time, then 15 min and 1 h overdue.' },
    { value: 'aggressive', label: 'Persistent', hint: 'Before, at due time, then 15/30/60/120 min overdue. Hardest to ignore.' },
];

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

    // iOS-specific install hint: only show if user is on iOS Safari and app is not installed.
    const isIOSStandalone = typeof navigator !== 'undefined' && (
        // @ts-expect-error iOS-only Safari property
        navigator.standalone === true
        || (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches)
    );
    const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const showIOSInstallHint = isIOS && !isIOSStandalone;

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

    const handlePreview = async (title: string, body: string) => {
        setError(null);
        try {
            await showLocalNotification(title, body, {});
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Preview failed — is push enabled?');
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
        <div className="app-page-readable">
            <header className="hidden pt-2 lg:block">
                <h1 className="app-title flex items-center gap-2">
                    <Bell size={24} className="text-indigo-600" /> Notifications
                </h1>
                <p className="app-subtitle">Tune when, how often, and on which days you get nudged.</p>
            </header>

            {/* iOS install hint (shown when not running as installed PWA) */}
            {showIOSInstallHint && (
                <section className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm">
                        <Share size={16} /> Install on your iPhone for push
                    </div>
                    <p className="text-xs text-amber-800 leading-relaxed">
                        iOS only allows push notifications when the app is added to your Home Screen.
                        Tap the <span className="font-semibold">Share</span> icon in Safari, then
                        choose <span className="font-semibold">"Add to Home Screen"</span>. Open the app from the new icon and come back here to enable push.
                    </p>
                </section>
            )}

            {/* Push status */}
            <section className="app-surface p-5 space-y-3">
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
                            <button
                                onClick={() => handlePreview('Test notification', 'If you see this, local notifications work.')}
                                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
                            >
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
                        <button onClick={handleEnablePush} className="px-4 py-2 app-primary-button">
                            Enable push
                        </button>
                    </div>
                )}
            </section>

            {/* Subscription health — catches silently dropped subscriptions */}
            <PushHealthCard />

            {/* Routine reminders */}
            <section className="app-surface p-5 space-y-5">
                <div>
                    <h2 className="font-semibold text-slate-900">Daily routine reminders</h2>
                    <p className="mt-0.5 text-xs text-slate-500">Pick a time and the days each anchor should fire.</p>
                </div>

                <RoutineRow
                    icon={<Sun size={18} className="text-amber-500" />}
                    label="Morning"
                    enabled={settings.morningEnabled}
                    time={settings.morningTime}
                    days={settings.morningDays}
                    onToggle={v => update('morningEnabled', v)}
                    onTimeChange={v => update('morningTime', v)}
                    onDaysChange={v => update('morningDays', v)}
                    onPreview={() => handlePreview('Morning routine', 'Plan today — open to see what\'s due.')}
                />
                <RoutineRow
                    icon={<CloudSun size={18} className="text-sky-500" />}
                    label="Midday"
                    enabled={settings.middayEnabled}
                    time={settings.middayTime}
                    days={settings.middayDays}
                    onToggle={v => update('middayEnabled', v)}
                    onTimeChange={v => update('middayTime', v)}
                    onDaysChange={v => update('middayDays', v)}
                    onPreview={() => handlePreview('Midday replan', 'Check in and adjust your afternoon blocks.')}
                />
                <RoutineRow
                    icon={<Moon size={18} className="text-indigo-500" />}
                    label="Night"
                    enabled={settings.nightEnabled}
                    time={settings.nightTime}
                    days={settings.nightDays}
                    onToggle={v => update('nightEnabled', v)}
                    onTimeChange={v => update('nightTime', v)}
                    onDaysChange={v => update('nightDays', v)}
                    onPreview={() => handlePreview('Night reflection', "Close the day — 90 seconds: wins, blocker, tomorrow's one thing.")}
                />
            </section>

            {/* Task reminders */}
            <section className="app-surface p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CheckSquare size={18} className="text-emerald-500" />
                        <h2 className="font-semibold text-slate-900">Task reminders</h2>
                    </div>
                    <ToggleSwitch checked={settings.taskDueEnabled} onChange={v => update('taskDueEnabled', v)} />
                </div>
                {settings.taskDueEnabled && (
                    <>
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

                        <div className="space-y-2">
                            <p className="text-sm font-medium text-slate-700">Default reminder style</p>
                            <p className="text-xs text-slate-500">
                                Used for tasks without their own reminder setting. Change it per task in the task editor.
                            </p>
                            <div className="space-y-2 pt-1">
                                {CADENCE_OPTIONS.map(opt => (
                                    <label key={opt.value} className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="taskReminderCadence"
                                            checked={settings.taskReminderCadence === opt.value}
                                            onChange={() => update('taskReminderCadence', opt.value)}
                                            className="mt-0.5 w-4 h-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-sm">
                                            <span className="font-medium text-slate-800">{opt.label}</span>
                                            <span className="block text-xs text-slate-500">{opt.hint}</span>
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </section>

            {/* Calendar event */}
            <section className="app-surface p-5 space-y-3">
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

            {/* Off-track escalation */}
            <section className="app-surface p-5 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={18} className="text-orange-500" />
                        <h2 className="font-semibold text-slate-900">Off-track nudges</h2>
                    </div>
                    <ToggleSwitch checked={settings.offTrackEnabled} onChange={v => update('offTrackEnabled', v)} />
                </div>
                <p className="text-xs text-slate-500">Get a reminder when you fall behind on what matters.</p>
                {settings.offTrackEnabled && (
                    <div className="space-y-2 pt-1">
                        <CheckRow
                            label="Overdue high-priority tasks"
                            checked={settings.offTrackOverdueTasks}
                            onChange={v => update('offTrackOverdueTasks', v)}
                        />
                        <CheckRow
                            label="Missed morning / midday / night routine"
                            checked={settings.offTrackMissedRoutines}
                            onChange={v => update('offTrackMissedRoutines', v)}
                        />
                        <CheckRow
                            label="No tracker check-in by evening"
                            checked={settings.offTrackSkippedCheckin}
                            onChange={v => update('offTrackSkippedCheckin', v)}
                        />
                        <CheckRow
                            label="Haven't opened the app for hours during the day"
                            checked={settings.offTrackIdle}
                            onChange={v => update('offTrackIdle', v)}
                        />
                    </div>
                )}
            </section>

            {/* Quiet hours + rate limit */}
            <section className="app-surface p-5 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <MoonStar size={18} className="text-indigo-500" />
                        <h2 className="font-semibold text-slate-900">Quiet hours & rate limit</h2>
                    </div>
                    <ToggleSwitch checked={settings.quietHoursEnabled} onChange={v => update('quietHoursEnabled', v)} />
                </div>
                <p className="text-xs text-slate-500">
                    While quiet hours are on, every push is held until the window ends — nothing wakes you up.
                </p>
                {settings.quietHoursEnabled && (
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                        Quiet from
                        <input
                            type="time"
                            value={settings.quietHoursStart}
                            onChange={e => update('quietHoursStart', e.target.value)}
                            className="px-2 py-1 border border-slate-200 rounded-lg"
                        />
                        to
                        <input
                            type="time"
                            value={settings.quietHoursEnd}
                            onChange={e => update('quietHoursEnd', e.target.value)}
                            className="px-2 py-1 border border-slate-200 rounded-lg"
                        />
                    </div>
                )}
                <label className="flex items-center gap-3 text-sm text-slate-600">
                    Max
                    <input
                        type="number"
                        min={1}
                        max={20}
                        value={settings.maxRemindersPerHour}
                        onChange={e => update('maxRemindersPerHour', Number(e.target.value))}
                        className="w-20 px-2 py-1 border border-slate-200 rounded-lg"
                    />
                    reminders per hour (routine anchors are always allowed)
                </label>
            </section>

            {/* Scheduled queue */}
            <NotificationQueueCard />

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
                    className="app-primary-button px-5 py-2.5"
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
    days: number[];
    onToggle: (v: boolean) => void;
    onTimeChange: (v: string) => void;
    onDaysChange: (v: number[]) => void;
    onPreview: () => void;
}> = ({ icon, label, enabled, time, days, onToggle, onTimeChange, onDaysChange, onPreview }) => (
    <div className="space-y-2">
        <div className="flex items-center gap-3">
            {icon}
            <span className="text-sm font-medium text-slate-800 flex-1">{label}</span>
            <button
                type="button"
                onClick={onPreview}
                disabled={!enabled}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30"
                aria-label={`Preview ${label} notification`}
                title="Preview this notification"
            >
                <Eye size={15} />
            </button>
            <input
                type="time"
                value={time}
                disabled={!enabled}
                onChange={e => onTimeChange(e.target.value)}
                className="px-2 py-1 text-sm border border-slate-200 rounded-lg disabled:opacity-40"
            />
            <ToggleSwitch checked={enabled} onChange={onToggle} />
        </div>
        {enabled && (
            <div className="pl-8">
                <DayOfWeekPicker value={days} onChange={onDaysChange} />
            </div>
        )}
    </div>
);

const CheckRow: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => (
    <label className="flex items-center gap-3 text-sm text-slate-700 cursor-pointer">
        <input
            type="checkbox"
            checked={checked}
            onChange={e => onChange(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
        {label}
    </label>
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
