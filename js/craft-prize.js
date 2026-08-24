"use strict";

// Craft prize randomizer (transient — not persisted across reload)
let craftDrawState = null,
  craftDrawTimeouts = [];
// Whether the host has opened the drawing flow. The section shows nothing but a single
// "Choose Craft Prize Winner" button until this is true, so none of the draw's machinery —
// audio included — is reachable without an explicit tap.
let craftFlowOpen = false;

function toggleCraftPrize(ti) {
  if (!gameState.teams[ti]) return;
  const was = gameState.teams[ti].craftPrize;
  gameState.teams.forEach((t) => {
    t.craftPrize = false;
  });
  gameState.teams[ti].craftPrize = !was;
  gameState.craftPrizeWinner = gameState.teams[ti].craftPrize
    ? { ti, script: craftPrizeScript(ti) }
    : null;
  autosave();
  renderAll();
}

// CRAFT PRIZE RANDOMIZER — drumroll + name-flash + spoken winner script. Only ever one winner.
//
// AUDIO POLICY — the app must never take the device's audio session until the host asks for it.
// The host runs this on the same iPad they play background music from, and iOS hands the audio
// session to whichever app most recently claimed it: the moment this tab claims one, their music
// ducks or stops every time the tab takes focus. Claiming happens far earlier than most code
// assumes — merely constructing an AudioContext is enough on iOS, even suspended, and so is a
// silent priming .play(). The previous implementation did exactly that: it built an AudioContext
// and decoded ~1.1MB of drum audio into it at page load as a warm-up, so simply opening the
// scorekeeper stole audio priority from the music app.
//
// So the rules here are:
//   * No Web Audio API at all — no AudioContext, no decodeAudioData, no gain nodes.
//   * Plain <audio> elements only, all of them constructed lazily inside the tap on the drumroll
//     button — never before it — and reused for every draw thereafter.
//   * The first .play() of a draw runs synchronously inside that tap's own click handler, with
//     nothing awaited before it, so iOS counts it as a direct user gesture. The spare elements
//     holding the fade and finale are unlocked in that same handler (see cueDrumClip), which is
//     what lets them start later from a timer.
//   * Nothing anywhere else in the app plays audio. Grep for playDrumClip and handOverToCue:
//     these functions are the only callers, and they are only ever reached from a craft-prize
//     button.
//
// An element can only play one thing at a time and cannot loop or cross a clip boundary
// gaplessly, so nothing is sequenced, looped, or layered at playback time — every transition the
// host hears is pre-rendered into a clip. assets/audio/roll.mp3 is a single 32.6s take long
// enough that a draw never reaches its end; from there a roll hands off exactly once, on an
// explicit cue, into a clip that already contains the transition: finale.wav (horn over the
// roll fading out) at
// the reveal, or the fade tail (roll fading out alone, built by fadeClipUrl at whatever length
// the Settings slider is set to) if the host stops early. Both open at the roll's own level and
// are handed over between elements rather than swapped on one, so neither transition has a level
// step or a gap in it.

// One continuous 32.6s drumroll: the 2.03s intro followed by 13 back-to-back copies of the
// 2.35s loop clip, butt-joined sample-accurately offline and encoded as a single MP3. This is
// one clip rather than an intro plus a looping middle because an HTMLMediaElement's loop
// restart is NOT gapless — it seeks back to zero, dropping a few ms of audio, which on
// something as continuous as a snare roll reads as a skip every 2.35s. (Web Audio's loop was
// sample-accurate, so this only became audible once the AudioContext came out; see the AUDIO
// POLICY note above for why it had to go.) MP3 encoder padding used to be the reason the loop
// clip had to stay uncompressed WAV, but padding only sits at a file's head and tail, and
// 32.6s covers the 30s maximum drumroll with room to spare — playback never reaches the end
// and never loops, so neither boundary is ever heard. Rebuild with: decode the intro, append
// 13 copies of the loop clip as raw PCM, then
//   ffmpeg -i roll.wav -c:a libmp3lame -b:a 128k -ar 48000 -ac 2 roll.mp3
// then replace assets/audio/roll.mp3 with the result.
//
// A fraction of a second of digital silence. iOS grants an <audio> element permission to play
// only when a play() call happens inside a user gesture, and that permission is per element —
// so the spare elements that hold the fade and finale have to be played once inside the host's
// drumroll tap, before they are ever needed. Playing this first (then swapping to the real
// clip, which keeps the permission) makes that unlocking play genuinely inaudible.
//
// The automatic ending: the victory horn with the drumroll fading out underneath it, mixed
// offline into one clip. A single <audio> element can only ever play one thing at a time, so
// an overlap has to be baked in — swapping straight from the roll to the horn left a hard
// cut where the roll simply vanished, which is what read as choppy. The roll enters this clip
// at exactly the level it was already playing at (the fade curve is at unity with zero slope
// at t=0), so the swap into it is inaudible, then it falls away over 1.0s. The curve decays
// faster than the standalone fade tail because it has to clear room for the horn, which is
// ~13dB quieter than the roll in RMS and would otherwise be masked through its own attack.
// WAV, not MP3: this clip is spliced into a running roll, and an encoder's leading padding would
// drop a gap at precisely the seam it exists to hide.
//
// These four finished clips (silent/roll/finale/horn) ship as real files under assets/audio/,
// referenced directly by DRUM_CLIPS below — not as base64 text in this bundle. They used to be
// four const DRUM_*_B64 strings here, individually decoded into a Blob on first use, which cost
// every visitor ~2.1MB of extra download and parse/compile time on this file whether or not they
// ever ran a drumroll. A real <audio src="assets/audio/...">, like the app's own icons and fonts
// already are, is at least as fast to swap between as the blob: URL it replaces (both are cheap
// handle lookups, no re-parse) and lets the browser's HTTP/disk cache — and this app's own
// service worker precache — do the caching instead of an in-memory Blob rebuilt every session.
// Still file://-safe: <audio src> resolves like <img src>, not like fetch(), so it is not
// subject to Chrome's block on fetch()/XHR to local files (see js/app.js's top-of-file note on
// why file:// has to keep working here) — unlike DRUM_FADESRC_B64 below, which stays base64
// text for exactly that reason.
//
// Raw PCM for the drumroll fade-out: one seamless 2.352s loop of the roll, interleaved stereo
// 16-bit at 48kHz, with no container around it (buildFadeClip writes its own WAV header).
// Shipped as source material rather than as a finished clip because the fade length is a
// Settings slider now, and pre-rendering every length the slider can reach would cost
// megabytes and still quantise it. Applying an envelope to these samples is plain arithmetic
// over a typed array, so a fade of any length is built without Web Audio — which stays
// off-limits here for the reason in the AUDIO POLICY note above. DRUM_FADESRC_B64 is declared
// in js/data/drum-clips.js (loaded before this file) rather than inline here, same reasoning as
// TRIVIA_XLSX_B64 in js/data/xlsx-templates.js: one giant string literal kept out of the file
// every visitor's browser has to parse just to run anything else in the app.
const DRUM_CLIPS = {
  silent: "assets/audio/silent.wav",
  roll: "assets/audio/roll.mp3",
  finale: "assets/audio/finale.wav",
  horn: "assets/audio/horn.mp3",
};
// Format of DRUM_FADESRC_B64, and therefore of the fade clips built from it. These have to match
// the roll the fade splices out of, or the handover would step in level or collapse to mono.
const FADE_SR = 48000;
const FADE_CH = 2;
// Where in the loop the fade starts. This point measures the same RMS as the loop overall, so the
// fade opens at the level the roll was already playing at and the handover has no step in it —
// the loop's own start is 2.8dB quieter and audibly dropped. Wraps, since the source is a loop.
const FADE_SRC_OFFSET = Math.round(2.2 * FADE_SR);
const FADE_RAMP_SEC = 0.008; // ramp-in covering the sub-ms overlap at the handover
let drumAudio = null; // plays the roll, and the horn on its own
let drumCues = {}; // clip name -> spare element holding that clip pre-loaded and ready to start
let fadeSrcPcm = null; // Int16Array of DRUM_FADESRC_B64, decoded once
let fadeClip = { sec: null, url: null }; // the one built fade clip, rebuilt when the slider moves

