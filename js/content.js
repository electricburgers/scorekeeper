"use strict";

/* ── HOST BANTER LINES ──────────────────────────────────────────────
   Cycle through these between questions/rounds and after reading scores.
   Add, remove, or rewrite any line freely — keep them in your own voice. */
const BANTER = {
  next: [
    "And there's the answer! Let's keep this energy rolling — next question.",
    "Boom, that's the one. Staying in motion, here comes the next.",
    "That was a good one. Shake it off, here's the next question.",
    "Hope that felt good! On we go to the next.",
    "Whether you nailed it or not, now you know. Next question coming up.",
    "Love the buzz in this room — let's ride it into the next one.",
    "That's the answer, folks. Stay with me, here's the next.",
    "Locked in? Good. Pencils ready for the next question.",
    "Nicely played, everybody. Onward to the next.",
    "That one's in the books. Bartender, a round of consolation for the wrong answers.",
    "Somewhere in this room, someone just changed a right answer to a wrong one. Rest in peace, that point.",
  ],
  round: [
    "That round's in the books — great work! Stretch those brains, the next round's coming up.",
    "Fun round, everybody. Grab a drink, we'll be right back at it.",
    "That's a wrap on this round. You all brought it — next one's on its way.",
    "Solid round! Check in with your team and get ready, there's more fun ahead.",
    "Round done, and you made it look easy. Give yourselves a hand.",
    "Nice work this round. Quick breather, then we dive back in.",
    "That round had some teeth — you survived it! Onto the next.",
    "Done and dusted. Remember: it's not about what you know, it's about what your teammate refused to write down.",
    "Round finished! If you're winning, act humble. If you're losing, act like it's strategy.",
    "Remember: there's no crying in trivia. There's a little crying in trivia.",
    "Wagers are scored! Fortunes were made and lost on that one.",
  ],
  scores: [
    "Alright, let's see where everybody stands — here come the scores!",
    "Score update time — let's see how the night is shaping up.",
    "Here's where we are, and I'll tell you, it is interesting up top.",
    "Let's check the standings — honestly, it's anybody's game right now.",
    "Updated scores coming at you — and there's still plenty of trivia left.",
    "Scoreboard time! Whether you're leading or climbing, the night is young.",
    "Here come the numbers — don't get comfortable, this can still swing.",
    "Scores are in for that one. No lead is safe, folks.",
    "Let's see those totals. Remember: the team in last place statistically buys the best snacks.",
    "If you're losing, it builds character. If you're winning, it builds a tab.",
    "Statistically, the team in last is having the best time. Somebody has to.",
  ],
  beer: [
    "EVERYONE got that one — beer round, people! Beautifully done, whole room.",
    "Full marks across the board — you are all on fire tonight!",
    "That's a beer round! Every single team nailed it. Gorgeous.",
    "Unanimous! The entire room got it. That's what I'm talking about.",
    "This right here is why I love this gig. Beer round — you earned it!",
    "Clean sweep, everybody. Not a single miss. Cheers to that!",
  ],
  manywrong: [
    "Oof, that one had teeth — a lot of teams just found that out.",
    "That question caught a bunch of you! It's a sneaky one, no shame.",
    "Tricky one, that. Plenty of teams went the other way — here's the answer.",
    "A lot of folks zigged when they should've zagged on that one.",
    "That one's gonna stick with you now — that's how it sticks for next time.",
    "Rough one for the room — totally understandable, here's how it shakes out.",
    "Brutal! If your table got that one, order something fancy — you've earned it.",
    "A lot of red on my sheet for that one. It was a toughie — shake it off!",
  ],
  everyonewrong: [
    "Okay, that one got EVERYBODY — don't feel bad, it got the whole room!",
    "Nobody landed that one, and honestly? It was brutal. No shame at all.",
    "Zero for zero on that one — a true stumper, and I get why.",
    "That might be the hardest question of the night. Nobody got it — telling.",
    "When the whole room misses, that's on the question, not you. Here's the answer.",
    "Clean miss across the board. File this one away for next time!",
  ],
};
const BANTER_CAT_LABEL = {
  next: "After the Answer / Next Question",
  round: "Moving to the Next Round",
  scores: "Reading the Scores",
  beer: "Beer Round — Everyone Right",
  manywrong: "Many Got It Wrong",
  everyonewrong: "Everyone Got It Wrong",
};
/* In-memory only: maps a placement key -> current line index. Persists across
   renderLeft() re-renders (which happen on every score tap) so a line a host
   refreshed to mid-round doesn't snap back to the first line. Intentionally NOT
   saved to storage — banter resets fresh each session. */
let banterState = {};
function banterLine(cat, key) {
  const arr = BANTER[cat] || [];
  if (!arr.length) return "";
  let i = banterState[key];
  if (i == null || i < 0 || i >= arr.length) {
    i = Math.floor(Math.random() * arr.length);
    banterState[key] = i;
  }
  return arr[i];
}
function renderBanter(cat, key, opts) {
  opts = opts || {};
  const sm = opts.sm ? " banter-sm" : "";
  const showLabel = opts.label !== false;
  const lbl = BANTER_CAT_LABEL[cat] || "";
  const line = banterLine(cat, key);
  return (
    `<div class="banter${sm}">` +
    `<div class="banter-main">` +
    (showLabel ? `<span class="banter-cat">${ICON_MIC} ${esc(lbl)}</span>` : "") +
    `<div class="banter-text" data-bkey="${key}">${esc(line)}</div>` +
    `</div>` +
    `<button class="banter-refresh" type="button" onclick="cycleBanter('${key}','${cat}')" title="New line" aria-label="Refresh banter line">${ICON_REFRESH}</button>` +
    `</div>`
  );
}
/* Pick a different random line, update ONLY that line's text node (no full
   re-render) so the refresh button never moves and scroll never jumps. */
