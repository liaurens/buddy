import React, { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { CalendarClock, RefreshCw, Trash2, X } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import {
    getPendingNotifications,
    updateNotificationStatus,
} from '../../../services/notifications/notification.service';
import type {
    ScheduledNotification,
    ToolCategory,
} from '../../../services/notifications/notification.types';

const CATEGORY_LABELS: Partial<Record<ToolCategory, string>> = {
    routine_morning: 'Morning',
    routine_midday: 'Midday',
    routine_night: 'Night',
    tasks: 'Task',
    calendar: 'Calendar',
    off_track: 'Off-track',
    protocol: 'Protocol',
    tracker: 'Tracker',
    checkin: 'Check-in',
};

const CATEGORY_STYLES: Partial<Record<ToolCategory, string>> = {
    routine_morning: 'bg-cove-tint-amber text-cove-streak-text',
    routine_midday: 'bg-cove-tint-blue text-cove-ink',
    routine_night: 'bg-cove-tint-blue text-cove-ink',
    tasks: 'bg-cove-tint-green text-cove-success-deep',
    calendar: 'bg-cove-tint-danger text-cove-danger-deep',
    off_track: 'bg-cove-tint-amber text-cove-streak-text',
};

/**
 * Transparency into the notification pipeline: everything queued to fire,
 * with per-item cancel and a clear-all. Routine anchors re-enqueue on save,
 * so cancelling one only silences its next occurrence.
 */
const NotificationQueueCard: React.FC = () => {
    const { user } = useAuth();
    const [pending, setPending] = useState<ScheduledNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        setError(null);
        try {
            setPending(await getPendingNotifications(user.id));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load queue');
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const cancelOne = async (id: string) => {
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
            const ok = await updateNotificationStatus(id, 'cancelled');
            if (!ok) throw new Error('Could not cancel this notification.');
            setPending((prev) => prev.filter((n) => n.id !== id));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Cancel failed');
        } finally {
            setBusy(false);
        }
    };

    const cancelAll = async () => {
        if (busy || pending.length === 0) return;
        if (
            !window.confirm(
                `Cancel all ${pending.length} queued notifications? Routine reminders come back when you save settings.`,
            )
        )
            return;
        setBusy(true);
        setError(null);
        try {
            const results = await Promise.all(
                pending.map((n) => updateNotificationStatus(n.id, 'cancelled')),
            );
            if (results.some((ok) => !ok)) {
                setError('Some notifications could not be cancelled.');
            }
            await refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Clear failed');
        } finally {
            setBusy(false);
        }
    };

    if (!user) return null;

    return (
        <section className="app-surface p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <CalendarClock size={18} className="text-cove-soft" />
                    <h2 className="font-semibold text-cove-ink">Upcoming notifications</h2>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => void refresh()}
                        disabled={loading || busy}
                        className="p-1.5 text-cove-faint hover:text-cove-muted hover:bg-[color:var(--buddy-surface-soft)] rounded-xl transition-colors disabled:opacity-40"
                        aria-label="Refresh queue"
                    >
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    </button>
                    {pending.length > 0 && (
                        <button
                            onClick={() => void cancelAll()}
                            disabled={busy}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-cove-danger-deep border border-cove-danger rounded-xl hover:bg-cove-tint-danger transition-colors disabled:opacity-40"
                        >
                            <Trash2 size={13} /> Cancel all
                        </button>
                    )}
                </div>
            </div>

            <p className="text-xs text-cove-soft">
                Everything queued to be pushed to your devices. Cancel anything you don't want.
            </p>

            {error && (
                <p className="text-sm text-cove-danger-deep bg-cove-tint-danger border border-cove-danger rounded-xl px-3 py-2">
                    {error}
                </p>
            )}

            {loading ? (
                <p className="text-sm text-cove-faint py-2">Loading queue…</p>
            ) : pending.length === 0 ? (
                <p className="text-sm text-cove-faint py-2">Nothing queued right now.</p>
            ) : (
                <ul className="divide-y divide-cove-border">
                    {pending.map((n) => (
                        <li key={n.id} className="flex items-center gap-3 py-2.5">
                            <span
                                className={`shrink-0 rounded-xl px-2 py-0.5 text-[11px] font-bold ${CATEGORY_STYLES[n.toolCategory] ?? 'bg-[color:var(--buddy-surface-soft)] text-cove-muted'}`}
                            >
                                {CATEGORY_LABELS[n.toolCategory] ?? n.toolCategory}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold text-cove-ink">
                                    {n.title}
                                </p>
                                <p className="truncate text-xs text-cove-soft">{n.body}</p>
                            </div>
                            <span className="shrink-0 text-xs text-cove-soft">
                                {format(new Date(n.scheduledFor), 'EEE MMM d, HH:mm')}
                            </span>
                            <button
                                onClick={() => void cancelOne(n.id)}
                                disabled={busy}
                                className="shrink-0 p-1.5 text-cove-faint hover:text-cove-danger hover:bg-cove-tint-danger rounded-full transition-colors disabled:opacity-40"
                                aria-label={`Cancel "${n.title}"`}
                            >
                                <X size={14} />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
};

export default NotificationQueueCard;
