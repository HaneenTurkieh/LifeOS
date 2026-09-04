import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, getToken, setToken } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Restore session on mount ──────────────────────────────────
  const restoreSession = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user: me } = await api.get('/auth/me');
      setUser(me);
    } catch (err) {
      // Real bug that used to live here: ANY failure — a genuinely
      // expired/invalid token, but also a transient network error, or
      // Render's free tier still waking up even after api/client.js's own
      // one-time retry — cleared the token and logged the user out. A
      // blip during initial load shouldn't discard a perfectly valid
      // session. Only a real 401 means the token itself was rejected;
      // client.js already clears it and fires auth:unauthorized for that
      // case (see the listener below), so this only needs to handle it
      // here too for the very first load (before any other request has
      // had a chance to trigger that event). Anything else leaves the
      // token in place — `user` just stays null for this load, and the
      // next successful request (or a refresh) can recover normally
      // instead of forcing a fresh login over a flaky connection.
      if (err?.status === 401) {
        setToken(null);
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
    const handler = () => { setToken(null); setUser(null); };
    window.addEventListener('auth:unauthorized', handler);
    return () => window.removeEventListener('auth:unauthorized', handler);
  }, [restoreSession]);

  // ── Auth actions ──────────────────────────────────────────────
  const login = async (email, password) => {
    const { token, user: u } = await api.post('/auth/login', { email, password });
    setToken(token);
    setUser(u);
    return u;
  };

  const register = async (name, email, password) => {
    const { token, user: u, welcomeXp } = await api.post('/auth/register', { name, email, password });
    setToken(token);
    setUser(u);
    return { ...u, welcomeXp: welcomeXp || 0 };
  };

  // Instructor signup path — no password from the person, the server
  // generates one and emails it (see routes/auth.js POST
  // /register-instructor). Still logs them straight in on top of that.
  const registerInstructor = async (name, email) => {
    const { token, user: u, welcomeXp, emailSent } = await api.post('/auth/register-instructor', { name, email });
    setToken(token);
    setUser(u);
    return { ...u, welcomeXp: welcomeXp || 0, emailSent };
  };

  // `credential` is the ID token Google's Identity Services library hands
  // back client-side (see Login.jsx) — the server verifies it and either
  // logs into an existing account with that email or creates a new one.
  // `intent` ('login' | 'signup') tells the server which screen the
  // button was on: 'login' rejects unknown emails instead of silently
  // registering them (see routes/auth.js POST /google).
  const loginWithGoogle = async (credential, intent) => {
    const { token, user: u, welcomeXp } = await api.post('/auth/google', { credential, intent });
    setToken(token);
    setUser(u);
    return { ...u, welcomeXp: welcomeXp || 0 };
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const deleteAccount = async () => {
    await api.del('/auth/me');
    setToken(null);
    setUser(null);
  };

  // ── Profile actions ───────────────────────────────────────────
  const updateUser = async (fields) => {
    const { user: updated } = await api.patch('/auth/me', fields);
    setUser(updated);
    return updated;
  };

  const changePassword = async (currentPassword, newPassword) => {
    return api.post('/auth/me/password', { currentPassword, newPassword });
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      register,
      registerInstructor,
      loginWithGoogle,
      logout,
      deleteAccount,
      updateUser,
      changePassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}