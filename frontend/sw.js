// public/sw.js
// Service Worker — handles push notifications and background sync

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// ── Handle incoming push notification ────────────────────────────────────────
self.addEventListener('push', e => {
  if (!e.data) return;

  let data;
  try { data = e.data.json(); }
  catch { data = { title: 'PlexusTalk', body: e.data.text() }; }

  const { title, body, roomId, callerName, callType, icon } = data;

  const options = {
    body: body || `${callerName} is calling you...`,
    icon: icon || '/logo.png',
    badge: '/badge.png',
    tag: `call-${roomId}`,          // replaces old notification for same room
    renotify: true,
    requireInteraction: true,        // stays visible until user acts
    vibrate: [300, 100, 300, 100, 300],
    data: { roomId, callerName, callType, url: self.location.origin },
    actions: [
      { action: 'accept', title: '✅ Accept', icon: '/accept.png' },
      { action: 'decline', title: '❌ Decline', icon: '/decline.png' },
    ],
  };

  e.waitUntil(
    self.registration.showNotification(title || '📞 Incoming Call', options)
  );
});

// ── Handle notification click ─────────────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();

  const { roomId, callType, url } = e.notification.data || {};
  const action = e.action;

  if (action === 'decline') {
    // Just close — do nothing
    return;
  }

  // Accept or tap notification body → open room
  if (roomId) {
    const roomUrl = callType === 'group'
      ? `${url}/group/${roomId}`
      : `${url}/room/${roomId}`;

    e.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
        // If app is already open, focus it and navigate
        for (const client of clientList) {
          if (client.url.includes(url) && 'focus' in client) {
            client.focus();
            client.postMessage({ type: 'NAVIGATE_TO_ROOM', roomId, callType });
            return;
          }
        }
        // Otherwise open new window
        if (clients.openWindow) return clients.openWindow(roomUrl);
      })
    );
  }
});

// ── Handle notification close ─────────────────────────────────────────────────
self.addEventListener('notificationclose', e => {
  // User dismissed without action
  const { roomId } = e.notification.data || {};
  if (roomId) {
    // Notify app that notification was dismissed
    clients.matchAll({ type: 'window' }).then(clientList => {
      clientList.forEach(client => {
        client.postMessage({ type: 'CALL_DISMISSED', roomId });
      });
    });
  }
});
