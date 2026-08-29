const CACHE = 'alameer-brand-v12';
const RUNTIME_CACHE = 'alameer-runtime-v5';

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './progressive-products.js',
  './config.js',
  './coupons-sync.js',
  './manifest.webmanifest',
  './assets/logo.png',
  './assets/placeholder.svg',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE && key !== RUNTIME_CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function isSheetRequest(url){
  return url.hostname.includes('docs.google.com') ||
         url.hostname.includes('googleusercontent.com');
}

async function networkFirst(request){
  const cache = await caches.open(RUNTIME_CACHE);
  try{
    const response = await fetch(request, { cache: 'no-store' });
    if(response && (response.ok || response.type === 'opaque')){
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  }catch(error){
    const cached = await cache.match(request);
    if(cached) return cached;
    throw error;
  }
}

async function staleWhileRevalidate(request){
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then(response => {
      if(response && (response.ok || response.type === 'opaque')){
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    });

  if(cached){
    networkPromise.catch(() => {});
    return cached;
  }

  return networkPromise;
}

self.addEventListener('fetch', event => {
  const request = event.request;

  if(request.method !== 'GET') return;

  const url = new URL(request.url);

  if(isSheetRequest(url)){
    event.respondWith(
      networkFirst(request)
        .catch(() => caches.match(request))
    );
    return;
  }

  if(request.destination === 'image'){
    event.respondWith(
      staleWhileRevalidate(request)
        .catch(() => caches.match('./assets/logo.png'))
    );
    return;
  }

  if(url.origin === self.location.origin){
    event.respondWith(
      networkFirst(request)
        .catch(async () => {
          const cached = await caches.match(request);
          if(cached) return cached;
          if(request.mode === 'navigate') return caches.match('./index.html');
          throw new Error('offline asset unavailable');
        })
    );
  }
});