function b64Bytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function drumClipUrl(name) {
  // The fade is synthesised rather than shipped, since its length is a Settings slider.
  if (name === "fade") return fadeClipUrl(craftFadeSec());
  // The other four are real files (DRUM_CLIPS above) — no decode, no cache dict needed, the
  // browser's own HTTP/disk cache (and the service worker precache) already does that job.
  return DRUM_CLIPS[name];
}
// Renders the fade-out to a WAV blob at the requested length: read the roll loop from the
// level-matched offset, multiply by a raised-cosine envelope (unity with zero slope at the start,
// true zero at the end, so neither the splice nor the tail can click), and wrap the header on.
// Pure arithmetic over a typed array — no AudioContext, so this costs nothing on the audio session.
function fadeClipUrl(sec) {
  if (fadeClip.sec === sec && fadeClip.url) return fadeClip.url;
  if (!fadeSrcPcm) {
    const bytes = b64Bytes(DRUM_FADESRC_B64);
    fadeSrcPcm = new Int16Array(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength / 2,
    );
  }
  const srcFrames = fadeSrcPcm.length / FADE_CH;
  const frames = Math.max(1, Math.round(sec * FADE_SR));
  const ramp = Math.round(FADE_RAMP_SEC * FADE_SR);
  const dataLen = frames * FADE_CH * 2;
  const buf = new ArrayBuffer(44 + dataLen);
  const dv = new DataView(buf);
  const tag = (o, s) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i));
  };
  tag(0, "RIFF");
  dv.setUint32(4, 36 + dataLen, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); // PCM
  dv.setUint16(22, FADE_CH, true);
  dv.setUint32(24, FADE_SR, true);
  dv.setUint32(28, FADE_SR * FADE_CH * 2, true);
  dv.setUint16(32, FADE_CH * 2, true);
  dv.setUint16(34, 16, true);
  tag(36, "data");
  dv.setUint32(40, dataLen, true);
  const out = new Int16Array(buf, 44, frames * FADE_CH);
  for (let i = 0; i < frames; i++) {
    let g = 0.5 * (1 + Math.cos((Math.PI * i) / frames));
    if (i < ramp) g *= 0.5 * (1 - Math.cos((Math.PI * i) / ramp));
    const si = ((FADE_SRC_OFFSET + i) % srcFrames) * FADE_CH;
    const di = i * FADE_CH;
    for (let c = 0; c < FADE_CH; c++) out[di + c] = fadeSrcPcm[si + c] * g;
  }
  // Only ever one fade clip alive — drop the previous length rather than leaking a blob per
  // notch of the slider.
  if (fadeClip.url) URL.revokeObjectURL(fadeClip.url);
  fadeClip = {
    sec,
    url: URL.createObjectURL(new Blob([buf], { type: "audio/wav" })),
  };
  return fadeClip.url;
}
// Declares this page's audio as "ambient" — it mixes with whatever else the device is playing
// rather than taking the audio session for itself. Without this, iOS gives any page that plays
// audio an exclusive "playback" session, and the host's music app is paused the instant the
// drumroll starts. That is the same failure the AUDIO POLICY above is written against, reached by
// a different route: the policy stops the app claiming a session before it is asked to, and this
// stops the session it does eventually take from being an exclusive one. The two are complements,
// not alternatives — neither one alone keeps the music playing.
//
// Set once, ahead of any playback, and never per-play: the type is a property of the page, not of
// a clip. Assigning it is a declaration of intent rather than a claim on the session — no element
// is constructed and nothing is decoded — so unlike a priming .play() it is safe to do at load,
// which is also the only place it can be done early enough to cover the first roll.
//
// Feature-detected, since the Audio Session API is recent WebKit only; everywhere else this is a
// no-op and playback is unaffected. If iOS still interrupts the music with the type set to
// ambient, that is the platform's call to make and not something the page can override.
let ambientSessionRequested = false;
function useAmbientAudioSession() {
  if (ambientSessionRequested) return;
  ambientSessionRequested = true;
  try {
    if ("audioSession" in navigator) navigator.audioSession.type = "ambient";
  } catch (e) {
    // A partial implementation can reject the assignment. Nothing to fall back to, and nothing
    // worth blocking playback over — the drumroll still runs, it just may duck other audio.
  }
}
// Builds the single reusable element the first time a clip is actually played. preload="none"
// and the absence of a src keep it completely inert — no fetch, no decode, no audio session —
// right up until playDrumClip points it at a clip.
function getDrumAudio() {
  if (!drumAudio) {
    drumAudio = new Audio();
    drumAudio.preload = "none";
  }
  return drumAudio;
}
// Points the one element at a clip and starts it. Deliberately synchronous end to end: the first
// call of any draw runs inside a click handler, and an await/.then() before .play() would spend
// the user-gesture credit iOS grants that handler and leave the drumroll silent.
function playDrumClip(name) {
  const a = getDrumAudio();
  const url = drumClipUrl(name);
  if (a.src !== url) a.src = url;
  // A just-assigned src already starts at zero; this matters when the same clip is replayed
  // (tapping Play Horn twice), which would otherwise resume from where the last play ended.
  try {
    a.currentTime = 0;
  } catch (e) {}
  const p = a.play();
  if (p && p.catch)
    p.catch((err) => {
      // AbortError just means something legitimately superseded this play — a handover pausing
      // the roll, or a new draw reassigning src — so it is expected traffic, not a failure.
      if (err && err.name === "AbortError") return;
      console.error("Craft prize audio failed to play:", name, err);
    });
  return a;
}
// Loads a clip into its own spare element so it can start the instant it is cued, and unlocks
// that element for iOS while we are still inside the drumroll tap.
//
// Reassigning .src on the element that is currently playing costs ~30ms of real silence (measured:
// emptied -> loadstart -> loadedmetadata -> canplay), and the roll lands a beat every ~47ms, so
// that swap punched a hole through most of a beat. Handing over between two elements instead
// removes the load entirely: the incoming clip is already decoded and sitting at position zero,
// so cueing it is just a play() on a warm element.
//
// The unlocking play() has to happen here, inside the gesture, because iOS grants that permission
// per element and would otherwise reject the cue when it fires later from a timer. It plays
// assets/audio/silent.wav rather than the real clip so nothing is audible, then swaps to the real clip,
// which keeps the permission the silent play just earned.
function cueDrumClip(name) {
  let el = drumCues[name];
  if (el) {
    try {
      el.currentTime = 0;
    } catch (e) {}
    return el;
  }
  el = drumCues[name] = new Audio();
  el.preload = "auto";
  el.src = drumClipUrl("silent");
  const arm = () => {
    el.src = drumClipUrl(name);
    el.load(); // buffer it now, while the roll still has seconds left to run
    // Then play it once, muted, and rewind. Buffering alone is not enough: an element's first
    // play after a src swap blocks for ~10ms inside play() itself, and that time would be spent
    // with the roll still running over the top of the incoming clip. Playing it through once
    // muted takes that cost now, seconds before the host can possibly need it, and leaves the
    // element able to start in a fraction of a millisecond when it is actually cued. It is
    // inaudible, and it is not a preload of playback in the sense the AUDIO POLICY forbids —
    // it happens only after the host has already tapped the drumroll and started the audio.
    el.muted = true;
    const cool = () => {
      el.pause();
      try {
        el.currentTime = 0;
      } catch (e) {}
      el.muted = false;
    };
    const w = el.play();
    if (w && w.then) w.then(cool, cool);
    else cool();
  };
  const p = el.play();
  if (p && p.then)
    p.then(() => {
      el.pause();
      arm();
    }, arm);
  else arm();
  return el;
}
// Hands playback over from the roll to an already-cued clip. The roll is left running until the
// incoming clip reports that it is actually producing sound ("playing"), so the two overlap by a
// fraction of a millisecond rather than leaving a gap between them — and the cued clips open with
// an 8ms ramp-in, so that overlap sums to roughly constant level instead of a bump. Together with
// the clips starting at the roll's own level, the handover is heard as the roll simply beginning
// to die away. Falls back to the same-element swap if the cue was never unlocked.
//
// `after` runs once the handover has completed, and exists to keep the caller's re-render off the
// main thread until then. "playing" is delivered as a task, so ANY synchronous work queued ahead
// of it — including a setTimeout(…, 0) — runs first and holds the event off for as long as it
// takes. A full renderLeft() there cost 11-19ms, all of it spent with the roll still playing over
// the incoming clip. Handing the render back through this callback makes the ordering explicit
// instead of racing it.
function handOverToCue(name, after) {
  let pending = after;
  // Always hand the caller's re-render to a later task. Running it inline would put ~10ms of
  // layout work inside the "playing" handler, i.e. in the middle of the handover itself, which
  // is exactly the window where the roll and the incoming clip are both audible.
  const finish = () => {
    if (!pending) return;
    const fn = pending;
    pending = null;
    setTimeout(fn, 0);
  };
  const el = drumCues[name];
  if (!el || el.src === drumClipUrl("silent")) {
    playDrumClip(name);
    finish();
    return;
  }
  const stopRoll = () => {
    if (drumAudio) {
      try {
        drumAudio.pause();
      } catch (e) {}
    }
    finish();
  };
  el.addEventListener("playing", stopRoll, { once: true });
  // Insurance against being cued while the warm-up play in cueDrumClip is still in flight, which
  // would otherwise hand over to a muted element and drop the fade entirely.
  el.muted = false;
  // Only seek when it would actually move — a redundant seek on a paused element still puts it
  // through the seeking/seeked cycle before it will report itself as playing.
  if (el.currentTime) {
    try {
      el.currentTime = 0;
    } catch (e) {}
  }
  const p = el.play();
  if (p && p.catch)
    p.catch((err) => {
      el.removeEventListener("playing", stopRoll);
      // An AbortError means the cue was deliberately stopped (a new draw, or the winner being
      // cleared mid-fade); anything else means it was refused, so fall back to swapping on the
      // main element rather than leaving the host with a roll that never winds down.
      if (!(err && err.name === "AbortError")) playDrumClip(name);
      finish();
    });
  // Safety net: never strand the caller's UI update if "playing" somehow never arrives — but the
  // roll has to be stopped too, not just the UI unblocked. This used to call finish() directly,
  // which fired the winner reveal/re-render fine but skipped the drumAudio.pause() that only
  // stopRoll does, so a browser that's slow (or fails) to fire "playing" left the roll looping
  // forever under the reveal instead of handing over to the horn. Routing through stopRoll keeps
  // both halves together; it's safe to run twice; finish()'s own pending guard already no-ops the
  // second call if "playing" does eventually arrive after this fires.
  setTimeout(stopRoll, 400);
}
// --- WEB AUDIO API DRUMROLL ENGINE (Adapted from drumroll-pwa) ---
//
// AUDIO POLICY NOTE FOR WEB AUDIO:
// The AudioContext is instantiated completely lazily on active user interaction (e.g. tap on
// "Start Drumroll", "Play Horn", or sound test button), NEVER at script parse or page load.
// Furthermore, useAmbientAudioSession() is invoked before playback begins so WebKit treats the
// session as "ambient", mixing over background music instead of ducking or claiming an exclusive
// playback session on iPadOS/iOS.
const WEB_AUDIO_CLIPS = {
  start: "assets/audio/drumroll-start.wav",
  loop: "assets/audio/drumroll-loop.wav",
  end: "assets/audio/drumroll-end.wav",
  horn: "assets/audio/horn.wav",
};

