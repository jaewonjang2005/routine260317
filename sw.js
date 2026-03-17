const CACHE_NAME = 'cman-v1'
const ALARM_CACHE_KEY = 'alarms-data'

self.addEventListener('install', e => {
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim())
})

// 앱에서 알람 목록 전달받아 캐시에 저장
self.addEventListener('message', async e => {
  if (e.data?.type === 'SCHEDULE_ALARMS') {
    const cache = await caches.open(CACHE_NAME)
    await cache.put(
      ALARM_CACHE_KEY,
      new Response(JSON.stringify(e.data.alarms), {
        headers: { 'Content-Type': 'application/json' }
      })
    )
  }
})

// 주기적 백그라운드 동기화 (Android Chrome 지원)
self.addEventListener('periodicsync', e => {
  if (e.tag === 'check-alarms') {
    e.waitUntil(checkAndFireAlarms())
  }
})

// 푸시 알림 수신 (서버 푸시 방식 fallback)
self.addEventListener('push', e => {
  e.waitUntil(checkAndFireAlarms())
})

async function checkAndFireAlarms() {
  const cache = await caches.open(CACHE_NAME)
  const res = await cache.match(ALARM_CACHE_KEY)
  if (!res) return

  let alarms
  try { alarms = await res.json() } catch { return }

  const now = new Date()
  const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
  const todayKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`

  for (const alarm of alarms) {
    if (!alarm.enabled || alarm.time !== hhmm) continue

    // 오늘 이미 울린 알람은 스킵 (중복 방지)
    const firedKey = `fired_${alarm.id}_${todayKey}`
    const firedCache = await cache.match(firedKey)
    if (firedCache) continue

    await self.registration.showNotification(alarm.title, {
      body: alarm.body || '충만 루틴 기록 시간이에요',
      tag: alarm.id,
      requireInteraction: true,
      data: { url: self.location.origin }
    })

    // 발송 기록 저장
    await cache.put(firedKey, new Response('1'))
  }
}

self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      const existing = list.find(c => c.url.startsWith(self.location.origin))
      if (existing) return existing.focus()
      return clients.openWindow(e.notification.data?.url || '/')
    })
  )
})
