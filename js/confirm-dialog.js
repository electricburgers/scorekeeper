"use strict";


// ===== THEMED CONFIRM / ALERT (replaces window.confirm()/alert()) =====
// window.confirm()/alert() render in the OS/browser's own fixed light popup style, no matter
// this app's Dark/Light theme — the one thing left that ignored it, and
// a jarring bright-white flash against a dark room's screen besides. Both return a Promise
// instead of blocking the thread the way the native calls do (impossible to replicate for a
// custom element — nothing in the DOM can pause script execution), so every call site that used
// to read confirm()'s return value directly now awaits this instead; appAlert's callers already
// only ever ran alert() for its side effect and never touched a return value, so those call
// sites needed no restructuring beyond the rename.
let confirmDialogResolve = null;
function showConfirmDialog(message, opts) {
  const modal = document.getElementById("confirmModal");
  const overlay = document.getElementById("confirmOverlay");
  document.getElementById("confirmMessage").textContent = message;
  const isAlert = !!(opts && opts.alert);
  modal.classList.toggle("confirm-alert", isAlert);
  const okBtn = document.getElementById("confirmOkBtn");
  okBtn.textContent = (opts && opts.okLabel) || (isAlert ? "OK" : "Confirm");
  // .btn-accent's background/color/border are !important (styles.css) specifically so it can
  // win against every OTHER .btn-* modifier a button might also carry — which meant just
  // toggling .btn-danger on top of okBtn's static "btn btn-accent" base class never actually
  // reddened anything: .btn-accent's solid cyan fill kept winning regardless, so every "danger"
  // confirm (Clear Session included) rendered as the same solid blue as a normal confirm, not
  // the red the danger flag was supposed to signal — and in Light theme that blue
  // (--accent-cyan-solid:#007ea8) read as a dark, out-of-place fill for what's meant to be a
  // destructive-action warning. Removing btn-accent for a danger confirm lets .btn-danger's
  // red border/text show against the button's plain default background instead, matching how
  // the "Clear Session" button itself already looks outside this dialog. Both classes are
  // explicitly set (not just toggled) since this same button is reused across every confirm()
  // call in the app — a later non-danger confirm must restore btn-accent, not just leave
  // whatever the previous call left behind.
  const danger = !!(opts && opts.danger);
  okBtn.classList.toggle("btn-danger", danger);
  okBtn.classList.toggle("btn-accent", !danger);
  document.getElementById("confirmCancelBtn").textContent =
    (opts && opts.cancelLabel) || "Cancel";
  overlay.classList.add("show");
  // Alert has no Cancel to reach, so OK is the sensible default focus; confirm defaults to
  // Cancel instead — every current confirm() call site guards a destructive or hard-to-undo
  // action (clearing a session, replacing loaded data), so an accidental Enter press should
  // never be the one that lands on the destructive option.
  (isAlert ? okBtn : document.getElementById("confirmCancelBtn")).focus();
  return new Promise((resolve) => {
    confirmDialogResolve = resolve;
  });
}
function confirmDialogRespond(result) {
  document.getElementById("confirmOverlay").classList.remove("show");
  const resolve = confirmDialogResolve;
  confirmDialogResolve = null;
  if (resolve) resolve(result);
}
// opts: {danger, okLabel, cancelLabel} — danger reddens the confirm button (btn-danger) for
// destructive actions, matching the app's existing red/danger styling elsewhere.
function appConfirm(message, opts) {
  return showConfirmDialog(message, opts);
}
// Resolves once OK is dismissed — nothing meaningful in the resolved value (there's only ever
// one way out), so callers that just want to keep going after the reader has seen the message
// can await it same as appConfirm, just without checking what it returns.
function appAlert(message) {
  return showConfirmDialog(message, { alert: true });
}
// Export & Data's own "Clear Session" button (below the already-custom Yes/No export prompt) —
// pulled out to a named function since an inline onclick="" attribute can't await a Promise.
async function confirmClearSession() {
  if (
    await appConfirm("Clear all data?", {
      danger: true,
      okLabel: "Clear Session",
    })
  )
    startNewGame();
}