/**
 * useNotifications Hook
 * React hook for managing push notifications
 */

import { useState, useEffect, useCallback } from 'react';
import {
    isPushSupported,
    getNotificationPermission,
    subscribeToPush,
    unsubscribeFromPush,
    getPushSubscription,
    getUpcomingNotifications,
} from '../services/notifications';
import type { ScheduledNotification } from '../services/notifications';

interface UseNotificationsResult {
    // Permission state
    permission: NotificationPermission;
    isSupported: boolean;
    isLoading: boolean;
    error: string | null;

    // Subscription state
    isSubscribed: boolean;
    subscription: PushSubscription | null;

    // Pending notifications
    pendingNotifications: ScheduledNotification[];

    // Actions
    subscribe: () => Promise<void>;
    unsubscribe: () => Promise<void>;
    refreshPending: () => Promise<void>;
}

export function useNotifications(userId: string | null): UseNotificationsResult {
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [isSupported] = useState(() => isPushSupported());
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [subscribed, setSubscribed] = useState(false);
    const [subscription, setSubscription] = useState<PushSubscription | null>(null);
    const [pendingNotifications, setPendingNotifications] = useState<ScheduledNotification[]>([]);

    // Initialize: check current permission and subscription status
    useEffect(() => {
        async function initialize() {
            if (!isSupported || !userId) {
                setIsLoading(false);
                return;
            }

            try {
                // Get current permission
                const currentPermission = getNotificationPermission();
                setPermission(currentPermission);

                // Check if already subscribed
                const currentSubscription = await getPushSubscription();
                setSubscription(currentSubscription);
                setSubscribed(currentSubscription !== null);

                // Load pending notifications
                if (currentPermission === 'granted') {
                    const pending = await getUpcomingNotifications(userId);
                    setPendingNotifications(pending);
                }
            } catch (err) {
                console.error('Failed to initialize notifications:', err);
                setError(err instanceof Error ? err.message : 'Initialization failed');
            } finally {
                setIsLoading(false);
            }
        }

        initialize();
    }, [isSupported, userId]);

    // Subscribe to push notifications
    const subscribe = useCallback(async () => {
        if (!userId) {
            setError('User not authenticated');
            return;
        }

        if (!isSupported) {
            setError('Push notifications not supported');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await subscribeToPush(userId);

            // Update state
            const newPermission = getNotificationPermission();
            setPermission(newPermission);

            const newSubscription = await getPushSubscription();
            setSubscription(newSubscription);
            setSubscribed(newSubscription !== null);

            // Load pending notifications
            const pending = await getUpcomingNotifications(userId);
            setPendingNotifications(pending);
        } catch (err) {
            console.error('Subscription failed:', err);
            setError(err instanceof Error ? err.message : 'Subscription failed');
        } finally {
            setIsLoading(false);
        }
    }, [userId, isSupported]);

    // Unsubscribe from push notifications
    const unsubscribe = useCallback(async () => {
        if (!userId) {
            setError('User not authenticated');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await unsubscribeFromPush(userId);

            // Update state
            setSubscription(null);
            setSubscribed(false);
            setPendingNotifications([]);
        } catch (err) {
            console.error('Unsubscribe failed:', err);
            setError(err instanceof Error ? err.message : 'Unsubscribe failed');
        } finally {
            setIsLoading(false);
        }
    }, [userId]);

    // Refresh pending notifications
    const refreshPending = useCallback(async () => {
        if (!userId) return;

        try {
            const pending = await getUpcomingNotifications(userId);
            setPendingNotifications(pending);
        } catch (err) {
            console.error('Failed to refresh pending notifications:', err);
        }
    }, [userId]);

    return {
        permission,
        isSupported,
        isLoading,
        error,
        isSubscribed: subscribed,
        subscription,
        pendingNotifications,
        subscribe,
        unsubscribe,
        refreshPending,
    };
}
