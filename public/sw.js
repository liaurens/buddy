/* eslint-disable no-undef */
/**
 * Service Worker — Buddy App
 *
 * - Uses Workbox (via CDN importScripts) for precaching and offline routing.
 * - `self.__WB_MANIFEST` is injected at build time by vite-plugin-pwa
 *   (`injectManifest` strategy configured in vite.config.ts).
 * - Keeps native Web Push handlers so push notifications display on iOS
 *   (installed PWA) and Android / desktop Chrome.
 */

importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

// Precache assets (manifest injected at build)
if (self.workbox) {
  self.workbox.core.skipWaiting();
  self.workbox.core.clientsClaim();
  self.workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);
}

// ─── Push notifications ──────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  let data = {
    title: 'Buddy App',
    body: 'You have a new notification',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'buddy-notification',
    data: {},
    requireInteraction: false,
    actions: [],
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = {
        title: payload.title || data.title,
        body: payload.body || data.body,
        icon: payload.icon || data.icon,
        badge: payload.badge || data.badge,
        tag: payload.tag || data.tag,
        data: payload.data || {},
        requireInteraction: payload.requireInteraction || false,
        actions: payload.actions || [],
      };
    } catch (error) {
      console.error('Failed to parse push data:', error);
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      data: data.data,
      requireInteraction: data.requireInteraction,
      actions: data.actions,
      vibrate: [200, 100, 200],
      timestamp: Date.now(),
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let urlToOpen = '/';
  if (data.route) urlToOpen = `/?route=${encodeURIComponent(data.route)}`;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) client.navigate(urlToOpen);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});

self.addEventListener('notificationclose', () => {
  // Intentionally empty — hook left for future analytics.
});

// Allow the app to ask the SW to show a local notification via postMessage
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, data } = event.data;
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data,
      vibrate: [200, 100, 200],
    });
  }
});
