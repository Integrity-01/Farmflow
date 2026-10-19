/* FarmFlow service worker */
const CACHE_NAME = 'farmflow-v6';
const API_CACHE_NAME = 'farmflow-api-v4';
const OFFLINE_URL = '/offline.html';
const API_TTL_MS = 45_000;
const PRECACHE_URLS = [
  '/',
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        const active = new Set([CACHE_NAME, API_CACHE_NAME]);
        return Promise.all(
          keys.filter((key) => !active.has(key)).map((key) => caches.delete(key)),
        );
      })
      .then(() => self.clients.claim()),
  );
});

function networkFirst(request) {
  return fetch(request)
    .then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    })
    .catch(async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      // Offline reload of any route: boot the cached SPA shell instead of the
      // static offline page — the router can then render from cached state.
      const shell = await caches.match('/');
      if (shell) return shell;
      return caches.match(OFFLINE_URL);
    });
}

// Immutable, content-hashed build assets: never re-request while online.
function cacheOnly(request) {
  return caches.match(request).then((cached) => {
    if (cached) {
      return cached;
    }
    return fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(OFFLINE_URL));
  });
}

function isApiFresh(cached) {
  const at = Number(cached.headers.get('X-FF-Cached-At'));
  if (!at) return false;
  return Date.now() - at < API_TTL_MS;
}

function storeApi(cache, request, response) {
  const stamped = new Response(response.clone().body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
  stamped.headers.set('X-FF-Cached-At', String(Date.now()));
  return cache.put(request, stamped);
}

function refreshApi(cache, request) {
  fetch(request)
    .then((response) => {
      if (response.ok) {
        return storeApi(cache, request, response);
      }
      if (response.status === 401 || response.status === 403) {
        // Expired token: drop the entry so the next request reaches the app
        // layer, which refreshes the session and repopulates the cache.
        return cache.delete(request);
      }
    })
    .catch(() => {
      // Network hiccup: keep whatever we already have.
    });
}

// Serve cached API GETs first. Within the TTL there is no network call at all;
// after it the cached copy is served instantly while a background refresh
// keeps the cache current. Offline: latest cached copy, else a 503 envelope.
async function apiStaleWhileRevalidate(request) {
  const cache = await caches.open(API_CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) {
    if (isApiFresh(cached)) {
      return cached;
    }
    refreshApi(cache, request);
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      await storeApi(cache, request, response);
    }
    return response;
  } catch {
    return new Response(
      JSON.stringify({
        status: 'error',
        code: 'OFFLINE',
        message: "You're offline. Please check your connection.",
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    // Central System Administrator data is sensitive and tenant-specific to a
    // platform identity. Never cache it — a shared or public device must not be
    // able to serve one admin's data to another. Bypass the SW entirely.
    if (url.pathname.startsWith('/api/system')) {
      return;
    }
    event.respondWith(apiStaleWhileRevalidate(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.pathname.startsWith('/assets/') || PRECACHE_URLS.includes(url.pathname)) {
    event.respondWith(cacheOnly(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'FarmFlow', body: 'You have a new update.' };
  }

  // When an app window is focused, the in-app badge already shows the alert.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      if (clients.some((client) => client.focused)) {
        return;
      }

      const title = data.title || 'FarmFlow';
      const options = {
        body: data.body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: data.taskId ? `task-${data.taskId}` : 'farmflow',
        data: { url: data.url || '/' },
      };

      return self.registration.showNotification(title, options);
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});