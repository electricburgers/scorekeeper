// ============================== VERSION LABEL ==============================
// Single source of truth for the FAQ's own version, mirroring how the main Scorekeeper app
// tracks APP_VERSION/APP_VERSION_DATE (scorekeeper/js/app.js) and stamps them into one
// #versionLabel element. Here the same string feeds two spots — the page footer and the
// Settings panel's settings-meta row — so bumping a release only means editing these two
// constants instead of hunting down every place the version text is written out by hand.
const FAQ_VERSION = "v1.40";
const FAQ_VERSION_DATE = "28 Aug 2026";

// Same Lucide sun/moon geometry as the main app's THEME_ICON_SUN/MOON (js/app.js), tagged
// data-emoji so Icon Style (see faqApplyIconStyle further down) can swap this page's Theme
// button between the two the same way it swaps everything else. The icon-sun/icon-moon classes
// (not just icon-ui) are load-bearing, not decorative: css/styles.css's #faqThemeToggle rules
// are what paint these in the app's own gold-ray/cyan-disc colors instead of a flat
// currentColor — without the class, this rendered as a plain uncoloured icon-ui.
const FAQ_THEME_SUN_SVG =
  '<svg class="icon-ui icon-sun" viewBox="0 0 24 24" aria-hidden="true" focusable="false" data-emoji="☀️"><circle cx="12" cy="12" r="5"></circle><g stroke-width="2" stroke-linecap="round"><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></g></svg>';
const FAQ_THEME_MOON_SVG =
  '<svg class="icon-ui icon-moon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" data-emoji="🌙"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
(function () {
  var text = "FAQ " + FAQ_VERSION + " (" + FAQ_VERSION_DATE + ")";
  ["faqVersionLabel", "faqSettingsVersionLabel"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  });
})();

