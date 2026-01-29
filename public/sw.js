/**
 * Service Worker
 * Handles push notifications and offline functionality
 */

const CACHE_NAME = 'buddy-app-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/icon-192.png',
  '/icon-512.png',
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  let data = {
    title: 'Buddy App',
    body: 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/icon-badge.png',
    data: {},
  };

  // Parse notification data from push event
  if (event.data) {
    try {
      const payload = event.data.json();
      data = {
        title: payload.title || data.title,
        body: payload.body || data.body,
        icon: payload.icon || data.icon,
        badge: payload.badge || data.badge,
        data: payload.data || data.data,
        tag: payload.tag || 'buddy-notification',
        requireInteraction: payload.requireInteraction || false,
        actions: payload.actions || [],
      };
    } catch (error) {
      console.error('Failed to parse push data:', error);
      data.body = event.data.text();
    }
  }

  // Show notification
  const notificationPromise = self.registration.showNotification(data.title, {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    data: data.data,
    requireInteraction: data.requireInteraction,
    actions: data.actions,
    vibrate: [200, 100, 200],
    timestamp: Date.now(),
  });

  event.waitUntil(notificationPromise);
});

// Notification click event - handle user interaction
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);

  event.notification.close();

  // Get notification data
  const data = event.notification.data || {};
  const action = event.action;

  // Determine URL to open based on notification data
  let urlToOpen = '/';

  if (data.toolCategory) {
    // Map tool categories to routes
    const toolRoutes = {
      tracker: '/health',
      protocol: '/protocols',
      checkin: '/check-in',
      experiment: '/experiments',
      tasks: '/tasks',
      notes: '/notes',
      calendar: '/calendar',
      planning: '/planning',
      reflection: '/reflection',
      pomodoro: '/focus',
      toolbox: '/toolbox',
    };

    urlToOpen = toolRoutes[data.toolCategory] || '/';
  }

  // Handle notification actions
  if (action === 'open') {
    urlToOpen = data.url || urlToOpen;
  } else if (action === 'dismiss') {
    // Just close the notification
    return;
  }

  // Open the app or focus existing window
  const openApp = clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clientList) => {
      // Check if app is already open
      for (let client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Navigate to the target URL
          client.navigate(urlToOpen);
          return client.focus();
        }
      }

      // If app not open, open new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    });

  event.waitUntil(openApp);
});

// Notification close event - track dismissals
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event.notification);

  // Optional: Send analytics event for notification dismissal
  const data = event.notification.data || {};

  if (data.notificationId) {
    // Could send to analytics endpoint
    // fetch('/api/notifications/log', {
    //   method: 'POST',
    //   body: JSON.stringify({
    //     notificationId: data.notificationId,
    //     action: 'dismissed'
    //   })
    // });
  }
});

// Sync event - for background sync (future enhancement)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-notifications') {
    event.waitUntil(
      // Sync pending notifications with server
      fetch('/api/notifications/sync')
        .then((response) => response.json())
        .then((data) => {
          console.log('Notifications synced:', data);
        })
        .catch((error) => {
          console.error('Sync failed:', error);
        })
    );
  }
});

// Message event - handle messages from app
self.addEventListener('message', (event) => {
  console.log('Service worker received message:', event.data);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, data } = event.data;
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-badge.png',
      data,
      vibrate: [200, 100, 200],
    });
  }
});
