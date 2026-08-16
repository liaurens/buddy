/**
 * Notification Permission Prompt
 * Component for requesting push notification permissions
 */

import React from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';

interface NotificationPermissionPromptProps {
    userId: string;
    onClose?: () => void;
    showCloseButton?: boolean;
}

const NotificationPermissionPrompt: React.FC<NotificationPermissionPromptProps> = ({
    userId,
    onClose,
    showCloseButton = true,
}) => {
    const { permission, isSupported, isLoading, error, isSubscribed, subscribe, unsubscribe } =
        useNotifications(userId);

    // Don't show if notifications not supported
    if (!isSupported) {
        return null;
    }

    // Don't show if already granted and subscribed
    if (permission === 'granted' && isSubscribed) {
        return null;
    }

    const handleEnable = async () => {
        await subscribe();
        if (onClose) {
            setTimeout(onClose, 1000); // Close after brief delay on success
        }
    };

    const handleDisable = async () => {
        await unsubscribe();
        if (onClose) {
            onClose();
        }
    };

    return (
        <div className="app-tint-blue shadow-cove">
            <div className="flex items-start justify-between gap-3">
                <div className="flex flex-1 items-start gap-3">
                    <div className="mt-0.5">
                        <Bell size={22} className="text-cove-accent" />
                    </div>
                    <div className="flex-1">
                        <h3 className="mb-1 text-[15px] font-extrabold text-cove-ink">
                            {permission === 'denied'
                                ? 'Notifications blocked'
                                : 'Enable notifications'}
                        </h3>
                        <p className="mb-3 text-[13px] font-semibold leading-relaxed text-cove-muted">
                            {permission === 'denied' ? (
                                <>
                                    You've blocked notifications. To enable them, please update your
                                    browser settings.
                                </>
                            ) : isSubscribed ? (
                                <>
                                    You're currently subscribed to notifications. You can
                                    unsubscribe at any time.
                                </>
                            ) : (
                                <>
                                    Get reminders for trackers, protocols, tasks, and more. Stay on
                                    top of your health and productivity goals.
                                </>
                            )}
                        </p>

                        {error && (
                            <div className="mb-3 rounded-xl bg-cove-tint-danger px-3 py-2 text-[12.5px] font-semibold leading-snug text-cove-danger-deep">
                                <strong className="font-extrabold">Error:</strong> {error}
                                {error.includes('VAPID') && (
                                    <div className="mt-2 text-[11.5px] opacity-90">
                                        💡 The VAPID key needs to be configured in your hosting
                                        environment (Netlify/Vercel).
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex gap-2">
                            {permission !== 'denied' && !isSubscribed && (
                                <button
                                    onClick={handleEnable}
                                    disabled={isLoading}
                                    className="app-primary-button"
                                >
                                    {isLoading ? (
                                        'Enabling…'
                                    ) : (
                                        <>
                                            <Bell size={16} />
                                            Enable notifications
                                        </>
                                    )}
                                </button>
                            )}

                            {isSubscribed && (
                                <button
                                    onClick={handleDisable}
                                    disabled={isLoading}
                                    className="app-secondary-button"
                                >
                                    {isLoading ? (
                                        'Disabling…'
                                    ) : (
                                        <>
                                            <BellOff size={16} />
                                            Disable notifications
                                        </>
                                    )}
                                </button>
                            )}

                            {permission === 'denied' && (
                                <button
                                    onClick={() => {
                                        // Open browser settings (this is browser-specific)
                                        alert(
                                            'To enable notifications:\n\n1. Click the lock icon in your address bar\n2. Find "Notifications" in the permissions list\n3. Change it to "Allow"',
                                        );
                                    }}
                                    className="app-primary-button"
                                >
                                    How to enable
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {showCloseButton && onClose && (
                    <button
                        onClick={onClose}
                        className="text-cove-soft transition-colors hover:text-cove-ink"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default NotificationPermissionPrompt;
