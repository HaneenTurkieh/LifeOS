const BASE      = window.location.hostname === 'localhost'
  ? 'http://localhost:4000/api'
  : 'https://lifeos-0l81.onrender.com/api';
const TOKEN_KEY     = 'nuvora_auth_token';
const OLD_TOKEN_KEY  = 'aurora_auth_token'; // pre-rebrand key — read once, then migrated below

// Self-healing one-time migration: anyone already logged in has their
// token sitting under the old key. First read wins it over to the new
// key so every *subsequent* read (here and everywhere else that used to
// hardcode the old string) just works without needing its own fallback
// — nobody gets silently logged out by the rename.
export function getToken() {
  const current = localStorage.getItem(TOKEN_KEY);
  if (current) return current;
  const legacy = localStorage.getItem(OLD_TOKEN_KEY);
  if (legacy) {
    localStorage.setItem(TOKEN_KEY, legacy);
    localStorage.removeItem(OLD_TOKEN_KEY);
  }
  return legacy;
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else       localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(OLD_TOKEN_KEY);
}

// Real bug this fixes: a focus session finishing right as Render's free
// tier is asleep didn't fail fast — the very first request that wakes a
// sleeping instance can just sit there while the container boots, and
// plain `fetch()` has no built-in timeout, so it can hang for a very
// long time instead of throwing. The retry below only ever handled the
// case where the browser rejects the request outright; a genuine hang
// sailed straight past it and left whatever called this (e.g. the focus
// timer waiting on POST /focus/sessions to plant a tree) stuck showing
// its "saving..." state forever, since the promise it was awaiting
// simply never settled either way. AbortController gives every request
// a hard ceiling so it always settles one way or the other.
function fetchWithTimeout(url, options, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function request(path, options = {}) {
  const token   = getToken();
  const doFetch = () => fetchWithTimeout(`${BASE}${path}`, {
    // Safari is more aggressive than Chrome about heuristically caching
    // GET JSON responses when the server doesn't send explicit
    // Cache-Control headers — force every request to hit the network so
    // things like /focus/forest never render a stale snapshot.
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  }, 20000);

  let res;
  try {
    res = await doFetch();
  } catch (networkErr) {
    // Render's free tier sleeps after ~15 min idle. The very first
    // request to a sleeping instance can be rejected outright before
    // any CORS headers are attached — Safari surfaces this as "Fetch
    // API cannot load ... due to access control checks" instead of a
    // plain network error, which made it look like a browser bug when
    // it was really the backend still waking up. One retry after a
    // short delay almost always succeeds once it's awake. Also covers
    // the timeout case above (AbortError) — either way, one more try
    // with a fresh 20s ceiling of its own.
    await new Promise((r) => setTimeout(r, 2500));
    try {
      res = await doFetch();
    } catch (retryErr) {
      const timedOut = retryErr?.name === 'AbortError';
      throw new Error(timedOut
        ? 'Nuvora is taking longer than usual to respond — please try again.'
        : 'Network error — check your connection and try again.');
    }
  }

  if (res.status === 401) {
    setToken(null);
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
  }

  if (!res.ok) {
    let payload = {};
    try { payload = await res.json(); } catch (_) {}
    const err = new Error(payload.error || `Request failed (${res.status})`);
    // Preserved so callers can special-case things like a daily usage
    // cap (code: 'DAILY_LIMIT') instead of treating every failure as a
    // generic "something went wrong" — without this, that info was
    // thrown away and every 403 looked identical to a network error.
    err.status = res.status;
    err.code   = payload.code || null;
    throw err;
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get:   (path)       => request(path),
  post:  (path, body) => request(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:   (path, body) => request(path, { method: 'PUT',    body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  del:   (path)       => request(path, { method: 'DELETE' }),
};