let webAudioCtx = null;
let webAudioBuffers = null;
let webAudioLoadingPromise = null;
let activeWebAudio = {
  startSource: null,
  loopSource: null,
  endSource: null,
  hornSource: null,
  startGain: null,
  loopGain: null,
  active: false,
};

function getWebAudioContext() {
  if (!webAudioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      webAudioCtx = new AudioCtx();
    }
  }
  return webAudioCtx;
}

function isWebAudioEngine() {
  return loadPrefs().craftAudioEngine !== "legacy";
}

function setCraftAudioEngine(engine) {
  const p = loadPrefs();
  p.craftAudioEngine = engine === "legacy" ? "legacy" : "webaudio";
  savePrefs(p);
  applyPrefs();
  renderLeft();
}

async function loadWebAudioBuffers() {
  if (webAudioBuffers) return webAudioBuffers;
  if (webAudioLoadingPromise) return webAudioLoadingPromise;
  const ctx = getWebAudioContext();
  if (!ctx) return null;
  webAudioLoadingPromise = (async () => {
    try {
      const keys = Object.keys(WEB_AUDIO_CLIPS);
      const buffers = {};
      await Promise.all(
        keys.map(async (k) => {
          const res = await fetch(WEB_AUDIO_CLIPS[k]);
          const ab = await res.arrayBuffer();
          buffers[k] = await new Promise((resolve, reject) => {
            ctx.decodeAudioData(ab, resolve, reject);
          });
        })
      );
      webAudioBuffers = buffers;
      return buffers;
    } catch (e) {
      console.warn("Web Audio clip load failed:", e);
      return null;
    } finally {
      webAudioLoadingPromise = null;
    }
  })();
  return webAudioLoadingPromise;
}

