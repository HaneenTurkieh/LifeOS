import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const ThemeContext = createContext(null);
const STORAGE_KEY        = 'aurora_theme';
const ACCENT_STORAGE_KEY = 'aurora_accent';
const MODES   = ['light', 'dark', 'system'];
export const ACCENTS = ['purple', 'orange', 'pink', 'blue'];

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
function applyAccent(preset) {
  // Runs synchronously — same anti-flash approach as applyTheme.
  // Default (purple) has no attribute — root CSS vars already are purple.
  if (preset && preset !== 'purple' && ACCENTS.includes(preset)) {
    document.documentElement.setAttribute('data-accent', preset);
  } else {
    document.documentElement.removeAttribute('data-accent');
  }
}

// ── Apply theme + accent BEFORE first React render ─────────────
// This runs immediately when the module is imported,
// eliminating the white flash / wrong-color flash entirely.
(function initTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const mode   = MODES.includes(stored) ? stored : 'system';
    applyTheme(resolveIsDark(mode));
  } catch (_) {
    applyTheme(getSystemPrefersDark());
  }
  try {
    const storedAccent = localStorage.getItem(ACCENT_STORAGE_KEY);
    applyAccent(ACCENTS.includes(storedAccent) ? storedAccent : 'purple');
  } catch (_) {
    applyAccent('purple');
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
  const [accent, setAccentState] = useState(() => {
    try {
      const stored = localStorage.getItem(ACCENT_STORAGE_KEY);
      return ACCENTS.includes(stored) ? stored : 'purple';
    } catch (_) { return 'purple'; }
  });

  // Apply + persist whenever mode changes
  useEffect(() => {
    const isDark = resolveIsDark(mode);
    applyTheme(isDark);
    setResolvedTheme(isDark ? 'dark' : 'light');
    try { localStorage.setItem(STORAGE_KEY, mode); } catch (_) {}
  }, [mode]);

  // Apply + persist whenever accent changes
  useEffect(() => {
    applyAccent(accent);
    try { localStorage.setItem(ACCENT_STORAGE_KEY, accent); } catch (_) {}
  }, [accent]);

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

  // NOTE: this does NOT gate on premium status — that's enforced by
  // whoever calls it (SettingsModal only exposes it to premium users)
  // and independently re-validated server-side on the /premium/theme
  // route, so a free user can't bypass the UI to persist a preset.
  const setAccent = useCallback((next) => {
    if (ACCENTS.includes(next)) setAccentState(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, setMode, resolvedTheme, accent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}