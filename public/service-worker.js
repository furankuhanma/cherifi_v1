const CACHE_NAME = 'cherifi-v1';
const RUNTIME_CACHE = 'cherifi-runtime-v1';

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html'
];

// Install event - precache assets
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Precaching app shell');
        // Use addAll with error handling for each resource
        return cache.addAll(PRECACHE_ASSETS.map(url => {
          return new Request(url, { cache: 'reload' });
        }));
      })
      .catch((error) => {
        console.error('❌ Precaching failed:', error);
        // Continue installation even if some assets fail
      })
      .then(() => {
        console.log('⏭️ Skipping waiting...');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activated');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => {
            console.log('🗑️ Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('📢 Claiming clients...');
      return self.clients.claim();
    })
  );
});

// Fetch event - Network First with Cache Fallback strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome extensions and non-http(s) requests
  if (!request.url.startsWith('http')) {
    return;
  }

  // For API calls - Network only (don't cache API responses)
  if (request.url.includes('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        // Return error response for failed API calls
        return new Response(
          JSON.stringify({ error: 'Offline - API unavailable' }),
          {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'application/json'
            })
          }
        );
      })
    );
    return;
  }

  // For navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone and cache successful navigation responses
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // If no cache, show offline page
            return caches.match('/offline.html');
          });
        })
    );
    return;
  }

  // For all other assets (JS, CSS, images, fonts, etc.)
  // Strategy: Cache First with Network Fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        console.log('📦 Serving from cache:', request.url);
        // Return cached version and update cache in background
        fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const responseClone = response.clone();
              caches.open(RUNTIME_CACHE).then((cache) => {
                cache.put(request, responseClone);
              });
            }
          })
          .catch(() => {
            // Network update failed, but we have cache
          });
        
        return cachedResponse;
      }

      // Not in cache, try network
      return fetch(request)
        .then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200) {
            return response;
          }

          // Don't cache opaque responses (CORS)
          if (response.type === 'opaque') {
            return response;
          }

          // Clone and cache the response for future use
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });

          return response;
        })
        .catch((error) => {
          console.error('❌ Fetch failed:', request.url, error);
          
          // For images, return a placeholder if available
          if (request.destination === 'image') {
            return new Response(
              '<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="400" fill="#18181b"/><text x="50%" y="50%" text-anchor="middle" fill="#71717a" font-size="16">Image Unavailable</text></svg>',
              {
                headers: { 'Content-Type': 'image/svg+xml' }
              }
            );
          }

          // For other resources, throw error
          throw error;
        });
    })
  );
});

// Listen for messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('⏭️ Received SKIP_WAITING message');
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_URLS') {
    console.log('📦 Caching additional URLs:', event.data.urls);
    event.waitUntil(
      caches.open(RUNTIME_CACHE).then((cache) => {
        return cache.addAll(event.data.urls);
      })
    );
  }
});