function stopWebAudioDrumroll(stopEndAndHorn) {
  if (stopEndAndHorn === undefined) stopEndAndHorn = true;
  activeWebAudio.active = false;
  if (activeWebAudio.startSource) {
    try {
      activeWebAudio.startSource.stop();
      activeWebAudio.startSource.disconnect();
    } catch (e) {}
    activeWebAudio.startSource = null;
  }
  if (activeWebAudio.loopSource) {
    try {
      activeWebAudio.loopSource.stop();
      activeWebAudio.loopSource.disconnect();
    } catch (e) {}
    activeWebAudio.loopSource = null;
  }
  activeWebAudio.startGain = null;
  activeWebAudio.loopGain = null;
  if (stopEndAndHorn) {
    if (activeWebAudio.endSource) {
      try {
        activeWebAudio.endSource.stop();
        activeWebAudio.endSource.disconnect();
      } catch (e) {}
      activeWebAudio.endSource = null;
    }
    if (activeWebAudio.hornSource) {
      try {
        activeWebAudio.hornSource.stop();
        activeWebAudio.hornSource.disconnect();
      } catch (e) {}
      activeWebAudio.hornSource = null;
    }
  }
}

function startWebAudioDrumroll() {
  const ctx = getWebAudioContext();
  if (!ctx) {
    // Fallback to legacy if Web Audio is unsupported
    useAmbientAudioSession();
    playDrumClip("roll");
    cueDrumClip("finale");
    cueDrumClip("fade");
    return;
  }
  useAmbientAudioSession();
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  stopWebAudioDrumroll();
  activeWebAudio.active = true;

  const playWithBuffers = (bufs) => {
    if (!activeWebAudio.active || !bufs || !bufs.start || !bufs.loop) return;
    const now = ctx.currentTime;

    const startSource = ctx.createBufferSource();
    startSource.buffer = bufs.start;
    const startGain = ctx.createGain();
    startGain.gain.setValueAtTime(0.5, now);
    startSource.connect(startGain);
    startGain.connect(ctx.destination);

    const loopSource = ctx.createBufferSource();
    loopSource.buffer = bufs.loop;
    loopSource.loop = true;
    const loopGain = ctx.createGain();
    loopGain.gain.setValueAtTime(0.5, now);
    loopSource.connect(loopGain);
    loopGain.connect(ctx.destination);

    activeWebAudio.startSource = startSource;
    activeWebAudio.loopSource = loopSource;
    activeWebAudio.startGain = startGain;
    activeWebAudio.loopGain = loopGain;

    try {
      startSource.start(now);
      // Sample-accurate scheduled transition onto loop
      loopSource.start(now + bufs.start.duration);
    } catch (e) {
      console.error("Web Audio start failed:", e);
    }
  };

  if (webAudioBuffers) {
    playWithBuffers(webAudioBuffers);
  } else {
    loadWebAudioBuffers().then((bufs) => {
      playWithBuffers(bufs);
    });
  }
}

function playWebAudioFinale(after) {
  const ctx = getWebAudioContext();
  if (!ctx) {
    if (after) setTimeout(after, 0);
    return;
  }
  useAmbientAudioSession();
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  stopWebAudioDrumroll(false);

  const play = (bufs) => {
    if (!bufs) {
      if (after) setTimeout(after, 0);
      return;
    }
    const now = ctx.currentTime;
    if (bufs.end) {
      const endSource = ctx.createBufferSource();
      endSource.buffer = bufs.end;
      const endGain = ctx.createGain();
      endGain.gain.setValueAtTime(0.5, now);
      endGain.gain.linearRampToValueAtTime(1.0, now + 0.25);
      endSource.connect(endGain);
      endGain.connect(ctx.destination);
      try {
        endSource.start(now);
        activeWebAudio.endSource = endSource;
      } catch (e) {}
    }
    if (bufs.horn) {
      const hornSource = ctx.createBufferSource();
      hornSource.buffer = bufs.horn;
      const hornGain = ctx.createGain();
      hornGain.gain.setValueAtTime(0.5, now);
      hornSource.connect(hornGain);
      hornGain.connect(ctx.destination);
      try {
        hornSource.start(now);
        activeWebAudio.hornSource = hornSource;
      } catch (e) {}
    }
    if (after) setTimeout(after, 0);
  };

  if (webAudioBuffers) play(webAudioBuffers);
  else loadWebAudioBuffers().then(play);
}