// ============================== TODAY'S DATE ==============================
// Computed client-side at load (date + year, e.g. "August 15, 2026") rather than hardcoded, so
// the footer always reflects the day the page is actually being viewed. No weekday — that's not
// meaningful next to the version line above it. Uses the visitor's own locale/timezone via Intl
// (through toLocaleDateString) instead of a fixed format.
(function () {
  var el = document.getElementById("faqToday");
  if (!el) return;
  try {
    el.textContent = new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch (e) {}
})();

// ============================== LIGHTBOX ==============================
// Event delegation on the whole page rather than an onclick per <img> so every current and
// future .faq-shot image — standalone, paired, or trio — gets this for free, and a broken image
// (already swapped for a placeholder by faqShotFallback before this ever fires, since that
// removes the <img> node entirely) can never end up opening an empty lightbox.
document.addEventListener("click", function (e) {
  const img = e.target.closest(".faq-shot img");
  if (img) openFaqLightbox(img);
});
function openFaqLightbox(img) {
  const lb = document.getElementById("faqLightbox");
  const lbImg = document.getElementById("faqLightboxImg");
  lbImg.src = img.src;
  lbImg.alt = img.alt || "";
  lb.classList.add("show");
  document.addEventListener("keydown", faqLightboxEscHandler);
}
function closeFaqLightbox() {
  document.getElementById("faqLightbox").classList.remove("show");
  document.removeEventListener("keydown", faqLightboxEscHandler);
}
function faqLightboxEscHandler(e) {
  if (e.key === "Escape") closeFaqLightbox();
}

function faqShotFallback(img, caption) {
  var wrap = img.closest(".faq-shot");
  if (!wrap || wrap.dataset.fallbackApplied) return;
  wrap.dataset.fallbackApplied = "1";
  wrap.classList.add("faq-shot-missing");
  wrap.textContent = caption || "Screenshot coming soon";
}

// ============================== EXPAND / COLLAPSE ==============================
function faqExpandAll() {
  document.querySelectorAll(".faq-item").forEach(function (d) {
    d.open = true;
  });
}
function faqCollapseAll() {
  document.querySelectorAll(".faq-item").forEach(function (d) {
    d.open = false;
  });
}

// ============================== SEARCH FILTER ==============================
// Plain substring filter across each question + answer. Matching items stay as <details>
// (so a single hit can still be expanded by hand); non-matching items are hidden outright
// rather than just collapsed, so scanning a filtered list doesn't require skipping past
// shut accordions that don't match anyway. Sections with zero surviving items are hidden
// too, so the section headers themselves don't dangle above empty space. Same idea one
// level down for .faq-subgroup (currently just "Advanced Settings" inside Tips & Tricks):
// without this, filtering to a query that only matches an item elsewhere in the section left
// the subgroup's own heading + intro paragraph stranded above nothing, since those aren't
// .faq-item elements themselves and so were never hidden by the loop above.
function faqFilter(query) {
  var q = query.trim().toLowerCase();
  var anyVisible = false;
  faqClearHighlights();
  document.querySelectorAll(".faq-section").forEach(function (section) {
    var items = section.querySelectorAll(".faq-item");
    var sectionHasMatch = false;
    items.forEach(function (item) {
      var text = item.textContent.toLowerCase();
      var match = !q || text.indexOf(q) !== -1;
      item.hidden = !match;
      if (match) {
        sectionHasMatch = true;
        anyVisible = true;
      }
      if (q && match) {
        item.open = true;
        faqHighlightMatches(item, q);
      }
      if (!q) item.open = false;
    });
    section.style.display = q && !sectionHasMatch ? "none" : "";
    section.querySelectorAll(".faq-subgroup").forEach(function (group) {
      var groupHasMatch = !!group.querySelector(".faq-item:not([hidden])");
      group.style.display = q && !groupHasMatch ? "none" : "";
    });
  });
  document
    .getElementById("faqNoResults")
    .classList.toggle("show", !!q && !anyVisible);
  var clearBtn = document.getElementById("faqSearchClear");
  if (clearBtn) clearBtn.hidden = !q;
}
// Mouse/tap equivalent of selecting the box and pressing Backspace — clears the input, re-runs
// the filter (faqFilter("") also collapses every item back and hides the clear button itself),
// and returns focus to the box so typing a new search picks up right where clearing left off.
function faqClearSearch() {
  var input = document.getElementById("faqSearch");
  if (!input) return;
  input.value = "";
  faqFilter("");
  input.focus();
}

// ============================== SEARCH HIGHLIGHTING ==============================
// Wraps every on-page match of the current query in <mark class="faq-hl">, inside both the
// summary and the answer body, so a hit is visible without having to re-read the whole item.
// mark.faq-hl (css/faq.css) is a fixed yellow/black pair rather than one of the theme's own
// accent-* vars, specifically so the combination passes WCAG AAA (>=7:1) contrast in every
// theme this page ships — Dark and Light — without having to re-verify the ratio every time
// an accent color changes. See the comment on that rule for the actual contrast math.
function faqEscapeForRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function faqClearHighlights() {
  document.querySelectorAll("mark.faq-hl").forEach(function (mark) {
    var parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  });
}
function faqHighlightMatches(root, query) {
  if (!query) return;
  var re = new RegExp(faqEscapeForRegExp(query), "gi");
  var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: function (node) {
      var p = node.parentNode;
      if (p && (p.nodeName === "SCRIPT" || p.nodeName === "STYLE"))
        return NodeFilter.FILTER_REJECT;
      // Every question's <summary> is a flex row (the arrow icon needs `justify-content:
      // space-between`) with its own `gap`. A flex container turns each contiguous run of
      // sibling inline content into its own anonymous flex item, so wrapping a mid-string match
      // in a real <mark> element splits one run of question text into three flex items (text
      // before, the mark, text after) — and the row's `gap` then lands between all of them,
      // shoving the highlighted word away from its neighbors. Skipping any text node whose
      // parent is itself a flex/inline-flex container sidesteps that everywhere it could occur,
      // not just in <summary>, at the cost of leaving a match in the question text unhighlighted
      // (it's still highlighted in the answer body right below).
      var cs = p && p.nodeType === 1 ? getComputedStyle(p) : null;
      if (cs && (cs.display === "flex" || cs.display === "inline-flex"))
        return NodeFilter.FILTER_REJECT;
      re.lastIndex = 0;
      return re.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  var targets = [];
  var n;
  while ((n = walker.nextNode())) targets.push(n);
  targets.forEach(function (node) {
    var text = node.nodeValue;
    var frag = document.createDocumentFragment();
    var lastIndex = 0;
    var m;
    re.lastIndex = 0;
    while ((m = re.exec(text))) {
      if (m.index > lastIndex)
        frag.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
      var mark = document.createElement("mark");
      mark.className = "faq-hl";
      mark.textContent = m[0];
      frag.appendChild(mark);
      lastIndex = m.index + m[0].length;
    }
    if (lastIndex < text.length)
      frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    node.parentNode.replaceChild(frag, node);
  });
}

// ============================== THEMED SCREENSHOTS ==============================
// Optional light-mode variant per screenshot: any .faq-shot img tagged with data-shot-base
// (every screenshot except the dedicated theme-dark/theme-light comparison shots, which must
// always show their fixed subject regardless of the reader's own theme)
// gets swapped to "<base>-light.webp" when the page is in Light theme, IF that file exists,
// and back to the plain "<base>.webp" dark-captured default otherwise. Dropping in
// "<base>-light.webp" for a shot is all it takes to start showing it to Light-theme readers,
// same self-serve "just add the file" pattern screenshots/README.md already documents for the
// base images themselves. Runs both at load (matching whatever theme the bootstrap already
// applied) and after a manual toggle via faqSetTheme, so switching back to Dark mid-visit
// reverts any shot that had been swapped to its light variant rather than leaving it stuck.
// Probing with a throwaway Image() (rather than pointing the real <img> at the light path
// directly) means a missing light variant never touches the real img's own
// onerror/faqShotFallback — the visible screenshot just silently stays on the existing
// dark-captured default.
function faqApplyThemedShots() {
  var isLight =
    document.documentElement.getAttribute("data-theme") === "light";
  document
    .querySelectorAll(".faq-shot img[data-shot-base]")
    .forEach(function (img) {
      var darkSrc = "screenshots/" + img.dataset.shotBase + ".webp";
      if (!isLight) {
        img.src = darkSrc;
        return;
      }
      var lightSrc = "screenshots/" + img.dataset.shotBase + "-light.webp";
      var probe = new Image();
      probe.onload = function () {
        img.src = lightSrc;
      };
      probe.src = lightSrc;
    });
}

// ============================== SETTINGS PANEL (Theme + Text Size + Icon Style) ==============================
// Persists into the same trivRev6_prefs localStorage key the main app reads/writes — only the
// theme, iconStyle, and sizeIndex fields are ever touched here, and every write merges onto
// whatever is already stored, so a theme, size, or icon-style change made from this page
// carries over the next time either the FAQ or the main app is opened (and vice versa), the
// same two-way match the theme bootstrap in js/faq-bootstrap.js already gives for free.
// FONT_SIZES/DEFAULT_SI are kept identical to the main Scorekeeper app's own copy (js/app.js
// there) so both pages resolve the same sizeIndex to the same pixel size.
const FAQ_PREFS_KEY = "trivRev6_prefs";
// Both this array and FAQ_DEFAULT_SI are shared with the main app (js/shared-ui.js's
// SHARED_FONT_SIZES/SHARED_DEFAULT_SIZE_INDEX) — same sizes, same default, so kept in one place
// instead of two copies of the same 14 numbers.
const FAQ_FONT_SIZES = SHARED_FONT_SIZES;
const FAQ_DEFAULT_SI = SHARED_DEFAULT_SIZE_INDEX;

function faqLoadPrefs() {
  try {
    const r = window.localStorage.getItem(FAQ_PREFS_KEY);
    if (r) return JSON.parse(r);
  } catch (e) {}
  return {};
}
function faqSavePrefs(p) {
  try {
    window.localStorage.setItem(FAQ_PREFS_KEY, JSON.stringify(p));
  } catch (e) {}
}
// ============================== ICON STYLE (pictograph / emoji) ==============================
// Same Settings > Icon Style toggle as the main app (js/app.js's applyIconStyle), same shared
// "iconStyle" field in the trivRev6_prefs key, so a choice made on either page carries over to
// the other. The main app can reassign its ICON_* variables in place because every icon there is
// built into a template literal at render time; every pictograph on THIS page is static markup
// that's already in the DOM at load, so the mechanism here is a DOM swap instead: every svg this
// page draws is tagged data-emoji="<the emoji it replaced>" (see index.html), and toggling to
// "emoji" replaces each one with a plain text span carrying that emoji, caching the original
// svg's own outerHTML on the span (span.dataset.pict) so toggling back can restore the exact
// element rather than needing a second copy of every icon's markup kept in this file.
function faqApplyIconStyle(style) {
  const emoji = style === "emoji";
  if (emoji) {
    document.querySelectorAll("svg[data-emoji]").forEach((svg) => {
      const e = svg.getAttribute("data-emoji");
      const span = document.createElement("span");
      span.className = "faq-emoji-ph";
      span.setAttribute("aria-hidden", svg.getAttribute("aria-hidden") || "true");
      span.dataset.pict = svg.outerHTML;
      span.textContent = e;
      svg.replaceWith(span);
    });
  } else {
    document.querySelectorAll("span.faq-emoji-ph").forEach((span) => {
      const tmp = document.createElement("div");
      tmp.innerHTML = span.dataset.pict;
      const svg = tmp.firstElementChild;
      if (svg) span.replaceWith(svg);
    });
  }
  // The toggle button's own beer-mug icon is a literal preview of the choice it makes — same
  // reasoning as the main app's iconStyleToggle (js/app.js) swapping ICON_BEER_PICT/_EMOJI on
  // itself. That icon is one of the svg[data-emoji] elements the sweep above already swapped;
  // only the trailing label (its own span, not the button's textContent) needs updating here, so
  // this doesn't clobber the icon the way overwriting the whole button's text would.
  const label = document.getElementById("faqIconStyleLabel");
  if (label) label.textContent = emoji ? "Emoji" : "Pictograph";
}
function faqSetIconStyle(style) {
  const p = faqLoadPrefs();
  p.iconStyle = style === "emoji" ? "emoji" : "pictograph";
  faqSavePrefs(p);
  faqApplyIconStyle(p.iconStyle);
}
function faqToggleIconStyle() {
  const p = faqLoadPrefs();
  faqSetIconStyle(p.iconStyle === "emoji" ? "pictograph" : "emoji");
}

function faqApplyDisplayPrefs() {
  const p = faqLoadPrefs();
  // Same "hc-light"/"hc-dark" legacy recognition as faq-bootstrap.js's own copy of this check
  // (see its comment) — this one runs again after that pre-paint pass, off the same raw,
  // still-unmigrated stored value, so it needs the same fallback or a real returning visitor's
  // Light preference would flip to Dark right back on this second read.
  const theme = ["dark", "light"].includes(p.theme)
    ? p.theme
    : ["light", "bw", "hc-light"].includes(p.theme)
      ? "light"
      : "dark";
  document.documentElement.setAttribute("data-theme", theme);
  const tb = document.getElementById("faqThemeToggle");
  // Same drawn-pictograph/emoji pair Icon Style swaps everywhere else on this page (data-emoji
  // tag + faqApplyIconStyle below, which runs right after this and converts it if the saved
  // style is "emoji") — this button used to be hardcoded plain-text emoji, the one pictograph on
  // the page Icon Style couldn't reach. 🌙 (crescent), not 🌑 (new moon, a plain dark circle with
  // no crescent shape at all) — matches the main app's own THEME_ICON_MOON_EMOJI.
  if (tb)
    tb.innerHTML =
      theme === "light"
        ? FAQ_THEME_SUN_SVG + " Light"
        : FAQ_THEME_MOON_SVG + " Dark";
  faqApplyIconStyle(p.iconStyle === "emoji" ? "emoji" : "pictograph");
  const si = Math.max(
    0,
    Math.min(FAQ_FONT_SIZES.length - 1, p.sizeIndex ?? FAQ_DEFAULT_SI),
  );
  document.documentElement.style.fontSize = FAQ_FONT_SIZES[si] + "px";
  const sr = document.getElementById("faqSizeResetBtn");
  if (sr) sr.textContent = si === FAQ_DEFAULT_SI ? "A" : FAQ_FONT_SIZES[si] + "px";
}
function faqAdjustFontSize(d) {
  const p = faqLoadPrefs();
  if (d === 0) p.sizeIndex = FAQ_DEFAULT_SI;
  else
    p.sizeIndex = Math.max(
      0,
      Math.min(FAQ_FONT_SIZES.length - 1, (p.sizeIndex ?? FAQ_DEFAULT_SI) + d),
    );
  faqSavePrefs(p);
  faqApplyDisplayPrefs();
}
// Manual override for the Theme row: same "read current data-theme, flip it" toggle as the
// main app's toggleTheme() (js/app.js), not a re-derive from stored prefs — the bootstrap
// script (js/faq-bootstrap.js) already resolved a missing/invalid stored theme down to
// "dark" before first paint, so the live attribute is always the correct starting point.
function faqSetTheme(t) {
  if (!["dark", "light"].includes(t)) t = "dark";
  const p = faqLoadPrefs();
  p.theme = t;
  faqSavePrefs(p);
  faqApplyDisplayPrefs();
  faqApplyThemedShots();
}
function faqToggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  faqSetTheme(current === "light" ? "dark" : "light");
}
function faqToggleSettings() {
  const panel = document.getElementById("faqSettingsPanel");
  const btn = document.getElementById("faqSettingsToggleBtn");
  if (!panel) return;
  const willOpen = !panel.classList.contains("settings-visible");
  panel.classList.toggle("settings-visible", willOpen);
  btn?.setAttribute("aria-expanded", String(willOpen));
  btn?.classList.toggle("active", willOpen);
}
function faqCloseSettingsPanel() {
  document.getElementById("faqSettingsPanel")?.classList.remove("settings-visible");
  const btn = document.getElementById("faqSettingsToggleBtn");
  btn?.setAttribute("aria-expanded", "false");
  btn?.classList.remove("active");
}
document.addEventListener("click", (e) => {
  if (
    !e.target.closest("#faqSettingsPanel") &&
    !e.target.closest("#faqSettingsToggleBtn")
  )
    faqCloseSettingsPanel();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    faqCloseSettingsPanel();
  }
  // "/" focuses search, same shortcut GitHub/most search-heavy sites use — skipped while
  // already typing into any text field (this page's own search box included: without the
  // isContentEditable/tagName guard, typing a literal "/" as part of a search query would
  // instead yank focus right back to the box it's already in) or with a modifier held (so
  // Cmd+/ and friends, if the browser or an extension binds them to something else, aren't
  // hijacked).
  if (
    e.key === "/" &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.altKey &&
    !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName) &&
    !document.activeElement?.isContentEditable
  ) {
    const box = document.getElementById("faqSearch");
    if (box) {
      e.preventDefault();
      box.focus();
      box.select();
    }
  }
});

