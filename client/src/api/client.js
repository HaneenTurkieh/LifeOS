const BASE      = window.location.hostname === 'localhost'
  ? 'http://localhost:4000/api'
  : 'https://lifeos-0l81.onrender.com/api';
const TOKEN_KEY = 'aurora_auth_token';

export function getToken()      { return localStorage.getItem(TOKEN_KEY); }
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else       localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token   = getToken();
  const doFetch = () => fetch(`${BASE}${path}`, {
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
  });

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
    // short delay almost always succeeds once it's awake.
    await new Promise((r) => setTimeout(r, 2500));
    res = await doFetch();
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