// Network first for everything, so results are always fresh; cache is the offline fallback.
const CACHE='ufc334-v1';
const SHELL=['./','index.html','data.json','manifest.webmanifest','icons/icon-192.png','icons/icon-180.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  const req=e.request; if(req.method!=='GET') return;
  const url=new URL(req.url); const key=url.origin===location.origin? url.pathname.replace(/.*\//,'')||'./' : null;
  e.respondWith(fetch(req).then(res=>{ if(key!==null && res.ok){const cp=res.clone(); caches.open(CACHE).then(c=>c.put(key==='data.json'?'data.json':req,cp));} return res; })
    .catch(()=>caches.match(key==='data.json'?'data.json':req).then(r=>r||caches.match('index.html'))));
});