function fadeOutWebAudioDrumroll(fadeSec, after) {
  const ctx = getWebAudioContext();
  if (!ctx || !activeWebAudio.active) {
    stopWebAudioDrumroll();
    if (after) setTimeout(after, 0);
    return;
  }
  activeWebAudio.active = false;
  const now = ctx.currentTime;
  const dur = Math.max(0.1, fadeSec || 1.2);

  if (activeWebAudio.startGain) {
    try {
      activeWebAudio.startGain.gain.setValueAtTime(activeWebAudio.startGain.gain.value, now);
      activeWebAudio.startGain.gain.linearRampToValueAtTime(0, now + dur);
    } catch (e) {}
  }
  if (activeWebAudio.loopGain) {
    try {
      activeWebAudio.loopGain.gain.setValueAtTime(activeWebAudio.loopGain.gain.value, now);
      activeWebAudio.loopGain.gain.linearRampToValueAtTime(0, now + dur);
    } catch (e) {}
  }

  setTimeout(() => {
    stopWebAudioDrumroll();
    if (after) after();
  }, dur * 1000);
}

function playWebAudioHorn() {
  const ctx = getWebAudioContext();
  if (!ctx) return;
  useAmbientAudioSession();
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  const play = (bufs) => {
    if (!bufs || !bufs.horn) return;
    const now = ctx.currentTime;
    const hornSource = ctx.createBufferSource();
    hornSource.buffer = bufs.horn;
    const hornGain = ctx.createGain();
    hornGain.gain.setValueAtTime(0.5, now);
    hornSource.connect(hornGain);
    hornGain.connect(ctx.destination);
    try {
      hornSource.start(now);
      activeWebAudio.hornSource = hornSource;
    } catch (e) {}
  };
  if (webAudioBuffers) play(webAudioBuffers);
  else loadWebAudioBuffers().then(play);
}

function testAudioClip(action) {
  if (action === "start") {
    startDrumrollAudio();
  } else if (action === "fade") {
    fadeOutDrumAudio();
  } else if (action === "end") {
    if (isWebAudioEngine()) {
      const ctx = getWebAudioContext();
      if (ctx) {
        useAmbientAudioSession();
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        stopWebAudioDrumroll(false);
        const play = (bufs) => {
          if (!bufs || !bufs.end) return;
          const now = ctx.currentTime;
          const source = ctx.createBufferSource();
          source.buffer = bufs.end;
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.5, now);
          gain.gain.linearRampToValueAtTime(1.0, now + 0.25);
          source.connect(gain);
          gain.connect(ctx.destination);
          try {
            source.start(now);
            activeWebAudio.endSource = source;
          } catch (e) {}
        };
        if (webAudioBuffers) play(webAudioBuffers);
        else loadWebAudioBuffers().then(play);
      }
    } else {
      playDrumClip("finale");
    }
  } else if (action === "horn") {
    playVictoryHornSound();
  }
}

// Starts the drumroll. Called straight from the draw button's click handler: the .play() below
// is the gesture-blessed call that unlocks the element for the roll itself, and the two cueDrumClip
// calls do the same for the clips it can hand off to. Nothing is sequenced or looped — the clip
// simply runs until the draw's finish timer cues the finale, which is what keeps the roll
// perfectly continuous however long the countdown is.
function startDrumrollAudio() {
  if (isWebAudioEngine()) {
    startWebAudioDrumroll();
    return;
  }
  // Belt and braces — this normally ran at load, but the session type has to be in place before
  // the first play whatever the load order was, and once set the call is a no-op. A synchronous
  // property write spends no gesture credit, so it is safe ahead of the .play() below.
  useAmbientAudioSession();
  playDrumClip("roll");
  // Cue both clips a running roll can hand off to. This has to happen on this tap — it needs the
  // gesture — but it runs after playback is already under way so the roll never waits on it.
  cueDrumClip("finale");
  cueDrumClip("fade");
}
// The automatic reveal, fired by the draw's finish timer. Hands the roll over to the horn with the
// roll already fading out underneath it (see assets/audio/finale.wav), because one element cannot overlap
// two clips itself and cutting the roll dead at the horn sounded choppy.
function playDrumrollFinale(after) {
  if (isWebAudioEngine()) {
    playWebAudioFinale(after);
    return;
  }
  handOverToCue("finale", after);
}
// The horn on its own, for the manual "Play Horn" button. That button is only ever reached once
// the roll has already been faded out by "Stop Drumroll", or after a winner is settled — there is
// no roll left to overlap or hand over from, so this just plays on the main element.
function playVictoryHornSound() {
  if (isWebAudioEngine()) {
    playWebAudioHorn();
    return;
  }
  playDrumClip("horn");
}
function stopAllDrumAudio() {
  stopWebAudioDrumroll();
  // Never construct anything just to stop it — this is called from startNewGame and from clearing
  // a winner, neither of which should bring an audio element into existence.
  if (drumAudio) {
    try {
      drumAudio.pause();
    } catch (e) {}
  }
  Object.keys(drumCues).forEach((k) => {
    try {
      drumCues[k].pause();
    } catch (e) {}
  });
}
// Winds the roll down instead of cutting it off mid-beat — used by the manual "Stop Drumroll"
// control, over whatever length the Settings crossfade slider is set to. Hands over to the fade
// tail rather than ramping the element's volume, because iOS ignores volume writes entirely and a
// scripted gain fade does nothing at all on an iPad.
function fadeOutDrumAudio(after) {
  if (isWebAudioEngine()) {
    fadeOutWebAudioDrumroll(craftFadeSec(), after);
    return;
  }
  if (!drumAudio || drumAudio.paused) {
    stopAllDrumAudio();
    if (after) after();
    return;
  }
  handOverToCue("fade", after);
}
function clearCraftDrawTimers() {
  craftDrawTimeouts.forEach((id) => clearTimeout(id));
  craftDrawTimeouts = [];
  if (craftDrawState && craftDrawState.flashTimer)
    clearInterval(craftDrawState.flashTimer);
  if (craftDrawState && craftDrawState.countdownTimer)
    clearInterval(craftDrawState.countdownTimer);
}
// Elapsed/remaining/progress for the drumroll countdown UI, derived from a wall-clock
// timestamp (not a tick counter) so it stays accurate even if the tab was briefly backgrounded.
function craftCountdownState() {
  if (!craftDrawState || !craftDrawState.active) return null;
  const elapsed = performance.now() - craftDrawState.startedAt;
  const remaining = Math.max(0, craftDrawState.totalMs - elapsed);
  return {
    remaining,
    pct: Math.min(100, (elapsed / craftDrawState.totalMs) * 100),
  };
}
function craftPrizeScript(ti) {
  const t = gameState.teams[ti];
  const name = t?.name || "Team " + (ti + 1);
  const brewery = gameState.meta.craftPartner || "our craft partner";
  const town = (gameState.meta.craftPartnerTown || "").trim();
  return `Congratulations to ${name}! You've won a craft beer gift card to ${brewery}${town ? " in " + town : ""}. Cheers!`;
}
function setExcludeTopN(v) {
  // Can exclude at most N-1 of the N teams in the game — one team always has to stay
  // eligible for the craft prize, so the ceiling scales with the roster instead of a flat cap.
  const maxExcludeN = Math.max(1, gameState.teams.length - 1);
  const n = Math.max(1, Math.min(maxExcludeN, parseInt(v, 10) || 2));
  gameState.meta.excludeTopN = n;
  autosave();
  renderLeft();
}
function setCraftDrawSeconds(v) {
  const n = Math.max(3, Math.min(30, parseInt(v, 10) || 6));
  const p = loadPrefs();
  p.craftDrawSeconds = n;
  savePrefs(p);
  renderLeft();
}
function updateCraftScript(val) {
  if (gameState.craftPrizeWinner) {
    gameState.craftPrizeWinner.script = val;
    autosave();
  }
}
// The top N places (N = exclude-top setting) don't compete for the one craft-beer prize.
function craftEligiblePool() {
  const n = gameState.meta.excludeTopN || 2;
  const topN = new Set(
    ranked()
      .slice(0, n)
      .map((r) => r.index),
  );
  return gameState.teams.map((_, i) => i).filter((i) => !topN.has(i));
}

