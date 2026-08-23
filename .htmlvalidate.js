// Dev-time lint only (npm run lint:html) — html-validate:recommended is tuned for XHTML-style
// strictness (every void element self-closed a specific way, every <option>/<li>/<tr> given an
// explicit end tag, every <button> stamped type="button") that HTML5 has never required and
// this app's own markup doesn't follow. The four rules turned off below accounted for ~470 of
// the ~480 findings on the first real run here — all style preference, zero real bugs — so
// disabling them is what keeps this actually usable for catching genuine markup problems
// (a mismatched tag, a duplicate id, an invalid attribute) instead of drowning them in noise.
module.exports = {
  extends: ["html-validate:recommended"],
  rules: {
    // <option>, <li>, <tr>, <td> and friends have optional end tags in real HTML5 — this repo
    // relies on that throughout (every <option> in index.html's location datalist, for one).
    "no-implicit-close": "off",
    // <img/> vs <img> is a no-op stylistic choice for a void element either way; this repo
    // isn't consistent about it and there's no real reason it needs to be.
    "void-style": "off",
    // type="button" only matters inside a <form> (defaulting to type="submit" there); this app
    // has no <form> elements anywhere — everything is driven by onclick handlers against
    // JS-managed state — so there's no submit-on-accidental-Enter risk this guards against here.
    "no-implicit-button-type": "off",
    // Flags role="button"/role="listbox" custom elements as "prefer the native tag instead" —
    // but the Color Vision dropdown (role="listbox") needs per-option swatch-pair previews a
    // native <select><option> can't render, and role="button" section headers/team names carry
    // icon+text+chevron layouts a real <button> would fight just as hard to lay out. Both are
    // deliberate, correctly-ARIA'd custom widgets, not native elements someone forgot to use.
    "prefer-native-element": "off",
  },
};
