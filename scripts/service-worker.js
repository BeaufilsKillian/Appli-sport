/* Fichier source généré par build-pwa.mjs. Les API privées ne sont jamais mises en cache. */
const VERSION = __VERSION__;
const CORE = __CORE__;
const MEDIA = __MEDIA__;
const CORE_CACHE = `training-core-${VERSION}`;
const MEDIA_CACHE = 'training-media-v1';
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CORE_CACHE);
    // Réessayer une installation incomplète ne touche pas au cache de la version active.
    for (const url of CORE) await cache.add(new Request(url, { cache: 'reload' }));
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('training-core-') && key !== CORE_CACHE) await caches.delete(key);
    const media = await caches.open(MEDIA_CACHE);
    for (const request of await media.keys()) if (!MEDIA.includes(new URL(request.url).pathname)) await media.delete(request);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname === '/guide' || url.pathname.startsWith('/guide/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => (await (await caches.open(CORE_CACHE)).match('/index.html')) || fetch(event.request))());
    return;
  }
  if (!CORE.includes(url.pathname) && !MEDIA.includes(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(MEDIA.includes(url.pathname) ? MEDIA_CACHE : CORE_CACHE);
    const cached = await cache.match(url.pathname);
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok) await cache.put(url.pathname, response.clone());
    return response;
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ADMIN_DEVICE') {
    event.waitUntil((async()=>{
      const cache=await caches.open('training-admin-device-v1');
      if(event.data.enabled)await cache.put('/__admin_device',new Response('enabled'));
      else {
        await cache.delete('/__admin_device');
        if(self.navigator.clearAppBadge)await self.navigator.clearAppBadge();
        for(const notification of await self.registration.getNotifications({tag:'access-requests'}))notification.close();
      }
    })());return;
  }
  if (event.data?.type === 'ACTIVATE') { self.skipWaiting(); return; }
  if (event.data?.type !== 'DOWNLOAD_MEDIA') return;
  const port = event.ports[0];
  if (!port) return;
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(MEDIA_CACHE);
      let completed = 0;
      for (const url of MEDIA) {
        if (!(await cache.match(url))) {
          const response = await fetch(url);
          if (!response.ok) throw new Error('Téléchargement interrompu. Réessaie avec Internet.');
          await cache.put(url, response);
        }
        port.postMessage({ completed: ++completed, total: MEDIA.length });
      }
      port.postMessage({ done: true });
    } catch { port.postMessage({ error: 'Téléchargement incomplet. Vérifie Internet et l’espace libre, puis réessaie.' }); }
  })());
});
self.addEventListener('push',event=>{
  event.waitUntil((async()=>{
    const allowed=await (await caches.open('training-admin-device-v1')).match('/__admin_device');
    if(!allowed)return;
    let data;try{data=event.data.json();}catch{return;}
    if(data?.type!=='access-request'||!Number.isSafeInteger(data.count)||data.count<0)return;
    if(self.navigator.setAppBadge)await self.navigator.setAppBadge(data.count);
    await self.registration.showNotification('Demande d’accès',{body:'Une demande attend ta décision dans Administration.',icon:'/icon-192.png',tag:'access-requests',data:{url:'/?admin=1'}});
  })());
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const root=new URL('/?admin=1',self.location.origin).href;
    for(const client of windows){if(new URL(client.url).pathname==='/'){client.postMessage({type:'OPEN_ADMIN'});return client.focus();}}
    return self.clients.openWindow(root);
  })());
});
