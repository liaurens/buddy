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
  const {
    permission,
    isSupported,
    isLoading,
    error,
    isSubscribed,
    subscribe,
    unsubscribe,
  } = useNotifications(userId);

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
    <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg p-4 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="mt-1">
            <Bell size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-1">
              {permission === 'denied'
                ? 'Notifications Blocked'
                : 'Enable Notifications'}
            </h3>
            <p className="text-sm text-white/90 mb-3">
              {permission === 'denied' ? (
                <>
                  You've blocked notifications. To enable them, please update your
                  browser settings.
                </>
              ) : isSubscribed ? (
                <>
                  You're currently subscribed to notifications. You can unsubscribe
                  at any time.
                </>
              ) : (
                <>
                  Get reminders for trackers, protocols, tasks, and more. Stay on
                  top of your health and productivity goals.
                </>
              )}
            </p>

            {error && (
              <div className="bg-white/20 text-white text-sm rounded px-3 py-2 mb-3">
                <strong>Error:</strong> {error}
                {error.includes('VAPID') && (
                  <div className="mt-2 text-xs opacity-90">
                    💡 The VAPID key needs to be configured in your hosting environment (Netlify/Vercel).
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              {permission !== 'denied' && !isSubscribed && (
                <button
                  onClick={handleEnable}
                  disabled={isLoading}
                  className="px-4 py-2 bg-white text-indigo-600 font-medium rounded-lg hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    'Enabling...'
                  ) : (
                    <>
                      <Bell size={16} className="inline mr-2" />
                      Enable Notifications
                    </>
                  )}
                </button>
              )}

              {isSubscribed && (
                <button
                  onClick={handleDisable}
                  disabled={isLoading}
                  className="px-4 py-2 bg-white/20 text-white font-medium rounded-lg hover:bg-white/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    'Disabling...'
                  ) : (
                    <>
                      <BellOff size={16} className="inline mr-2" />
                      Disable Notifications
                    </>
                  )}
                </button>
              )}

              {permission === 'denied' && (
                <button
                  onClick={() => {
                    // Open browser settings (this is browser-specific)
                    alert(
                      'To enable notifications:\n\n1. Click the lock icon in your address bar\n2. Find "Notifications" in the permissions list\n3. Change it to "Allow"'
                    );
                  }}
                  className="px-4 py-2 bg-white text-indigo-600 font-medium rounded-lg hover:bg-white/90 transition-colors"
                >
                  How to Enable
                </button>
              )}
            </div>
          </div>
        </div>

        {showCloseButton && onClose && (
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
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
