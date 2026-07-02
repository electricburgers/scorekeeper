// Trivia Scorekeeper service worker — makes the app usable with no signal once it's been opened once.
// Network-first for index.html (so online users always get the latest build), falling back to
// the cached copy when offline. Everything the app needs (audio, XLSX templates, PDF lib) is
// already embedded as base64 inside index.html, so caching that one file is enough for full
// offline use. The Google Fonts stylesheet is not cached — it just falls back to system fonts offline.
const CACHE_NAME='trivia-scorekeeper-shell-v1';
const SHELL_FILES=['./','./index.html','./manifest.json','./icons/icon-192.png','./icons/icon-512.png'];

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
    fetch(e.request).then((res)=>{
      const copy=res.clone();
      caches.open(CACHE_NAME).then((cache)=>cache.put(e.request,copy));
      return res;
    }).catch(()=>caches.match(e.request).then((cached)=>cached||caches.match('./index.html')))
  );
});
