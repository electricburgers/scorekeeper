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
// Built entirely on the Web Audio API. v19.39 shipped this alongside the original HTML5
// <audio>-element engine, with an in-app switcher, specifically so both could be tested
// side-by-side on real hardware; v19.40 removes that legacy engine and switcher now that Web
// Audio has been the winner of that comparison — this is the only drumroll implementation left.
//
// AUDIO POLICY — the app must never take the device's audio session until the host asks for it.
// The host runs this on the same iPad they play background music from, and iOS hands the audio
// session to whichever app most recently claimed it: the moment this tab claims one, their music
// ducks or stops every time the tab takes focus. Claiming happens far earlier than most code
// assumes — merely constructing an AudioContext is enough on iOS, even suspended. So:
//   * The AudioContext (below) is instantiated completely lazily, on active user interaction (a
//     tap on "Start Drumroll", "Play Horn", or a sound test button) — NEVER at script parse or
//     page load.
//   * useAmbientAudioSession() (further down) is set once, ahead of any playback, so WebKit
//     treats the session as "ambient" and mixes over background music instead of ducking or
//     claiming an exclusive playback session on iPadOS/iOS.
//   * Nothing anywhere else in the app plays audio. Grep for the functions below: they are only
//     ever reached from a craft-prize button.
//
// The four clips (start/loop/end/horn) ship as real files under assets/audio/, decoded once into
// AudioBuffers and reused for every draw thereafter — see loadWebAudioBuffers. "end" is the crash
// cymbal stinger the countdown hands off to when the drumroll finishes on its own; "horn" is the
// victory horn, played on its own only when the host has stopped the roll manually and fires it
// on demand (see playCraftVictoryHorn). The two used to play together on an automatic finish —
// that was a bug (see playWebAudioFinale below), not a design choice.
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

// Discards a context the OS has pulled out from under the page — mobile Safari does this
// routinely (a phone call, Control Center taking the audio session, the device locking mid-roll),
// and it can happen on desktop too under memory pressure. A closed AudioContext stays "truthy"
// forever, so without this check every future createBufferSource()/createGain() call throws
// InvalidStateError synchronously, uncaught, and silently kills whatever it was in the middle of
// — which for the auto-finish handoff (see playWebAudioFinale) meant no crash sound AND no winner
// reveal, since the throw happens before either runs. A fresh context picks the next play back up
// cleanly; the decoded AudioBuffers stay valid and don't need reloading (they aren't tied to the
// context that decoded them).
function getWebAudioContext() {
  if (webAudioCtx && webAudioCtx.state === "closed") {
    webAudioCtx = null;
  }
  if (!webAudioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      webAudioCtx = new AudioCtx();
    }
  }
  return webAudioCtx;
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
    // Web Audio unsupported (very old browser) — nothing left to fall back to, so the draw just
    // runs silently; the visual flash/countdown still work.
    console.warn("Web Audio unavailable — drumroll will run without sound.");
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

// The automatic ending: the countdown reaching zero hands off to the crash cymbal stinger alone
// (WEB_AUDIO_CLIPS.end) — never the horn. The horn is reserved for the manual "Play Horn" reveal
// (playVictoryHornSound/playWebAudioHorn below); the two playing together here was the bug this
// function exists not to have.
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
    // The whole crash cue, not just its .start() call, is wrapped here — createBufferSource()/
    // createGain() throw synchronously on a context the OS has invalidated mid-roll (see
    // getWebAudioContext), and unlike .start() they weren't guarded, so that throw used to skip
    // straight past "if (after)" below: no crash sound AND the winner never got revealed, since
    // nothing else was left to call it. The draw finishing with no sound and no winner (rather
    // than just no sound) was the actual bug report — the host isn't left staring at a drumroll
    // that "finished" but never produced anything.
    try {
      if (bufs.end) {
        const now = ctx.currentTime;
        const endSource = ctx.createBufferSource();
        endSource.buffer = bufs.end;
        const endGain = ctx.createGain();
        endGain.gain.setValueAtTime(0.5, now);
        endGain.gain.linearRampToValueAtTime(1.0, now + 0.25);
        endSource.connect(endGain);
        endGain.connect(ctx.destination);
        endSource.start(now);
        activeWebAudio.endSource = endSource;
      }
    } catch (e) {
      console.warn("Crash stinger failed to play:", e);
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
  } else if (action === "horn") {
    playVictoryHornSound();
  }
}

// Starts the drumroll. Called straight from the draw button's click handler: it has to run
// synchronously inside that click for iOS to treat the AudioContext construction/decode as a
// user gesture (see the AUDIO POLICY note above).
function startDrumrollAudio() {
  startWebAudioDrumroll();
}
// The automatic reveal, fired by the draw's finish timer. See playWebAudioFinale for what it
// plays (the crash stinger, not the horn).
function playDrumrollFinale(after) {
  playWebAudioFinale(after);
}
// The horn on its own, for the manual "Play Horn" button. That button is only ever reached once
// the roll has already been faded out by "Stop Drumroll", or after a winner is settled.
function playVictoryHornSound() {
  playWebAudioHorn();
}
function stopAllDrumAudio() {
  stopWebAudioDrumroll();
}
// Winds the roll down instead of cutting it off mid-beat — used by the manual "Stop Drumroll"
// control, over whatever length the Settings crossfade slider is set to. Native GainNode ramping,
// not element volume: iOS ignores HTMLMediaElement volume writes entirely, but a scripted Web
// Audio gain fade works regardless.
function fadeOutDrumAudio(after) {
  fadeOutWebAudioDrumroll(craftFadeSec(), after);
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
  // otherwise draw the pre-stop UI. The repaint is then handed to fadeOutDrumAudio rather than run
  // here, so it lands after the gain fade is scheduled instead of blocking ahead of it. A frame's
  // delay on the button swapping to "Play Horn" is invisible; the delay it was costing the audio
  // was not.
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
    </div>
    ${
      prefs.craftManualEnd && prefs.craftSoundTest
        ? `<div class="cp-test-bar">
      <span class="cp-field-label">Test Sounds:</span>
      <button class="settings-btn btn-sm" onclick="testAudioClip('start')" title="Play drumroll intro + loop">🥁 Roll</button>
      <button class="settings-btn btn-sm" onclick="testAudioClip('fade')" title="Fade out active drumroll">⏹ Fade</button>
      <button class="settings-btn btn-sm" onclick="testAudioClip('end')" title="Play drumroll crash stinger">💥 Crash</button>
      <button class="settings-btn btn-sm" onclick="testAudioClip('horn')" title="Play victory horn">🎺 Horn</button>
    </div>`
        : ""
    }
    <div class="cp-note">Top ${excludeN} place${excludeN > 1 ? "s" : ""} ${excludeN > 1 ? "are" : "is"} excluded: ${esc(
      ranked()
        .slice(0, excludeN)
        .map((r) => r.name)
        .join(", "),
    )}</div>
    <p class="fr-note">Note: Not hearing sound? Make sure your device isn't on Silent Mode.</p>`;
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