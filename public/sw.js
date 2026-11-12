// Keeps the app shell available offline. Firestore has its own offline cache for data, so this
// only handles the page and its static files. Everything else (API calls, auth) goes to the network.
const CACHE = 'plowman-shell-v1'
const SHELL = '/index.html'
const MAX_ENTRIES = 80

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

async function trim(cache) {
  const keys = await cache.keys()
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES)).map((key) => cache.delete(key)))
}

async function navigate(request) {
  const cache = await caches.open(CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(SHELL, response.clone())
    return response
  } catch {
    return (await cache.match(SHELL)) ?? Response.error()
  }
}

async function asset(request) {
  const cache = await caches.open(CACHE)
  const hit = await cache.match(request)
  if (hit) return hit
  const response = await fetch(request)
  if (response.ok) {
    await cache.put(request, response.clone())
    await trim(cache)
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/__/')) return

  if (request.mode === 'navigate') {
    event.respondWith(navigate(request))
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(asset(request))
  }
})
