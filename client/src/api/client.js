// api/client.js
// Tiny fetch wrapper — keeps every page from repeating the same
// headers/error-handling boilerplate. The Vite dev server proxies
// "/api/*" to the Express backend (see vite.config.js).
//
// Auth: the JWT returned by /auth/login or /auth/register is stored in
// localStorage and automatically attached as a Bearer token on every
// request. A 401 response (expired/invalid token) clears the stored
// token and fires a window event so AuthContext can log the user out.

const BASE = 'https://lifeos-o181.onrender.com';
const TOKEN_KEY = 'aurora_auth_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });

  if (res.status === 401) {
    setToken(null);
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
  }

  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).error; } catch (_) { /* ignore */ }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path) => request(path, { method: 'DELETE' }),
};