/* SHARED UI — logic identical between the main app (js/app.js, index.html) and the FAQ
   (faq/js/faq.js, faq/index.html), loaded as a plain <script> by both pages before their own.

   Both pages read/write the same `trivRev6_prefs` localStorage key and share the font-size
   scale below, so it lives here once instead of as two copy-pasted twins (FONT_SIZES /
   FAQ_FONT_SIZES). The Color Vision dropdown that used to be shared here as well was removed
   from both pages in v19.59.

   Deliberately NOT extracted here: the rest of loadPrefs()/faqLoadPrefs() (the app's shape has
   many more gameplay-only fields the FAQ has no use for) and the Icon Style sweep (the app
   drives dozens of ICON_* template-literal variables from game state; the FAQ sweeps static
   svg[data-emoji] markup — different enough mechanisms that forcing them into one shared
   function would cost more clarity than the duplication it removed). Shared where the two are
   already identical, not forced where they aren't. */

// Both pages had this exact array under a differently-prefixed name (FONT_SIZES / FAQ_FONT_SIZES)
// — same 14 sizes, same DEFAULT_SI index (3 -> 15px), copy-pasted rather than shared.
const SHARED_FONT_SIZES = [
  12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 24, 26, 28, 30,
];
const SHARED_DEFAULT_SIZE_INDEX = 3;
