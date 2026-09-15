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
  // Real bug this fixes: every request shared the same flat 20s ceiling,
  // which is plenty for ordinary CRUD calls but not for POST /chat — Lumi
  // can run up to 6 sequential tool-calling round-trips per turn (see
  // routes/chat.js), and real-world OpenRouter/DeepSeek latency can push
  // even a single one of those past 20s on a slow day. When that happened
  // the client gave up and showed a generic error while the server was
  // often still legitimately working — and since nothing on the server
  // side ever actually threw, it never showed up in the admin "Recent
  // failures" log either, which is what made this so hard to diagnose
  // from a screenshot alone. `timeoutMs` lets a specific caller (see
  // AITools.jsx's chatTimeoutMs) opt into a longer ceiling without
  // loosening the default for everything else, which should still fail
  // fast.
  const { timeoutMs = 20000, ...fetchOptions } = options;
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
    ...fetchOptions,
  }, timeoutMs);

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

// Streaming (SSE) request — used only by POST /chat now (see
// server/routes/chat.js + server/lib/openrouter.js for the wire protocol:
// `data: {type:'delta'|'done'|'error', ...}\n\n` frames). Separate from
// request() above because that one reads a single res.json() and returns;
// this one has to read the body incrementally and hand pieces to the
// caller as they arrive, via callbacks instead of a return value.
//
// Sept 2026: added alongside the server's move to streaming, replacing
// the old fixed chatTimeoutMs (120s/150s single-shot abort) that kept
// having to be re-tuned every time a slow-but-healthy Deep Think request
// legitimately needed longer than whatever ceiling was set. idleTimeoutMs
// here is an *idle* timeout instead — it resets on every chunk actually
// read off the stream, so it only fires on a genuine stall (no bytes at
// all for a while), never on a call that's simply taking a while to
// generate a long answer. Kept a bit above the server's own 60s idle
// timeout (see chat.js) so the server has first chance to notice and
// report a real stall before the client's own timer would.
//
// Not retried on a mid-stream drop, unlike the plain JSON path above —
// once part of the answer has already reached the caller and been shown
// to the user, retrying from scratch would duplicate/garble it. A drop
// before any bytes arrive at all (e.g. a sleeping Render instance's very
// first connection) still gets the same one retry the plain path gets,
// since nothing has been shown yet and a clean retry is safe.
export async function streamChat(path, body, { onDelta, onDone, onError, idleTimeoutMs = 70000 } = {}) {
  const token = getToken();
  const controller = new AbortController();
  let idleTimer = setTimeout(() => controller.abort(), idleTimeoutMs);
  const resetIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller.abort(), idleTimeoutMs);
  };

  const doFetch = () => fetch(`${BASE}${path}`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });

  let res;
  try {
    res = await doFetch();
  } catch (networkErr) {
    clearTimeout(idleTimer);
    if (networkErr.name === 'AbortError') {
      onError?.({ message: 'Nuvora is taking longer than usual to respond — please try again.', partial: false });
      return;
    }
    // Same cold-start allowance the plain JSON path gets above — nothing
    // has streamed yet, so one clean retry is safe.
    await new Promise((r) => setTimeout(r, 2500));
    idleTimer = setTimeout(() => controller.abort(), idleTimeoutMs);
    try {
      res = await doFetch();
    } catch (retryErr) {
      clearTimeout(idleTimer);
      const timedOut = retryErr?.name === 'AbortError';
      onError?.({
        message: timedOut
          ? 'Nuvora is taking longer than usual to respond — please try again.'
          : 'Network error — check your connection and try again.',
        partial: false,
      });
      return;
    }
  }

  if (res.status === 401) {
    setToken(null);
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
  }

  if (!res.ok) {
    // Validation/limit/API-key failures in chat.js all return before the
    // route ever switches to SSE (see its comments), so these are still
    // plain JSON error bodies exactly like the non-streaming path above.
    clearTimeout(idleTimer);
    let payload = {};
    try { payload = await res.json(); } catch (_) {}
    onError?.({ message: payload.error || `Request failed (${res.status})`, code: payload.code || null, partial: false });
    return;
  }

  let streamedAny = false;
  try {
    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      resetIdle();
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop();
      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith('data:')) continue;
        let evt;
        try { evt = JSON.parse(line.slice(5).trim()); } catch (_) { continue; }
        if (evt.type === 'delta') {
          streamedAny = true;
          onDelta?.(evt.text);
        } else if (evt.type === 'done') {
          clearTimeout(idleTimer);
          onDone?.(evt);
          return;
        } else if (evt.type === 'error') {
          clearTimeout(idleTimer);
          onError?.({ message: evt.message, partial: evt.partial ?? streamedAny });
          return;
        }
      }
    }
    // Stream ended without ever sending a 'done' or 'error' event — treat
    // it as a failure rather than leaving the caller waiting forever.
    clearTimeout(idleTimer);
    onError?.({
      message: streamedAny
        ? 'The connection to the AI provider dropped partway through the answer.'
        : 'Something went wrong. Please try again.',
      partial: streamedAny,
    });
  } catch (err) {
    clearTimeout(idleTimer);
    const timedOut = err?.name === 'AbortError';
    onError?.({
      message: timedOut
        ? (streamedAny
            ? 'The connection to the AI provider dropped partway through the answer.'
            : 'The AI provider took too long to respond.')
        : 'Network error — check your connection and try again.',
      partial: streamedAny,
    });
  }
}

export const api = {
  get:    (path, opts)       => request(path, opts),
  post:   (path, body, opts) => request(path, { method: 'POST',   body: JSON.stringify(body), ...opts }),
  put:    (path, body, opts) => request(path, { method: 'PUT',    body: JSON.stringify(body), ...opts }),
  patch:  (path, body, opts) => request(path, { method: 'PATCH',  body: JSON.stringify(body), ...opts }),
  del:    (path, opts)       => request(path, { method: 'DELETE', ...opts }),
  stream: streamChat,
};