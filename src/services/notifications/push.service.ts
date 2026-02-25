/**
 * Web Push Service
 * Browser-side push notification handling using Web Push API
 */

import { saveNotificationSubscription, removeNotificationSubscription } from './notification.service';
import type { PushSubscriptionJSON, DeviceType } from './notification.types';
import { PermissionDeniedError, SubscriptionFailedError } from './notification.types';

// VAPID public key - must match the private key in Edge Functions
// TODO: Replace with your actual VAPID public key
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

/**
 * Check if push notifications are supported in this browser
 */
export function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) {
    throw new PermissionDeniedError();
  }

  const permission = await Notification.requestPermission();

  if (permission !== 'granted') {
    throw new PermissionDeniedError();
  }

  return permission;
}

/**
 * Detect device type from user agent
 */
export function detectDeviceType(): DeviceType {
  const ua = navigator.userAgent.toLowerCase();

  if (/iphone|ipad|ipod/.test(ua)) {
    return 'ios';
  }
  if (/android/.test(ua)) {
    return 'android';
  }
  if (/windows/.test(ua)) {
    return 'windows';
  }
  if (/macintosh|mac os x/.test(ua)) {
    return 'mac';
  }

  return 'other';
}

/**
 * Convert base64 VAPID key to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Convert browser PushSubscription to JSON format
 */
function subscriptionToJSON(subscription: PushSubscription): PushSubscriptionJSON {
  const key = subscription.getKey('p256dh');
  const auth = subscription.getKey('auth');

  if (!key || !auth) {
    throw new SubscriptionFailedError('Missing encryption keys');
  }

  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: btoa(String.fromCharCode(...new Uint8Array(key))),
      auth: btoa(String.fromCharCode(...new Uint8Array(auth))),
    },
  };
}

/**
 * Subscribe user to push notifications
 */
export async function subscribeToPush(userId: string): Promise<PushSubscriptionJSON> {
  // Check support
  if (!isPushSupported()) {
    throw new SubscriptionFailedError('Push notifications not supported');
  }

  // Check VAPID key
  if (!VAPID_PUBLIC_KEY) {
    console.error('VAPID_PUBLIC_KEY is missing. Check your .env file.');
    throw new SubscriptionFailedError('VAPID public key not configured. Please contact support.');
  }

  // Request permission
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    throw new PermissionDeniedError();
  }

  try {
    // Register service worker if not already registered
    let registration = await navigator.serviceWorker.getRegistration();

    if (!registration) {
      registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
    }

    // Create push subscription
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });

    // Convert to JSON format
    const subscriptionJSON = subscriptionToJSON(subscription);

    // Save to database
    const deviceType = detectDeviceType();
    const userAgent = navigator.userAgent;

    const saved = await saveNotificationSubscription(
      userId,
      subscriptionJSON,
      deviceType,
      userAgent
    );

    if (!saved) {
      throw new SubscriptionFailedError('Failed to save subscription');
    }

    return subscriptionJSON;
  } catch (error) {
    console.error('Push subscription failed:', error);

    // Provide specific error messages
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError') {
        throw new PermissionDeniedError();
      }
      if (error.name === 'NotSupportedError') {
        throw new SubscriptionFailedError('Push notifications not supported on this device');
      }
    }

    // Re-throw with original message if available
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new SubscriptionFailedError(`Failed to create push subscription: ${errorMessage}`);
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(
  userId: string,
  endpoint?: string
): Promise<boolean> {
  try {
    // Get service worker registration
    const registration = await navigator.serviceWorker.getRegistration();

    if (registration) {
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const subscriptionJSON = subscriptionToJSON(subscription);
        const targetEndpoint = endpoint || subscriptionJSON.endpoint;

        // Unsubscribe from browser
        await subscription.unsubscribe();

        // Remove from database
        await removeNotificationSubscription(userId, targetEndpoint);
      }
    }

    return true;
  } catch (error) {
    console.error('Unsubscribe failed:', error);
    return false;
  }
}

/**
 * Get current push subscription status
 */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();

    if (!registration) {
      return null;
    }

    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.error('Failed to get subscription:', error);
    return null;
  }
}

/**
 * Check if user is currently subscribed to push
 */
export async function isSubscribed(): Promise<boolean> {
  const subscription = await getPushSubscription();
  return subscription !== null;
}

/**
 * Show a local notification (for testing)
 */
export async function showLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  if (!isPushSupported()) {
    throw new Error('Notifications not supported');
  }

  const permission = getNotificationPermission();
  if (permission !== 'granted') {
    throw new PermissionDeniedError();
  }

  const registration = await navigator.serviceWorker.getRegistration();

  if (!registration) {
    throw new Error('Service worker not registered');
  }

  await registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-badge.png',
    data,
    tag: 'buddy-notification',
  });
}
