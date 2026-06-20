import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, getToken, setToken } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true while we check for an existing session

  // On first load, if a token is already stored, verify it's still valid
  // and hydrate the user — this is what keeps you logged in after a refresh.
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
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();

    // If any API call comes back 401 (expired/invalid token), the api
    // client clears the token and fires this event — react to it by
    // logging the user out everywhere in the app at once.
    const handleUnauthorized = () => setUser(null);
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [restoreSession]);

  const login = async (email, password) => {
    const { token, user: loggedInUser } = await api.post('/auth/login', { email, password });    setToken(token);
    setUser(loggedInUser);
    return loggedInUser;
  };

  const register = async (name, email, password) => {
    const { token, user: newUser } = await api.post('/auth/register', { name, email, password });
    setToken(token);
    setUser(newUser);
    return newUser;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider');
  return ctx;
}