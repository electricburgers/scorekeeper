// Dev-time lint only (npm run lint:css) — catches real CSS bugs (a genuine syntax error and a
// duplicate-property block were both found and fixed the first time this ran; see CHANGELOG).
// Everything disabled below is a deliberate, established convention in this codebase's own
// dense, heavily-commented style, not a mistake — forcing stylelint-config-standard's full
// formatting ruleset onto it would produce a wall of pure-reformatting noise for zero real bugs
// caught, which defeats the point of having a linter at all.
module.exports = {
  extends: "stylelint-config-standard",
  rules: {
    // This codebase's own style: one rule per line, every declaration packed onto that one
    // line with no blank lines between them or extra whitespace around values — consistent
    // throughout css/styles.css, faq/css/faq.css, css/tutorial.css. All formatting-only.
    "comment-empty-line-before": null,
    "custom-property-empty-line-before": null,
    "declaration-empty-line-before": null,
    "rule-empty-line-before": null,
    "at-rule-empty-line-before": null,
    "declaration-block-single-line-max-declarations": null,
    // Ids/classes are named to match their JS getElementById()/className usage
    // (camelCase ids like #faqSettingsPanel, hyphenated classes like .faq-item) — a real,
    // intentional convention, not inconsistent casing to "fix".
    "selector-id-pattern": null,
    "selector-class-pattern": null,
    "custom-property-pattern": null,
    "keyframes-name-pattern": null,
    // Modern color/value notation preferences (rgb(0 0 0 / 12%) over rgba(), 16% over .16,
    // #fe0 over #ffee00) — purely stylistic, and repainting every color value in the file for
    // this would be a huge diff for zero behavior change.
    "color-function-notation": null,
    "alpha-value-notation": null,
    "color-hex-length": null,
    "value-keyword-case": null,
    "media-feature-range-notation": null,
    "shorthand-property-no-redundant-values": null,
    "font-family-name-quotes": null,
    "import-notation": null,
    // -webkit-/-moz- prefixes here are load-bearing, not legacy cruft — e.g. .header's
    // -webkit-transform pairs with a documented iOS Safari sticky-position compositing bug,
    // and the number-input spinner prefixes are still what actually hides those controls in
    // real current Safari/Firefox. Removing them would reintroduce the bugs the prefixes exist
    // to fix, not clean anything up.
    "property-no-vendor-prefix": null,
    "value-no-vendor-prefix": null,
    // e.g. .aud-wager appearing twice with different single properties each time, always with
    // a comment explaining why it's split — already the codebase's own established pattern for
    // "this later rule adds one more thing, on purpose" (see css/styles.css's own comments at
    // each site) rather than an accidental duplicate.
    "no-descending-specificity": null,
    "no-duplicate-selectors": null,
    // Same reasoning as vendor prefixes: this app explicitly supports older Safari, which
    // doesn't parse the newer comma-separated :not(.a, .b) form these two rules would ask for
    // in place of :not(.a):not(.b) / longhand overflow-x+overflow-y / inset / flex-flow / gap.
    "selector-not-notation": null,
    "declaration-block-no-redundant-longhand-properties": null,
  },
};
