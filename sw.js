// Trivia Scorekeeper service worker — makes the app usable with no signal once it's been opened once.
// Stale-while-revalidate for every same-origin file: always answer from cache first (instant, and
// safe on the slow/flaky wifi this app is meant to survive), then refresh the cache from the
// network in the background so the next launch has the latest build. Network-first was tried here
// before, but on a slow (not fully offline) connection it waits on the network before ever falling
// back to cache — which reads as the app hanging on a blank screen at a venue with bad signal. The
// app is split across index.html/css/js — all of it is pre-cached below so a fresh install works
// offline immediately, not just after each file has been individually fetched once. The Google
// Fonts stylesheet is not cached — it just falls back to system fonts offline.
const CACHE_NAME='trivia-scorekeeper-shell-v4';
const SHELL_FILES=['./','./index.html','./manifest.json','./icons/icon-192.png','./icons/icon-512.png',
  './css/styles.css','./js/app.js','./js/vendor/fflate.min.js','./js/vendor/jspdf.min.js','./js/data/xlsx-templates.js'];

self.addEventListener('install',(e)=>{
  e.waitUntil(caches.open(CACHE_NAME).then((cache)=>cache.addAll(SHELL_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate',(e)=>{
  e.waitUntil(
    caches.keys().then((keys)=>Promise.all(keys.filter((k)=>k!==CACHE_NAME).map((k)=>caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch',(e)=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  if(url.origin!==self.location.origin)return; // don't intercept Google Fonts etc.
  e.respondWith(
    caches.match(e.request).then((cached)=>{
      const network=fetch(e.request).then((res)=>{
        if(res&&res.ok){
          const copy=res.clone();
          caches.open(CACHE_NAME).then((cache)=>cache.put(e.request,copy));
        }
        return res;
      }).catch(()=>cached||caches.match('./index.html'));
      return cached||network;
    })
  );
});