function cycleBanter(key, cat) {
  const arr = BANTER[cat] || [];
  if (arr.length < 2) {
    return;
  }
  let cur = banterState[key] ?? -1,
    next = cur;
  while (next === cur) {
    next = Math.floor(Math.random() * arr.length);
  }
  banterState[key] = next;
  const el = document.querySelector(
    '.banter-text[data-bkey="' +
      (window.CSS && CSS.escape ? CSS.escape(key) : key) +
      '"]',
  );
  if (el) el.textContent = arr[next];
}

/* ── THANK THE STAFF ────────────────────────────────────────────────
   Shown right after the halftime wager — the one real pause in the night, and the point where
   the room still has drinks left to order. {names} is filled from Event Details → Restaurant
   Staff; when that's empty the line still reads fine, it just goes generic. Rewrite these
   freely, but keep the {names} token — it's the whole reason the block exists. */
const STAFF_THANKS = [
  "Halftime's in the books — and none of it happens without {names}. Give them a hand, and remember: they are the only people in this room who can bring you another drink.",
  "Round of applause for {names}! They've been dodging your elbows all night carrying a full tray — tip them like your next drink depends on it. It does.",
  "Quick shoutout to the real MVPs tonight: {names}. Not one correct wager between them, but every glass in here is full — take care of them on the way out.",
  "Before we go further — let's hear it for {names}, keeping this place running while we all yell about geography.",
  "Big thanks to {names} behind the bar tonight — pouring all night and putting up with us the whole time.",
  "Round of applause for {names} — you've earned hazard pay navigating this crowd tonight.",
  "Let's not forget the people actually working tonight — thank you to {names} for having us.",
  "A big thank you to {names} — trivia night doesn't happen without you.",
  "Let's hand out some appreciation along with the points tonight — thanks, {names}.",
  "Quick shoutout to {names}, keeping the drinks and food coming — we see you, we appreciate you.",
  "Before the next round — thanks to {names} behind the bar and in the kitchen making this happen.",
];
const STAFF_THANKS_FALLBACK = "your servers and bartenders tonight";
const STAFF_THANKS_KEY = "staff-thanks";
/* Builds the line as HTML (not text) so the names can be emphasised — they're the part the
   host actually has to read off. Index lives in banterState, so a line the host refreshed to
   survives the re-render that fires on every score tap, same as the banter lines nearby. */
function staffThanksHtml() {
  const raw = (gameState.meta.staffNames || "").trim();
  const names = raw
    ? `<strong class="staff-thanks-names">${esc(raw)}</strong>`
    : `<em class="staff-thanks-missing">${STAFF_THANKS_FALLBACK}</em>`;
  let i = banterState[STAFF_THANKS_KEY];
  if (i == null || i < 0 || i >= STAFF_THANKS.length) {
    i = Math.floor(Math.random() * STAFF_THANKS.length);
    banterState[STAFF_THANKS_KEY] = i;
  }
  // esc() first, then substitute: escaping leaves the {names} token alone, so the only markup
  // that survives into the line is the bit built above.
  return esc(STAFF_THANKS[i]).replace("{names}", names);
}
function cycleStaffThanks() {
  if (STAFF_THANKS.length < 2) return;
  let cur = banterState[STAFF_THANKS_KEY] ?? -1,
    next = cur;
  while (next === cur) {
    next = Math.floor(Math.random() * STAFF_THANKS.length);
  }
  banterState[STAFF_THANKS_KEY] = next;
  const el = document.getElementById("staffThanksLine");
  if (el) el.innerHTML = staffThanksHtml();
}
/* Two boxes write this one field — Event Details and the halftime block. Push the value into
   the other box and re-word the line in place rather than calling renderLeft(): a full render
   mid-typing would take the caret with it. The box that's being typed in is skipped, since
   assigning .value to a focused textarea moves the cursor to the end. */
function setStaffNames(v) {
  gameState.meta.staffNames = v;
  autosave();
  document.querySelectorAll(".staff-names-input").forEach((el) => {
    if (el !== document.activeElement && el.value !== v) el.value = v;
  });
  const line = document.getElementById("staffThanksLine");
  if (line) line.innerHTML = staffThanksHtml();
}
/* The editor is deliberately not gated behind the Event Details lock: the point of putting it
   here is that a host who never filled the names in can add them mid-game without scrolling
   back up, and it's free text that no score depends on. */
function renderStaffThanks() {
  if (!gameState.teams.length) return "";
  return (
    `<div class="staff-thanks" id="staffThanksBlock">` +
    `<div class="banter banter-sm">` +
    `<div class="banter-main">` +
    `<span class="banter-cat">${ICON_HEART} Thank the Staff</span>` +
    `<div class="banter-text" id="staffThanksLine">${staffThanksHtml()}</div>` +
    `</div>` +
    `<button class="banter-refresh" type="button" onclick="cycleStaffThanks()" title="New line" aria-label="Refresh staff thank-you line">${ICON_REFRESH}</button>` +
    `</div>` +
    `<label class="staff-thanks-edit"><span class="staff-thanks-edit-label">Staff names — same field as Event Details</span>` +
    `<textarea class="meta-textarea staff-names-input" maxlength="200" rows="2" aria-label="Restaurant staff names" placeholder="Server / bartender names to shout out" oninput="setStaffNames(this.value)">${esc(gameState.meta.staffNames || "")}</textarea></label>` +
    `</div>`
  );
}