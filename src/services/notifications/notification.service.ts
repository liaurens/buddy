/**
 * Notification Service
 * Core database operations for notification management
 */

import { supabase } from '../supabase';
import type {
  NotificationSubscription,
  ScheduledNotification,
  NotificationLog,
  ScheduleNotificationRequest,
  PushSubscriptionJSON,
  DeviceType,
  NotificationStatus,
  LogStatus,
} from './notification.types';

/**
 * Subscribe user device to push notifications
 */
export async function saveNotificationSubscription(
  userId: string,
  subscription: PushSubscriptionJSON,
  deviceType: DeviceType,
  userAgent: string
): Promise<NotificationSubscription | null> {
  const { data, error } = await supabase
    .from('notification_subscriptions')
    .upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        device_type: deviceType,
        user_agent: userAgent,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,endpoint' }
    )
    .select()
    .single();

  if (error) {
    console.error('Failed to save notification subscription:', error);
    return null;
  }

  return dbToNotificationSubscription(data);
}

/**
 * Get all active subscriptions for a user
 */
export async function getUserSubscriptions(
  userId: string
): Promise<NotificationSubscription[]> {
  const { data, error } = await supabase
    .from('notification_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('last_used_at', { ascending: false });

  if (error) {
    console.error('Failed to get user subscriptions:', error);
    return [];
  }

  return (data || []).map(dbToNotificationSubscription);
}

/**
 * Remove a notification subscription
 */
export async function removeNotificationSubscription(
  userId: string,
  endpoint: string
): Promise<boolean> {
  const { error } = await supabase
    .from('notification_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', endpoint);

  if (error) {
    console.error('Failed to remove subscription:', error);
    return false;
  }

  return true;
}

/**
 * Schedule a notification
 */
export async function scheduleNotification(
  request: ScheduleNotificationRequest
): Promise<ScheduledNotification | null> {
  const { data, error } = await supabase
    .from('scheduled_notifications')
    .insert({
      user_id: request.userId,
      tool_category: request.toolCategory,
      notification_type: request.notificationType,
      scheduled_for: request.scheduledFor.toISOString(),
      title: request.title,
      body: request.body,
      data: request.data || {},
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to schedule notification:', error);
    return null;
  }

  return dbToScheduledNotification(data);
}

/**
 * Get pending notifications for a user
 */
export async function getPendingNotifications(
  userId: string
): Promise<ScheduledNotification[]> {
  const { data, error } = await supabase
    .from('scheduled_notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('scheduled_for', { ascending: true });

  if (error) {
    console.error('Failed to get pending notifications:', error);
    return [];
  }

  return (data || []).map(dbToScheduledNotification);
}

/**
 * Update notification status
 */
export async function updateNotificationStatus(
  notificationId: string,
  status: NotificationStatus,
  errorMessage?: string
): Promise<boolean> {
  const update: any = {
    status,
    sent_at: status === 'sent' ? new Date().toISOString() : null,
  };

  if (errorMessage) {
    update.error_message = errorMessage;
  }

  const { error } = await supabase
    .from('scheduled_notifications')
    .update(update)
    .eq('id', notificationId);

  if (error) {
    console.error('Failed to update notification status:', error);
    return false;
  }

  return true;
}

/**
 * Cancel scheduled notifications for a tool
 */
export async function cancelToolNotifications(
  userId: string,
  toolCategory: string
): Promise<boolean> {
  const { error } = await supabase
    .from('scheduled_notifications')
    .update({ status: 'cancelled' })
    .eq('user_id', userId)
    .eq('tool_category', toolCategory)
    .eq('status', 'pending');

  if (error) {
    console.error('Failed to cancel notifications:', error);
    return false;
  }

  return true;
}

/**
 * Log notification delivery
 */
export async function logNotification(
  userId: string,
  subscriptionId: string | null,
  scheduledNotificationId: string | null,
  status: LogStatus,
  errorMessage?: string
): Promise<boolean> {
  const { error } = await supabase.from('notification_logs').insert({
    user_id: userId,
    subscription_id: subscriptionId,
    scheduled_notification_id: scheduledNotificationId,
    status,
    error_message: errorMessage || null,
  });

  if (error) {
    console.error('Failed to log notification:', error);
    return false;
  }

  return true;
}

/**
 * Get notification logs for user
 */
export async function getNotificationLogs(
  userId: string,
  limit: number = 50
): Promise<NotificationLog[]> {
  const { data, error } = await supabase
    .from('notification_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to get notification logs:', error);
    return [];
  }

  return (data || []).map(dbToNotificationLog);
}

// Database converters
function dbToNotificationSubscription(db: any): NotificationSubscription {
  return {
    id: db.id,
    userId: db.user_id,
    endpoint: db.endpoint,
    p256dh: db.p256dh,
    auth: db.auth,
    deviceType: db.device_type,
    userAgent: db.user_agent,
    createdAt: db.created_at,
    lastUsedAt: db.last_used_at,
  };
}

function dbToScheduledNotification(db: any): ScheduledNotification {
  return {
    id: db.id,
    userId: db.user_id,
    toolCategory: db.tool_category,
    notificationType: db.notification_type,
    scheduledFor: db.scheduled_for,
    title: db.title,
    body: db.body,
    data: db.data || {},
    status: db.status,
    createdAt: db.created_at,
    sentAt: db.sent_at,
    errorMessage: db.error_message,
  };
}

function dbToNotificationLog(db: any): NotificationLog {
  return {
    id: db.id,
    subscriptionId: db.subscription_id,
    scheduledNotificationId: db.scheduled_notification_id,
    userId: db.user_id,
    status: db.status,
    errorMessage: db.error_message,
    createdAt: db.created_at,
  };
}
