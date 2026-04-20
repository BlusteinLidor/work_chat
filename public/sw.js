self.addEventListener('push', (event) => {
  let payload = {
    title: 'Friends Chat',
    body: 'You have a new message',
    tag: 'friends-chat-message',
    url: '/dashboard',
  }

  if (event.data) {
    try {
      const parsed = event.data.json()
      payload = { ...payload, ...parsed }
    } catch {
      payload.body = event.data.text()
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: '/vite.svg',
      badge: '/vite.svg',
      data: { url: payload.url || '/dashboard' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/dashboard'
  event.waitUntil(self.clients.openWindow(targetUrl))
})
