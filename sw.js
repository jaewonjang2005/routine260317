const CACHE = 'cman-v1'

self.addEventListener('install', e => {
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim())
})

// 알람 스케줄 체크 (백그라운드)
self.addEventListener('message', e => {
  if (e.data?.type === 'SCHEDULE_ALARMS') {
    scheduleAlarms(e.data.alarms)
  }
})

// 주기적 백그라운드 동기화 (지원 브라우저)
self.addEventListener('periodicsync', e => {
  if (e.tag === 'check-alarms') {
    e.waitUntil(checkAndFireAlarms())
  }
})

async function checkAndFireAlarms() {
  const now = new Date()
  const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
  const cache = await caches.open(CACHE)
  const res = await cache.match('/alarms')
  if (!res) return
  const alarms = await res.json()
  for (const alarm of alarms) {
    if (alarm.enabled && alarm.time === hhmm) {
      self.registration.showNotification(alarm.title, {
        body: alarm.body,
        icon: '/icon.png',
        badge: '/icon.png',
        tag: alarm.id,
        requireInteraction: true,
        data: { url: self.location.origin }
      })
    }
  }
}

self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      if (list.length > 0) return list[0].focus()
      return clients.openWindow(e.notification.data?.url || '/')
    })
  )
})
