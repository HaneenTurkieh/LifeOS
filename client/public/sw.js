// sw.js — service worker for real push notifications (see
// server/lib/push.js + server/routes/push.js). Intentionally minimal:
// this app has no offline/caching needs, a service worker exists here
// purely because push requires one (it's the thing that receives a
// push event even while no tab is open) and because having a service
// worker + manifest.json together is what makes a site an installable
// PWA in the first place — which iOS Safari specifically requires
// before it'll deliver push to it at all.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: 'Nuvora', body: '', link: '/' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (_) {
    // Non-JSON push payload (shouldn't happen — server always sends
    // JSON.stringify'd data) — fall back to the default above rather
    // than crashing the handler and losing the notification entirely.
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { link: data.link || '/' },
    }),
  );
});

// Clicking the notification focuses an already-open Nuvora tab if one
// exists (navigating it to the relevant link) instead of always opening
// a new one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/';
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientsList) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) client.navigate(link);
          return;
        }
      }
      await self.clients.openWindow(link);
    })(),
  );
});
