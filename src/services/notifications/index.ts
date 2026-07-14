/**
 * Notification System
 * Unified export for all notification services
 */

// Core database operations
export {
    saveNotificationSubscription,
    getUserSubscriptions,
    removeNotificationSubscription,
    scheduleNotification,
    getPendingNotifications,
    updateNotificationStatus,
    cancelToolNotifications,
    logNotification,
    getNotificationLogs,
} from './notification.service';

// Web Push API (browser-side)
export {
    isPushSupported,
    getNotificationPermission,
    requestNotificationPermission,
    subscribeToPush,
    unsubscribeFromPush,
    getPushSubscription,
    isSubscribed,
    showLocalNotification,
    detectDeviceType,
} from './push.service';

// Scheduling helpers
export {
    scheduleNotificationAt,
    scheduleDailyNotification,
    scheduleNotificationIn,
    cancelNotifications,
    getUpcomingNotifications,
    getToolNotifications,
    rescheduleRecurringNotification,
    scheduleTrackerReminder,
    scheduleProtocolDose,
    scheduleCheckInReminder,
    scheduleTaskDue,
    schedulePomodoroComplete,
    scheduleCalendarEvent,
} from './scheduler.service';

// Types
export type {
    ToolCategory,
    NotificationType,
    NotificationStatus,
    DeviceType,
    LogStatus,
    NotificationSubscription,
    ScheduledNotification,
    NotificationLog,
    PushSubscriptionJSON,
    NotificationPayload,
    NotificationAction,
    ServiceWorkerNotificationOptions,
    ScheduleNotificationRequest,
    NotificationPreferences,
} from './notification.types';

export {
    NotificationError,
    PermissionDeniedError,
    SubscriptionFailedError,
    SendNotificationError,
} from './notification.types';