/* ── ELIGIBLE LIST EXPORT (for an outside drumroll app) ─────────────
   Hands the drawing off to a separate name-picker/drumroll app: same pool the in-app drawing
   would use, including the Exclude Top N rule, so the outside draw is over exactly the teams
   this app would have drawn from, led by the craft partner and its town. Plain lines, one entry
   each — that's what those apps take on a paste, and anything richer (CSV columns, JSON) just
   shows up as junk on the wheel. */
function craftEligibleTeamNames() {
  return craftEligiblePool().map(
    (ti) => gameState.teams[ti].name || "Team " + (ti + 1),
  );
}
// The craft partner and its town lead the list — the outside app is showing this to a room, and
// the brewery giving the prize should be on screen before the names it's being drawn for. Blank
// fields are dropped rather than emitted as empty lines: a name-picker reads a blank line as a
// nameless entry and will happily land the wheel on it.
function craftEligibleNames() {
  const head = [gameState.meta.craftPartner, gameState.meta.craftPartnerTown]
    .map((s) => (s || "").trim())
    .filter(Boolean);
  return head.concat(craftEligibleTeamNames());
}
// Both entry points refuse for the same two reasons; say which one out loud rather than
// silently handing over an empty file. Checks the team pool, not craftEligibleNames — the
// partner/town header would otherwise make a teamless list look non-empty.
function craftEligibleBlocker() {
  if (!gameState.teams.length)
    return "Add some teams first — there's nobody to export.";
  if (!craftEligibleTeamNames().length)
    return `No eligible teams: every team is inside the excluded top ${gameState.meta.excludeTopN || 2}. Lower "Exclude Top" in the Craft Prize Drawing section.`;
  return "";
}
function exportCraftEligible() {
  const blocked = craftEligibleBlocker();
  if (blocked) return appAlert(blocked);
  dl(
    new Blob([craftEligibleNames().join("\n") + "\n"], {
      type: "text/plain;charset=utf-8",
    }),
    exportFn("txt").replace(/\.txt$/, " - Craft Prize Eligible.txt"),
  );
}
function copyCraftEligible(btn) {
  const blocked = craftEligibleBlocker();
  if (blocked) return appAlert(blocked);
  const text = craftEligibleNames().join("\n");
  const ok = () => flashBtn(btn, CHECK_ICON_SVG + " Copied");
  const fail = () => {
    // execCommand is deprecated, but navigator.clipboard is undefined on a plain-http origin —
    // which is exactly what a laptop serving this over venue wifi looks like. Keep the fallback.
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;top:-9999px;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      const copied = document.execCommand("copy");
      ta.remove();
      copied ? ok() : appAlert("Couldn't copy — use the TXT button instead.");
    } catch (e) {
      appAlert("Couldn't copy — use the TXT button instead.");
    }
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(ok, fail);
  } else fail();
}
// Momentary label swap for confirmation — the app has no toast, and the button is already
// under the pointer that pressed it. Restores from the original label, so a double-tap mid-
// flash can't leave "✓ Copied" stuck there.
// innerHTML, not textContent: the flash label carries the shared CHECK_ICON_SVG now, and a
// textContent round-trip would both render the markup as literal text and strip any icon the
// button itself already had when restoring it.
function flashBtn(btn, label, ms) {
  if (!btn) return;
  if (btn.dataset.flashRestore == null)
    btn.dataset.flashRestore = btn.innerHTML;
  clearTimeout(+btn.dataset.flashTimer || 0);
  btn.innerHTML = label;
  btn.dataset.flashTimer = setTimeout(() => {
    btn.innerHTML = btn.dataset.flashRestore;
    delete btn.dataset.flashRestore;
    delete btn.dataset.flashTimer;
  }, ms || 1500);
}

