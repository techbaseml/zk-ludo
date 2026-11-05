
const prefix='zk-ludo:'+self.registration.scope+':',cache=prefix+'28dd877e5ac72476',assets=["./ai.js","./board.js","./config.js","./engine.js","./icon-192.png","./icon-512.png","./icon.svg","./index.html","./manifest.webmanifest","./online.js","./practice.js","./store.js","./style.css","./ui.js"];
self.addEventListener('install',e=>e.waitUntil(caches.open(cache).then(c=>c.addAll(assets))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(prefix)&&k!==cache).map(k=>caches.delete(k)))).then(()=>clients.claim())));
self.addEventListener('fetch',e=>{const url=new URL(e.request.url);if(e.request.method!=='GET'||url.origin!==location.origin||!url.href.startsWith(self.registration.scope)||url.pathname.includes('/api/'))return;e.respondWith(caches.open(cache).then(async c=>await c.match(e.request.mode==='navigate'?new URL('index.html',self.registration.scope).href:e.request)||fetch(e.request)))});
