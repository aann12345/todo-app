/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

declare let self: ServiceWorkerGlobalScope

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('push', (event) => {
  const data = (() => {
    try {
      return event.data?.json() ?? {}
    } catch {
      return { body: event.data?.text() }
    }
  })()

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Задачи', {
      body: data.body ?? '',
      icon: '/todo-app/pwa-192.png',
      badge: '/todo-app/pwa-192.png',
      data: { url: data.url ?? '/todo-app/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/todo-app/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const open = clients.find((c) => c.url.includes('/todo-app/'))
      if (open) return open.focus()
      return self.clients.openWindow(url)
    }),
  )
})
