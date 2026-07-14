/**
 * Service Worker — Buddy App
 *
 * - Uses Workbox (bundled at build time by vite-plugin-pwa) for precaching.
 *   NEVER load workbox via CDN importScripts: a controlling SW that must hit
 *   the network to boot stalls every page fetch behind it on a slow
 *   connection (this bit us — pages hung with data requests never sent).
 * - `self.__WB_MANIFEST` is injected at build time by vite-plugin-pwa
 *   (`injectManifest` strategy configured in vite.config.ts).
 * - Keeps native Web Push handlers so push notifications display on iOS
 *   (installed PWA) and Android / desktop Chrome.
 * - This file only runs as a registered SW in production builds; dev
 *   sessions unregister any SW (see main.tsx).
 */

import { clientsClaim } from 'workbox-core';
import { precacheAndRoute } from 'workbox-precaching';

self.skipWaiting();
clientsClaim();
precacheAndRoute(self.__WB_MANIFEST || []);

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

    // Auto-attach action buttons for task-source reminders if the payload didn't
    // include any. Mark-done + snooze keep iOS lock-screen interactions snappy.
    let actions = data.actions || [];
    if ((!actions || actions.length === 0) && data.data && data.data.sourceType === 'task') {
        actions = [
            { action: 'done', title: 'Mark done' },
            { action: 'snooze', title: 'Snooze 15m' },
        ];
    }

    // Best-effort badge update on platforms that support it.
    if ('setAppBadge' in self.navigator && typeof data.data?.badge === 'number') {
        try {
            self.navigator.setAppBadge(data.data.badge);
        } catch (_) {
            /* ignore */
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
            actions,
            vibrate: [200, 100, 200],
            timestamp: Date.now(),
        }),
    );
});

self.addEventListener('notificationclick', (event) => {
    const action = event.action;
    event.notification.close();

    const data = event.notification.data || {};
    let urlToOpen = '/';
    if (data.route) {
        urlToOpen = `/?route=${encodeURIComponent(data.route)}`;
        // Anchor notifications carry a step (morning/midday/night) so the app can
        // land directly on the right part of the day flow.
        if (data.step) urlToOpen += `&step=${encodeURIComponent(data.step)}`;
    }

    // For task action buttons, route to the todo page with intent params so the
    // app can complete or snooze the task on focus.
    if (data.sourceType === 'task' && data.taskId) {
        if (action === 'done') {
            urlToOpen = `/?route=tasks&intent=complete&taskId=${encodeURIComponent(data.taskId)}`;
        } else if (action === 'snooze') {
            urlToOpen = `/?route=tasks&intent=snooze&taskId=${encodeURIComponent(data.taskId)}`;
        } else {
            urlToOpen = `/?route=tasks&taskId=${encodeURIComponent(data.taskId)}`;
        }
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    if ('navigate' in client) client.navigate(urlToOpen);
                    return client.focus();
                }
            }
            if (clients.openWindow) return clients.openWindow(urlToOpen);
        }),
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