function startCraftPrizeDraw() {
  if (craftDrawState && craftDrawState.active) return;
  if (gameState.craftPrizeWinner) {
    appAlert("The craft prize winner has already been chosen!");
    return;
  }
  const pool = craftEligiblePool();
  if (!pool.length) {
    appAlert(
      "No eligible teams left for the drawing (top-ranked teams are excluded)!",
    );
    return;
  }
  const prefs = loadPrefs();
  const totalMs = Math.max(3, Math.min(30, prefs.craftDrawSeconds || 6)) * 1000;
  craftDrawState = {
    active: true,
    pool,
    displayName: gameState.teams[pool[0]].name || "Team " + (pool[0] + 1),
    startedAt: performance.now(),
    totalMs,
  };
  clearCraftDrawTimers();
  stopAllDrumAudio();
  // THE audio gesture. Everything above this line is synchronous, and startDrumrollAudio calls
  // .play() synchronously too, so this whole path is still inside the button's click handler —
  // which is what makes iOS treat it as a user gesture and what unlocks the element for the
  // finale/fade swaps that follow. Do not put anything asynchronous in front of it.
  startDrumrollAudio();
  craftDrawState.flashTimer = setInterval(() => {
    const ti = pool[Math.floor(Math.random() * pool.length)];
    const name = gameState.teams[ti]?.name || "Team " + (ti + 1);
    if (craftDrawState) craftDrawState.displayName = name;
    // Update the flash text node directly — a full renderLeft() 9x/sec would rebuild the
    // entire left column for no reason, since only this one line of text is changing.
    const el = document.getElementById("cpFlashName");
    if (el) el.textContent = name;
    else renderLeft();
  }, 110);
  // Countdown UI ticks independently of the name-flash so the host can glance at exactly how
  // far into the drumroll they are while manually raising the volume and talking over it.
  craftDrawState.countdownTimer = setInterval(() => {
    const st = craftCountdownState();
    if (!st) return;
    const numEl = document.getElementById("cpCountdownNum");
    if (numEl) numEl.textContent = Math.ceil(st.remaining / 1000) + "s";
    const barEl = document.getElementById("cpCountdownBar");
    if (barEl) barEl.style.width = st.pct + "%";
  }, 100);
  // The finale and the winner selection share one timer so the reveal and the sound land together.
  // Audio first, and the winner deferred by a task rather than run inline: finalizeCraftPrizeWinner
  // does a full renderAll(), and the roll is stopped by the finale's own "playing" event, which
  // cannot be dispatched while that render owns the main thread. Running it inline held the event
  // off for ~10ms and left the roll overlapping the horn for that long. A frame's delay on the
  // winner appearing is invisible; the overlap was not. "Stop Drumroll" clears this timer, which
  // correctly cancels both halves.
  craftDrawTimeouts.push(
    setTimeout(() => {
      // Stop the name-flash and countdown intervals before the handover, not after. They repaint
      // every ~100ms, and one landing inside the handover window blocks the main thread for long
      // enough to leave the roll audible over the horn. finalizeCraftPrizeWinner clears them
      // again, harmlessly.
      clearCraftDrawTimers();
      playDrumrollFinale(() => finalizeCraftPrizeWinner(pool));
    }, totalMs),
  );
  renderLeft();
}
// Picks and commits the winner from the eligible pool — shared by the normal timed finish
// (startCraftPrizeDraw's setTimeout) and the manual "End Drumroll Now" control.
function finalizeCraftPrizeWinner(pool) {
  clearCraftDrawTimers();
  const winnerTi = pool[Math.floor(Math.random() * pool.length)];
  gameState.teams.forEach((t) => {
    t.craftPrize = false;
  });
  gameState.teams[winnerTi].craftPrize = true;
  gameState.craftPrizeWinner = {
    ti: winnerTi,
    script: craftPrizeScript(winnerTi),
  };
  craftDrawState = null;
  scoreSortMode = "asc";
  autosave();
  renderAll();
}
// Manual "Stop Drumroll" — lets the host cut the roll short (e.g. the moment a staff member
// reveals a paper from the stack) without picking the winner yet. Fades the roll down and leaves
// the draw paused, waiting on the host to fire the victory horn on demand via playCraftVictoryHorn.
// clearCraftDrawTimers below also cancels the timer that would otherwise fire the horn on schedule.
function stopDrumrollOnly() {
  if (!craftDrawState || !craftDrawState.active) return;
  // State first, because the repaint below can run synchronously on the fallback path and would
  // otherwise draw the pre-stop UI. The repaint is then handed to fadeOutDrumAudio rather than
  // run here, so it lands after the handover instead of blocking the event that drives it (see
  // handOverToCue). A frame's delay on the button swapping to "Play Horn" is invisible; the delay
  // it was costing the audio was not.
  clearCraftDrawTimers();
  craftDrawState.audioStopped = true;
  fadeOutDrumAudio(renderLeft);
}
// Manual "Play Horn" — while a draw is paused (roll already faded out via stopDrumrollOnly),
// picks and commits the winner and plays the horn, so the reveal lands exactly when the host
// wants it. Once a winner already exists, it just replays the horn on demand.
function playCraftVictoryHorn() {
  const pool =
    craftDrawState && craftDrawState.active ? craftDrawState.pool : null;
  // Horn first: this runs inside the button's click handler, and finalizeCraftPrizeWinner below
  // does a full re-render — no reason to make the reveal wait behind it.
  playVictoryHornSound();
  if (pool) finalizeCraftPrizeWinner(pool);
}
async function clearCraftPrizeWinner() {
  if (!gameState.craftPrizeWinner) return;
  if (
    !(await appConfirm(
      "Clear the craft prize winner? You can run the drumroll again after.",
    ))
  )
    return;
  clearCraftDrawTimers();
  stopAllDrumAudio();
  gameState.teams.forEach((t) => {
    t.craftPrize = false;
  });
  gameState.craftPrizeWinner = null;
  autosave();
  renderAll();
}
// Opens the drawing flow. Purely a UI reveal — it deliberately does NOT touch audio, warm
// anything up, or construct the <audio> element; see the AUDIO POLICY note above. The first and
// only thing that starts audio is the drumroll button inside the flow this reveals.
function openCraftPrizeFlow() {
  craftFlowOpen = true;
  renderLeft();
}
function renderCraftPrizeBlock() {
  const n = gameState.teams.length;
  if (!n)
    return '<p class="fr-note">Add teams to run the craft prize drawing.</p>';
  const excludeN = gameState.meta.excludeTopN || 2;
  const maxExcludeN = Math.max(1, n - 1);
  const poolLeft = craftEligiblePool().length;
  const prefs = loadPrefs();
  const secs = prefs.craftDrawSeconds || 6;
  const drawing = !!(craftDrawState && craftDrawState.active);
  const winner = gameState.craftPrizeWinner;
  // The Copy Prize Eligible List button used to be rendered here as well, in all three states
  // (pre-draw, mid-draw, winner shown). It now lives only in Advanced Settings > Craft Prize
  // Eligible List, which is where it was exported from all along — one button in one place
  // rather than the same action in two, in a section whose job is running the draw rather than
  // exporting from it.
  // Until the host opts in, the section is just this one button — same accent styling as the
  // drumroll button it opens, so it reads identically in every theme. A draw already running or
  // a winner already picked (e.g. restored from autosave) opens the flow on its own, so a
  // reload never hides a result behind the gate.
  if (!craftFlowOpen && !drawing && !winner) {
    return `<button class="btn btn-accent cp-draw-btn" onclick="openCraftPrizeFlow()" ${poolLeft <= 0 ? "disabled" : ""}>${ICON_BEER} Choose Craft Prize Winner</button>${poolLeft <= 0 ? `<p class="fr-note">No teams left to draw from — top ${excludeN} place${excludeN > 1 ? "s" : ""} excluded covers everyone entered. Add a team, or open this to lower Exclude Top.</p>` : ""}`;
  }
  const isWebAudio = prefs.craftAudioEngine !== "legacy";
  let h = `<div class="cp-config">
      <div class="cp-field"><span class="cp-field-label">Exclude Top</span><div class="stepper">
        <button onclick="setExcludeTopN(${Math.max(1, excludeN - 1)})" ${drawing || excludeN <= 1 ? 'disabled style="opacity:.3;cursor:default"' : ""} aria-label="Decrease excluded places">−</button>
        <input type="number" class="sw-input" aria-label="Number of top places excluded from the draw" inputmode="numeric" min="1" max="${maxExcludeN}" value="${excludeN}" ${drawing ? "disabled" : ""} onchange="setExcludeTopN(this.value)">
        <button onclick="setExcludeTopN(${Math.min(maxExcludeN, excludeN + 1)})" ${drawing || excludeN >= maxExcludeN ? 'disabled style="opacity:.3;cursor:default"' : ""} aria-label="Increase excluded places">+</button>
      </div></div>
      <div class="cp-field"><span class="cp-field-label">Drumroll (sec)</span><div class="stepper">
        <button onclick="setCraftDrawSeconds(${Math.max(3, secs - 1)})" ${drawing || secs <= 3 ? 'disabled style="opacity:.3;cursor:default"' : ""} aria-label="Decrease drumroll seconds">−</button>
        <input type="number" class="sw-input" aria-label="Drumroll length in seconds" inputmode="numeric" min="3" max="30" value="${secs}" ${drawing ? "disabled" : ""} onchange="setCraftDrawSeconds(this.value)">
        <button onclick="setCraftDrawSeconds(${Math.min(30, secs + 1)})" ${drawing || secs >= 30 ? 'disabled style="opacity:.3;cursor:default"' : ""} aria-label="Increase drumroll seconds">+</button>
      </div></div>
      <div class="cp-field"><span class="cp-field-label">Engine</span><div class="cp-engine-stepper">
        <button class="settings-toggle-btn ${isWebAudio ? 'active' : ''}" ${drawing ? "disabled" : ""} onclick="setCraftAudioEngine('webaudio')">Web Audio</button>
        <button class="settings-toggle-btn ${!isWebAudio ? 'active' : ''}" ${drawing ? "disabled" : ""} onclick="setCraftAudioEngine('legacy')">Legacy</button>
      </div></div>
    </div>
    <div class="cp-test-bar">
      <span class="cp-field-label">Test Sounds:</span>
      <button class="settings-btn btn-sm" onclick="testAudioClip('start')" title="Play drumroll intro + loop">🥁 Roll</button>
      <button class="settings-btn btn-sm" onclick="testAudioClip('fade')" title="Fade out active drumroll">⏹ Fade</button>
      <button class="settings-btn btn-sm" onclick="testAudioClip('end')" title="Play drumroll crash stinger">💥 Crash</button>
      <button class="settings-btn btn-sm" onclick="testAudioClip('horn')" title="Play victory horn">🎺 Horn</button>
    </div>
    <div class="cp-note">Top ${excludeN} place${excludeN > 1 ? "s" : ""} ${excludeN > 1 ? "are" : "is"} excluded: ${esc(
      ranked()
        .slice(0, excludeN)
        .map((r) => r.name)
        .join(", "),
    )}</div>`;
  if (drawing) {
    h += `<div class="cp-intro">${ICON_MIC} Now choosing our Craft Beer Prize winner…</div><div class="cp-flash" id="cpFlashName">${esc(craftDrawState.displayName || "")}</div>`;
    if (craftDrawState.audioStopped) {
      h += `<button class="btn btn-accent cp-horn-btn cp-manual-end-btn" onclick="playCraftVictoryHorn()" title="Pick the winner and play the victory horn now">${ICON_HORN} Play Horn</button>`;
    } else {
      const st = craftCountdownState() || {
        remaining: craftDrawState.totalMs,
        pct: 0,
      };
      h += `<div class="cp-countdown">
      <div class="cp-countdown-track"><div class="cp-countdown-fill" id="cpCountdownBar" style="width:${st.pct}%"></div></div>
      <div class="cp-countdown-num" id="cpCountdownNum">${Math.ceil(st.remaining / 1000)}s</div>
    </div>`;
      if (prefs.craftManualEnd) {
        h += `<button class="btn btn-danger cp-manual-end-btn" onclick="stopDrumrollOnly()" title="Stop just the drumroll sound, e.g. once a staff member reveals a paper from the stack — then play the horn whenever you're ready">${ICON_STOP} Stop Drumroll</button>`;
      }
    }
  } else {
    // The only control in the app that starts audio — see startCraftPrizeDraw's gesture note.
    h += `<button class="btn btn-accent cp-draw-btn" onclick="startCraftPrizeDraw()" ${winner || poolLeft <= 0 ? "disabled" : ""}>${ICON_DRUM} Start Drumroll</button>`;
    if (!winner && poolLeft <= 0)
      h += `<p class="fr-note">No teams left in the eligible pool — lower Exclude Top above, or add another team.</p>`;
    if (prefs.craftManualEnd && !winner) {
      // Previewed here, faded and disabled, so the host knows these controls exist before the
      // drumroll is even running — rather than only discovering them once a draw is underway.
      h += `<div class="cp-manual-preview">
        <button class="btn btn-danger cp-preview-btn" disabled title="Available once the drumroll is running">${ICON_STOP} Stop Drumroll</button>
        <button class="btn btn-accent cp-preview-btn" disabled title="Available once the drumroll is running">${ICON_HORN} Play Horn</button>
      </div>`;
    }
  }
  if (winner && !drawing) {
    const wname = gameState.teams[winner.ti]?.name || "Team " + (winner.ti + 1);
    h += `<div class="cp-winner"><span class="cp-winner-text">${ICON_TROPHY} <strong>${esc(wname)}</strong> won!</span><button class="btn btn-danger cp-clear-btn" onclick="clearCraftPrizeWinner()" title="Clear the winner and run the drawing again" aria-label="Clear the winner">${X_ICON_SVG}<span class="cp-clear-label"> Clear</span></button></div>
      ${
        prefs.craftManualEnd
          ? // Concatenation, not a ${} placeholder: this arm is a plain single-quoted string,
            // not a template literal, and pasting a placeholder into one is exactly how v18.57
            // shipped a button that rendered the literal text "${ICON_HORN} Play Horn" on screen.
            '<button class="btn btn-accent cp-horn-btn cp-manual-end-btn" onclick="playCraftVictoryHorn()" title="Play the victory horn on demand">' +
            ICON_HORN +
            ' Play Horn</button>'
          : ""
      }
      <label class="cp-script-label">Winner Announcement Script</label>
      <textarea class="cp-script" maxlength="600" aria-label="Winner announcement script" onchange="updateCraftScript(this.value)">${esc(winner.script)}</textarea>`;
  }
  return h;
}