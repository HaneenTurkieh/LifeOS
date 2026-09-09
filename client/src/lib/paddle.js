// client/src/lib/paddle.js
//
// DEPRECATED — Paddle was removed as Nuvora's payment processor in Sept
// 2026 (account verification was rejected with no reason given, and
// bank transfer is now the only way to pay). Nothing imports this file
// anymore — the Paddle.js <script> tag was also removed from index.html,
// and both call sites (SettingsModal.jsx's PremiumTab, TreeShop.jsx) now
// go straight to the bank-transfer flow / a "not available yet" toast.
//
// Left in place as an inert stub rather than deleted, because this
// session has no way to delete files on disk — Haneen, feel free to
// delete this file entirely (client/src/lib/paddle.js) next time you're
// in the repo.

export function setPaddleEventHandler() {}
export function ensurePaddleInitialized() { return false; }
