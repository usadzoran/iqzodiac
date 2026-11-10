'use strict';

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }
  const title = String(payload.title || 'New IQZodiac message').slice(0, 120);
  const options = {
    body: String(payload.body || 'Open IQZodiac to view your message.').slice(0, 180),
    icon: new URL('./favicon.svg', self.registration.scope).href,
    badge: new URL('./favicon.svg', self.registration.scope).href,
    tag: String(payload.tag || 'iqzodiac-message').slice(0, 100),
    renotify: false,
    data: { url: String(payload.url || './messages.html') },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './messages.html', self.registration.scope);
  const scope = new URL(self.registration.scope);
  if (target.origin !== scope.origin || !target.pathname.startsWith(scope.pathname)) return;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== scope.origin) continue;
      if ('navigate' in client) await client.navigate(target.href);
      return client.focus();
    }
    return self.clients.openWindow(target.href);
  })());
});
