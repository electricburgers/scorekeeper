// Trivia Scorekeeper service worker — makes the app usable with no signal once it's been opened once.
//
// Strategy: fresh-if-fast, cached otherwise. Every same-origin GET races the network against a
// short timer. If the network answers inside NET_TIMEOUT_MS the response is used and written to
// the cache; if it doesn't, the cached copy is served immediately and the network request is left
// running in the background to refresh the cache anyway.
//
// This replaces plain stale-while-revalidate, which always answered from cache and refreshed
// behind it — correct for offline, but it meant a deployed build never appeared until the SECOND
// launch after the deploy. That bit three separate times (it's noted in the v18.51 changelog as a
// known trap, and again in v18.57), and "the fix didn't land" is an expensive thing to debug
// mid-service. It is not network-first either: network-first was tried here before and, on a slow
// (not fully offline) connection, waits on the network with no deadline before falling back to
// cache — which reads as the app hanging on a blank screen at a venue with bad signal. The timer
// is the whole point: a fast connection gets the current build on the first launch, a bad one
// still paints in at most NET_TIMEOUT_MS from cache, and a dead one paints instantly.
//
// One page load must not mix builds — a v18.58 index.html with a v18.57 app.js is worse than
// being one build behind. So the first request of a load records which side won and every request
// for the next DECISION_TTL_MS follows it, rather than each file racing independently.
//
// The app is split across index.html/css/js — all of it is pre-cached below so a fresh install
// works offline immediately, not just after each file has been individually fetched once. The
// Google Fonts stylesheet is not cached — it just falls back to system fonts offline.
// v8: adds the FAQ (faq/index.html + its css/js/fonts) to the precached shell. Previously only
// the main app was precached; the fetch handler below caches anything same-origin opportunistically
// after its first successful fetch, so this only ever mattered for a host whose FIRST-EVER visit
// to the FAQ (reached from Settings > Help) happened offline — but that's exactly the scenario
// this whole service worker exists for, so it's worth the few extra KB at install time. The FAQ's
// 50+ screenshots are deliberately left out: they're still cached opportunistically on first view,
// same as before, rather than ballooning what a fresh install has to fetch before it's usable.
// v13: js/vendor/fflate.min.js, js/vendor/jspdf.min.js, and js/data/xlsx-templates.js are no
// longer <script>-tagged in index.html (js/export.js now fetches them lazily on first PDF/XLSX
// export, off the page's initial load) — kept here anyway so a host who's exported once is still
// covered offline after that. Also switches the app's own fonts from five static-weight files to
// the same two variable fonts (inter-var.woff2/space-grotesk-var.woff2) the FAQ already used —
// and precaches the app's copies, which — unlike the FAQ's — were never listed here before.
const CACHE_NAME='trivia-scorekeeper-shell-v13';
const SHELL_FILES=['./','./index.html','./manifest.json','./icons/icon-192.png','./icons/icon-512.png',
  './css/styles.css','./css/tutorial.css','./js/shared-ui.js',
  './fonts/inter-var.woff2','./fonts/space-grotesk-var.woff2',
  // The ten files js/app.js was split into — see index.html, above these same script tags,
  // for why.
  './js/storage.js','./js/icons.js','./js/content.js','./js/scoring.js','./js/dom-utils.js',
  './js/confirm-dialog.js','./js/team-audit.js','./js/question-timer.js','./js/craft-prize.js',
  './js/export.js',
  './js/app.js','./js/tutorial.js',
  // Lazy-loaded by js/export.js on first PDF/XLSX export — see the v13 note above — but still
  // precached here so that first export works offline too, not just every one after it.
  './js/vendor/fflate.min.js','./js/vendor/jspdf.min.js','./js/data/xlsx-templates.js',
  // v19.40 dropped the legacy HTML5-audio drumroll engine (silent/roll/finale/horn.mp3 plus
  // js/data/drum-clips.js, its fade-source base64 file) in favor of the Web Audio engine alone —
  // these four real WAV files are all it precaches now.
  './assets/audio/drumroll-start.wav','./assets/audio/drumroll-loop.wav','./assets/audio/drumroll-end.wav','./assets/audio/horn.wav',
  './faq/index.html','./faq/css/faq.css','./faq/css/fonts.css',
  './faq/js/faq.js','./faq/js/faq-bootstrap.js',
  './faq/fonts/inter-var.woff2','./faq/fonts/space-grotesk-var.woff2'];

// How long the network gets before the cached copy is served instead. Long enough that a merely
// sluggish venue connection still delivers the current build, short enough that a host tapping
// the icon never sits looking at nothing.
const NET_TIMEOUT_MS=1500;
// How long one network-won/network-lost decision applies to subsequent requests. A page load
// issues all its subresource requests within a few hundred ms of the document, so this only has
// to outlast a single load; the next launch decides again from scratch.
const DECISION_TTL_MS=5000;

let decision=null,decidedAt=0;
function currentDecision(){
  return Date.now()-decidedAt<DECISION_TTL_MS?decision:null;
}
function record(d){
  decision=d;
  decidedAt=Date.now();
}

self.addEventListener('install',(e)=>{
  // cache:'reload' so a new worker precaches from the network rather than picking the previous
  // build back out of the browser's own HTTP cache — without it the shell can install stale.
  e.waitUntil(caches.open(CACHE_NAME).then((cache)=>
    Promise.all(SHELL_FILES.map((f)=>
      fetch(new Request(f,{cache:'reload'})).then((res)=>res.ok?cache.put(f,res):null).catch(()=>null)
    ))
  ));
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
  e.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    const cached=await cache.match(e.request);
    const network=fetch(e.request).then((res)=>{
      if(res&&res.ok)cache.put(e.request,res.clone());
      return res;
    });
    // Keep the request alive past whatever we answer with, so a slow connection still refreshes
    // the cache for next time — the one genuinely good property of the old strategy.
    e.waitUntil(network.catch(()=>{}));
    // Nothing cached: the network is the only answer available, however long it takes.
    if(!cached)return network.catch(()=>cache.match('./index.html'));
    if(currentDecision()==='cache')return cached;
    if(currentDecision()==='network'){
      const res=await network.catch(()=>null);
      return res||cached;
    }
    const fresh=await Promise.race([
      network.catch(()=>null),
      new Promise((r)=>setTimeout(()=>r(null),NET_TIMEOUT_MS)),
    ]);
    record(fresh?'network':'cache');
    return fresh||cached;
  })());
});
