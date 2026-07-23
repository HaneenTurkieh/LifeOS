import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'aurora_theme';
const MODES       = ['light', 'dark', 'system'];

function getSystemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveIsDark(mode) {
  if (mode === 'dark')   return true;
  if (mode === 'light')  return false;
  return getSystemPrefersDark(); // 'system'
}

function applyTheme(isDark) {
  // Runs synchronously — no flash
  document.documentElement.classList.toggle('dark', isDark);
  const meta = document.getElementById('theme-color-meta');
  if (meta) meta.setAttribute('content', isDark ? '#0c0a1a' : '#F4F6FB');
}

// ── Apply theme BEFORE first React render ─────────────────────
// This runs immediately when the module is imported,
// eliminating the white flash entirely.
(function initTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const mode   = MODES.includes(stored) ? stored : 'system';
    applyTheme(resolveIsDark(mode));
  } catch (_) {
    // localStorage blocked (private mode etc.) — fall back to system
    applyTheme(getSystemPrefersDark());
  }
})();

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return MODES.includes(stored) ? stored : 'system';
    } catch (_) { return 'system'; }
  });

  const [resolvedTheme, setResolvedTheme] = useState(() =>
    resolveIsDark(mode) ? 'dark' : 'light'
  );

  // Apply + persist whenever mode changes
  useEffect(() => {
    const isDark = resolveIsDark(mode);
    applyTheme(isDark);
    setResolvedTheme(isDark ? 'dark' : 'light');
    try { localStorage.setItem(STORAGE_KEY, mode); } catch (_) {}
  }, [mode]);

  // Live-react to OS changes when mode === 'system'
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      if (mode !== 'system') return;
      applyTheme(e.matches);
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
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}