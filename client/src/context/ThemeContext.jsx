import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../api/client.js';

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
  return getSystemPrefersDark();
}
function applyTheme(isDark) {
  document.documentElement.classList.toggle('dark', isDark);
  const meta = document.getElementById('theme-color-meta');
  if (meta) meta.setAttribute('content', isDark ? '#0c0a1a' : '#F4F6FB');
}
function applyAccent(preset) {
  if (preset && preset !== 'purple' && ACCENTS.includes(preset)) {
    document.documentElement.setAttribute('data-accent', preset);
  } else {
    document.documentElement.removeAttribute('data-accent');
  }
}

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

  useEffect(() => {
    const isDark = resolveIsDark(mode);
    applyTheme(isDark);
    setResolvedTheme(isDark ? 'dark' : 'light');
    try { localStorage.setItem(STORAGE_KEY, mode); } catch (_) {}
  }, [mode]);

  useEffect(() => {
    applyAccent(accent);
    try { localStorage.setItem(ACCENT_STORAGE_KEY, accent); } catch (_) {}
  }, [accent]);

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

  // ── Server sync: light/dark mode AND accent color, both polled
  // every 5s (matching the Pomodoro timer's cadence) so a change made
  // on one device/tab reaches every other open one without a manual
  // refresh. Local refs track the last-known server values so the
  // poll only calls setState when something actually changed —
  // avoids fighting the user's own in-flight edits.
  const modeRef        = useRef(mode);
  const accentRef      = useRef(accent);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { accentRef.current = accent; }, [accent]);

  useEffect(() => {
    const token = localStorage.getItem('aurora_auth_token');
    if (!token) return;
    let active = true;

    const pull = async () => {
      try {
        const d = await api.get('/focus/theme-mode');
        if (active && d?.theme_mode && MODES.includes(d.theme_mode) && d.theme_mode !== modeRef.current) {
          setModeState(d.theme_mode);
        }
      } catch (_) {}
      try {
        const p = await api.get('/focus/premium/status');
        if (active && p?.theme_preset && ACCENTS.includes(p.theme_preset) && p.theme_preset !== accentRef.current) {
          setAccentState(p.theme_preset);
        }
      } catch (_) {}
    };

    pull(); // once on mount
    const id = setInterval(pull, 5000);
    return () => { active = false; clearInterval(id); };
  }, []);

  const setMode = useCallback((next) => {
    if (!MODES.includes(next)) return;
    setModeState(next);
    const token = localStorage.getItem('aurora_auth_token');
    if (token) {
      api.put('/focus/theme-mode', { theme_mode: next }).catch(() => {});
    }
  }, []);

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