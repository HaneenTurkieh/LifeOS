// client/src/lib/paddle.js
//
// Shared Paddle.js singleton init — extracted out of SettingsModal.jsx so
// TreeShop.jsx (premium tree/collection checkout) can reuse the exact same
// initialized instance instead of each caller trying to Paddle.Initialize()
// independently. Paddle.Initialize() must only ever be called once for the
// whole page, no matter how many different checkout flows the app has.
//
// Paddle.js itself is loaded via a <script> tag in index.html, so
// window.Paddle may not exist yet the instant any caller mounts.

let paddleInitialized = false;
let paddleEventHandler = null;

function paddleEventDispatch(event) { paddleEventHandler?.(event); }

// Whoever is currently listening for checkout events (a mounted
// PremiumTab, or the tree shop) registers here. Only one listener at a
// time is expected — same single-checkout-flow-open-at-once assumption
// the rest of this Paddle integration already makes.
export function setPaddleEventHandler(fn) {
  paddleEventHandler = fn;
}

export function ensurePaddleInitialized() {
  if (paddleInitialized) return true;
  if (!window.Paddle) return false;
  const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
  if (!token) return false; // not configured yet — checkout button will no-op with a toast
  window.Paddle.Initialize({ token, eventCallback: paddleEventDispatch });
  paddleInitialized = true;
  return true;
}
