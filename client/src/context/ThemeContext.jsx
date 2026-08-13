import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { api, getToken } from '../api/client.js';
import { migrateStorageKey } from '../utils/migrateStorageKey.js';

const ThemeContext = createContext(null);
const STORAGE_KEY        = 'nuvora_theme';
const ACCENT_STORAGE_KEY = 'nuvora_accent';
const FONT_STORAGE_KEY   = 'nuvora_font_scale';
migrateStorageKey(localStorage, 'aurora_theme',       STORAGE_KEY);
migrateStorageKey(localStorage, 'aurora_accent',      ACCENT_STORAGE_KEY);
migrateStorageKey(localStorage, 'aurora_font_scale',  FONT_STORAGE_KEY);
const MODES   = ['light', 'dark', 'system'];
export const ACCENTS = ['purple', 'orange', 'pink', 'blue'];
// Percentages applied to the root font-size — every rem-based size in
// the app (which is nearly all of Tailwind's defaults) scales together
// proportionally, same mechanism iOS Text Size uses.
export const FONT_SCALES = {
  small:   { label: 'Small',        pct: 87.5  },
  default: { label: 'Default',      pct: 100   },
  large:   { label: 'Large',        pct: 112.5 },
  xlarge:  { label: 'Extra Large',  pct: 125   },
  xxlarge: { label: 'XX Large',     pct: 137.5 },
};

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
function applyFontScale(key) {
  const pct = FONT_SCALES[key]?.pct ?? 100;
  document.documentElement.style.fontSize = `${pct}%`;
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
  try {
    const storedFont = localStorage.getItem(FONT_STORAGE_KEY);
    applyFontScale(FONT_SCALES[storedFont] ? storedFont : 'default');
  } catch (_) {
    applyFontScale('default');
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
  const [fontScale, setFontScaleState] = useState(() => {
    try {
      const stored = localStorage.getItem(FONT_STORAGE_KEY);
      return FONT_SCALES[stored] ? stored : 'default';
    } catch (_) { return 'default'; }
  });
  // Exposed so any page can gate a premium-only perk (e.g. watermark-free
  // exports) without each one re-fetching /focus/premium/status itself —
  // piggybacks on the poll below, which was already hitting that route.
  const [isPremium, setIsPremium] = useState(false);

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
    applyFontScale(fontScale);
    try { localStorage.setItem(FONT_STORAGE_KEY, fontScale); } catch (_) {}
  }, [fontScale]);

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

  const modeRef      = useRef(mode);
  const accentRef     = useRef(accent);
  const fontScaleRef  = useRef(fontScale);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { accentRef.current = accent; }, [accent]);
  useEffect(() => { fontScaleRef.current = fontScale; }, [fontScale]);

  useEffect(() => {
    const token = getToken();
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
        if (active) setIsPremium(Boolean(p?.is_premium));
      } catch (_) {}
      try {
        const f = await api.get('/focus/font-scale');
        if (active && f?.font_scale && FONT_SCALES[f.font_scale] && f.font_scale !== fontScaleRef.current) {
          setFontScaleState(f.font_scale);
        }
      } catch (_) {}
    };

    pull();
    const id = setInterval(pull, 5000);
    return () => { active = false; clearInterval(id); };
  }, []);

  const setMode = useCallback((next) => {
    if (!MODES.includes(next)) return;
    setModeState(next);
    const token = getToken();
    if (token) api.put('/focus/theme-mode', { theme_mode: next }).catch(() => {});
  }, []);

  const setAccent = useCallback((next) => {
    if (ACCENTS.includes(next)) setAccentState(next);
  }, []);

  const setFontScale = useCallback((next) => {
    if (!FONT_SCALES[next]) return;
    setFontScaleState(next);
    const token = getToken();
    if (token) api.put('/focus/font-scale', { font_scale: next }).catch(() => {});
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, setMode, resolvedTheme, accent, setAccent, fontScale, setFontScale, isPremium }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}