// A URL like faq/index.html?q=wager arrives pre-filtered and focused on the match — lets the
// app itself (a tooltip, an error message, a future "?" hint) link straight into a topic
// instead of only ever opening the FAQ cold and making the reader search it themselves.
function faqApplyQueryParam() {
  const q = new URLSearchParams(location.search).get("q");
  if (!q) return;
  const box = document.getElementById("faqSearch");
  if (!box) return;
  box.value = q;
  faqFilter(q);
  box.focus();
}

// Every .faq-item now carries its own id, so a link can point straight at one answer — but the
// browser's own fragment-target auto-reveal only opens a closed <details> that's an ANCESTOR of
// the targeted element, not one that IS the target itself (checked directly: navigating to
// #<details-id> leaves that <details>.open === false, even though :target correctly matches
// it). So the one thing that native behavior doesn't cover — actually opening the id'd
// <details> itself, not just scrolling to its closed shell — needs doing by hand here.
function faqOpenLinkedItem() {
  const id = location.hash.slice(1);
  if (!id) return;
  const el = document.getElementById(id);
  if (el && el.classList.contains("faq-item")) el.open = true;
}

faqApplyDisplayPrefs();
faqApplyThemedShots();
faqApplyQueryParam();
faqOpenLinkedItem();
window.addEventListener("hashchange", faqOpenLinkedItem);
