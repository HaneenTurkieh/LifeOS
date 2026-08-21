// utils/pushNotifications.js — client-side half of real push
// notifications (server half: server/lib/push.js, server/routes/push.js).
import { api } from '../api/client.js';

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

// iOS Safari only exposes PushManager at all — even the API existing —
// once the site has been added to the Home Screen (iOS 16.4+); a
// regular Safari tab makes pushSupported() above correctly return
// false, but that reads as "this phone can't do it" when the real
// story is "it can, once installed". Used to swap in a more useful,
// actionable message than a flat "not supported" for this one specific
// case.
export function isIos() {
  if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) return true;
  // Safari's per-site "Request Desktop Website" rewrites the UA on
  // iPhone/iPad to look byte-for-byte like a real Mac's — the one thing
  // it can't fake is touch support, since an actual Mac trackpad never
  // reports more than 0-1 touch points this way. Without this, anyone
  // who'd toggled desktop-site mode for Nuvora (easy to do by accident,
  // and it's remembered per-domain) saw a flat "not supported in this
  // browser" instead of the actual fix (open Settings > Aa > Request
  // Mobile Website, or just add to Home Screen and reopen from there).
  return /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
}
export function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

// pushManager.subscribe wants the VAPID public key as a raw Uint8Array,
// not the base64url string the server hands back — this is the
// standard conversion (padding restored, URL-safe chars swapped back)
// used basically everywhere Web Push is implemented.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// Current subscription for THIS device/browser, if any — not "does
// this account have push enabled anywhere", just this one. Returns
// null if never subscribed here or the browser doesn't support push.
export async function getCurrentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

// Full opt-in flow: register the service worker (idempotent — safe to
// call even if already registered), request the browser's native
// permission prompt (must be called from a real user gesture, e.g. a
// button's onClick — browsers silently ignore this if called on page
// load with no interaction), subscribe, and tell the server about it.
export async function enablePush() {
  if (!pushSupported()) {
    throw new Error('Push notifications aren\'t supported in this browser.');
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  const { publicKey } = await api.get('/push/vapid-public-key');
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const json = subscription.toJSON();
  await api.post('/push/subscribe', { endpoint: json.endpoint, keys: json.keys });
  return subscription;
}

// Turns push off for THIS device — unsubscribes locally and tells the
// server so the cron job stops trying to send to it.
export async function disablePush() {
  const subscription = await getCurrentSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await api.post('/push/unsubscribe', { endpoint });
}
