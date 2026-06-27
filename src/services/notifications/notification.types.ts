/**
 * Notification System Types
 * TypeScript interfaces for cross-platform push notifications
 */

export type ToolCategory =
  | 'tracker'
  | 'protocol'
  | 'checkin'
  | 'experiment'
  | 'tasks'
  | 'notes'
  | 'calendar'
  | 'planning'
  | 'reflection'
  | 'pomodoro'
  | 'toolbox'
  | 'routine_morning'
  | 'routine_midday'
  | 'routine_night'
  | 'off_track';

export type NotificationType =
  | 'tracker_reminder'
  | 'protocol_dose'
  | 'checkin_daily'
  | 'task_due'
  | 'pomodoro_complete'
  | 'experiment_complete'
  | 'calendar_event'
  | 'routine_reminder'
  | 'task_reminder'
  | 'task_overdue'
  | 'off_track_routine'
  | 'off_track_checkin'
  | 'off_track_idle'
  | 'custom';

export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'cancelled';

export type DeviceType = 'ios' | 'android' | 'windows' | 'mac' | 'other';

export type LogStatus = 'sent' | 'failed' | 'clicked' | 'dismissed';

// Database types
export interface NotificationSubscription {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  deviceType: DeviceType | null;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string;
}

export interface ScheduledNotification {
  id: string;
  userId: string;
  toolCategory: ToolCategory;
  notificationType: NotificationType;
  scheduledFor: string; // ISO timestamp
  title: string;
  body: string;
  data: Record<string, unknown>;
  status: NotificationStatus;
  createdAt: string;
  sentAt: string | null;
  errorMessage: string | null;
}

export interface NotificationLog {
  id: string;
  subscriptionId: string | null;
  scheduledNotificationId: string | null;
  userId: string;
  status: LogStatus;
  errorMessage: string | null;
  createdAt: string;
}

// Web Push subscription object (from browser)
export interface PushSubscriptionJSON {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// Notification payload
export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: NotificationAction[];
  requireInteraction?: boolean;
  silent?: boolean;
  timestamp?: number;
}

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

// Service worker notification options
export interface ServiceWorkerNotificationOptions {
  title: string;
  options: {
    body: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: Record<string, unknown>;
    actions?: NotificationAction[];
    requireInteraction?: boolean;
    silent?: boolean;
    timestamp?: number;
    vibrate?: number[];
  };
}

// Notification scheduling request
export interface ScheduleNotificationRequest {
  userId: string;
  toolCategory: ToolCategory;
  notificationType: NotificationType;
  scheduledFor: Date;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sourceType?: string;
  sourceId?: string;
  dedupKey?: string;
}

// Notification preferences (loaded from settings)
export interface NotificationPreferences {
  tracker: {
    enabled: boolean;
    reminderTime: string; // HH:MM format
  };
  protocol: {
    enabled: boolean;
    advanceMinutes: number;
    sound: boolean;
  };
  checkin: {
    enabled: boolean;
    reminderTime: string;
  };
  tasks: {
    enabled: boolean;
    timing: 'atDue' | '15min' | '1hour' | '1day';
  };
  pomodoro: {
    sound: boolean;
  };
}

// Error types
export class NotificationError extends Error {
  code: string;
  details?: unknown;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.name = 'NotificationError';
    this.code = code;
    this.details = details;
  }
}

export class PermissionDeniedError extends NotificationError {
  constructor() {
    super('Notification permission denied', 'PERMISSION_DENIED');
  }
}

export class SubscriptionFailedError extends NotificationError {
  constructor(details?: unknown) {
    super('Failed to create push subscription', 'SUBSCRIPTION_FAILED', details);
  }
}

export class SendNotificationError extends NotificationError {
  constructor(message: string, details?: unknown) {
    super(message, 'SEND_FAILED', details);
  }
}
