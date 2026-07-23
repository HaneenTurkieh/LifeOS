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
  const token = getToken();
  const res   = await fetch(`${BASE}${path}`, {
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
    try { detail = (await res.json()).error; } catch (_) {}
    throw new Error(detail || `Request failed (${res.status})`);
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