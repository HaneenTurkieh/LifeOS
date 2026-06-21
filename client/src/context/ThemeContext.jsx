import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'aurora_theme';
const MODES = ['light', 'dark', 'system'];

function getSystemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyResolvedTheme(isDark) {
  const root = document.documentElement;
  root.classList.toggle('dark', isDark);
  const meta = document.getElementById('theme-color-meta');
  if (meta) meta.setAttribute('content', isDark ? '#0c0a1a' : '#F4F6FB');
}

export function ThemeProvider({ children }) {
  // `mode` is what the user picked: 'light' | 'dark' | 'system'.
  const [mode, setModeState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return MODES.includes(stored) ? stored : 'system';
  });

  // `resolvedTheme` is what's actually applied right now ('light' | 'dark') —
  // useful for components that want to render something theme-aware
  // (e.g. an icon) without caring whether that came from an explicit
  // choice or from following the OS.
  const [resolvedTheme, setResolvedTheme] = useState(() =>
    mode === 'dark' || (mode === 'system' && getSystemPrefersDark()) ? 'dark' : 'light'
  );

  // Apply whenever `mode` changes.
  useEffect(() => {
    const isDark = mode === 'dark' || (mode === 'system' && getSystemPrefersDark());
    applyResolvedTheme(isDark);
    setResolvedTheme(isDark ? 'dark' : 'light');
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  // Live-react to OS theme changes while mode === 'system', no refresh needed.
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      if (mode !== 'system') return;
      applyResolvedTheme(e.matches);
      setResolvedTheme(e.matches ? 'dark' : 'light');
    };
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, [mode]);

  const setMode = useCallback((next) => {
    if (MODES.includes(next)) setModeState(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, setMode, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside a ThemeProvider');
  return ctx;
}