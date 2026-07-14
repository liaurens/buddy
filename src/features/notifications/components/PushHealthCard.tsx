/**
 * Push subscription health check.
 *
 * iOS can silently drop Web Push subscriptions, leaving the user convinced
 * notifications are on while nothing ever arrives. This card cross-checks the
 * browser's live subscription against the rows in `notification_subscriptions`
 * and makes a dead subscription visible — with a one-tap repair.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Activity, AlertTriangle, Check, RefreshCw } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import {
    isPushSupported,
    getNotificationPermission,
    getPushSubscription,
    subscribeToPush,
} from '../../../services/notifications/push.service';
import { getUserSubscriptions } from '../../../services/notifications/notification.service';

type HealthStatus =
    | 'checking'
    | 'unsupported'
    | 'permission_denied'
    | 'not_subscribed'
    | 'dead' // browser has a subscription, but the server doesn't know it
    | 'healthy';

interface HealthState {
    status: HealthStatus;
    deviceCount: number;
    lastUsedAt: string | null;
}

const PushHealthCard: React.FC = () => {
    const { user } = useAuth();
    const [health, setHealth] = useState<HealthState>({
        status: 'checking',
        deviceCount: 0,
        lastUsedAt: null,
    });
    const [repairing, setRepairing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const check = useCallback(async () => {
        if (!user?.id) return;
        setError(null);

        if (!isPushSupported()) {
            setHealth({ status: 'unsupported', deviceCount: 0, lastUsedAt: null });
            return;
        }
        if (getNotificationPermission() === 'denied') {
            setHealth({ status: 'permission_denied', deviceCount: 0, lastUsedAt: null });
            return;
        }

        try {
            const [localSub, dbSubs] = await Promise.all([
                getPushSubscription(),
                getUserSubscriptions(user.id),
            ]);

            if (!localSub) {
                setHealth({
                    status: 'not_subscribed',
                    deviceCount: dbSubs.length,
                    lastUsedAt: null,
                });
                return;
            }

            const match = dbSubs.find((s) => s.endpoint === localSub.endpoint);
            setHealth({
                status: match ? 'healthy' : 'dead',
                deviceCount: dbSubs.length,
                lastUsedAt: match?.lastUsedAt ?? null,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Health check failed');
        }
    }, [user?.id]);

    useEffect(() => {
        check();
    }, [check]);

    const handleRepair = async () => {
        if (!user?.id || repairing) return;
        setRepairing(true);
        setError(null);
        try {
            await subscribeToPush(user.id);
            await check();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Repair failed');
        } finally {
            setRepairing(false);
        }
    };

    if (!user) return null;

    return (
        <section className="app-surface p-5 space-y-3">
            <div className="flex items-center gap-2">
                <Activity size={18} className="text-slate-500" />
                <h2 className="font-semibold text-slate-900">Push health check</h2>
                <button
                    onClick={check}
                    className="ml-auto p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                    aria-label="Re-run health check"
                >
                    <RefreshCw size={14} />
                </button>
            </div>

            {health.status === 'checking' && <p className="text-sm text-slate-500">Checking…</p>}

            {health.status === 'unsupported' && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Push is not supported here. On iPhone, install the app to your home screen
                    first.
                </p>
            )}

            {health.status === 'permission_denied' && (
                <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 flex items-start gap-2">
                    <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                    Notification permission is blocked for this app. Re-enable it in your device
                    settings, then re-run this check.
                </p>
            )}

            {health.status === 'not_subscribed' && (
                <p className="text-sm text-slate-600">
                    This device is not subscribed to push.
                    {health.deviceCount > 0 &&
                        ` ${health.deviceCount} other device${health.deviceCount === 1 ? ' is' : 's are'} subscribed.`}
                </p>
            )}

            {health.status === 'dead' && (
                <div className="space-y-2">
                    <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 flex items-start gap-2">
                        <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                        This device thinks it's subscribed, but the server doesn't know about it —
                        notifications are silently going nowhere.
                    </p>
                    <button
                        onClick={handleRepair}
                        disabled={repairing}
                        className="px-4 py-2 app-primary-button text-sm"
                    >
                        {repairing ? 'Repairing…' : 'Repair subscription'}
                    </button>
                </div>
            )}

            {health.status === 'healthy' && (
                <p className="text-sm text-emerald-700 flex items-center gap-2">
                    <Check size={16} />
                    Push is healthy on this device
                    {health.lastUsedAt &&
                        ` — last delivery attempt ${formatDistanceToNow(new Date(health.lastUsedAt), { addSuffix: true })}`}
                    {health.deviceCount > 1 && ` (${health.deviceCount} devices total)`}.
                </p>
            )}

            {error && <p className="text-xs text-rose-600">{error}</p>}
        </section>
    );
};

export default PushHealthCard;
