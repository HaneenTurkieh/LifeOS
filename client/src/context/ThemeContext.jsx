import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { api, getToken } from '../api/client.js';
import { migrateStorageKey } from '../utils/migrateStorageKey.js';

const ThemeContext = createContext(null);
const STORAGE_KEY        = 'nuvora_theme';
const ACCENT_STORAGE_KEY = 'nuvora_accent';
const FONT_STORAGE_KEY   = 'nuvora_font_scale';
const BG_STYLE_STORAGE_KEY = 'nuvora_background_style';
migrateStorageKey(localStorage, 'aurora_theme',       STORAGE_KEY);
migrateStorageKey(localStorage, 'aurora_accent',      ACCENT_STORAGE_KEY);
migrateStorageKey(localStorage, 'aurora_font_scale',  FONT_STORAGE_KEY);
const MODES   = ['light', 'dark', 'system'];
export const ACCENTS = ['purple', 'orange', 'pink', 'blue', 'green', 'coral', 'gold'];
// Second personalization axis ("Themes"), independent of accent color —
// which mood the animated glow/orbs behind every page use (see
// GlobalBackground.jsx, which reads this straight off context — unlike
// accent/font-scale it doesn't need a pre-paint DOM attribute, since
// only that one component ever looks at it).
export const BACKGROUND_STYLES = ['aurora', 'minimal', 'vivid'];
// Matches PREMIUM_TREES in server/routes/trees.js / PREMIUM_COLORS in
// TreeShop.jsx — duplicated here rather than shared (same call
// SettingsModal's PREMIUM_TREE_OPTIONS and LeaderboardTreeBadge already
// make) since this context has no reason to round-trip the whole shop
// catalogue just to tint a background. Drives the "Tree Aura" perk: this
// is completely independent of the is_premium-gated accent/background
// system above — a premium *tree* (not a Premium *subscription*) is
// what unlocks it, and it composes on top of whatever accent/background
// a free or Premium account already has.
export const PREMIUM_TREE_COLORS = {
  aurora:  '#38BDF8',
  phoenix: '#FB923C',
  galaxy:  '#A855F7',
  nebula:  '#EC4899',
  eclipse: '#FBBF24',
  comet:   '#7DD3FC',
};
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
  const [backgroundStyle, setBackgroundStyleState] = useState(() => {
    try {
      const stored = localStorage.getItem(BG_STYLE_STORAGE_KEY);
      return BACKGROUND_STYLES.includes(stored) ? stored : 'aurora';
    } catch (_) { return 'aurora'; }
  });
  // Exposed so any page can gate a premium-only perk (e.g. watermark-free
  // exports) without each one re-fetching /focus/premium/status itself —
  // piggybacks on the poll below, which was already hitting that route.
  const [isPremium, setIsPremium] = useState(false);
  // Whichever tree is currently equipped — only matters here for the
  // "Tree Aura" background tint (see PREMIUM_TREE_COLORS above), so
  // GlobalBackground.jsx can react to it without every page needing to
  // fetch /trees itself just to answer "what color, if any, should the
  // background be tinted." Piggybacks on the same poll tick as
  // isPremium/accent/backgroundStyle below.
  const [equippedTreeKey, setEquippedTreeKey] = useState(null);

  // Birthday theme — pink for a girl, blue for a boy, for that one day
  // only, then back to whatever they actually had. Deliberately NOT
  // wired through setAccent/the persisted theme_preset: this context sits
  // OUTSIDE AuthProvider in main.jsx so it can't read user.birthday/
  // gender itself, and writing the real preset would (a) fight the 5s
  // poll pulling the real saved value back, and (b) actually overwrite a
  // Premium user's custom pick instead of just masking it for the day.
  // AppShell (which has both contexts) sets this via setBirthdayOverride;
  // it's applied on top of `accent` at the DOM level only, so `accent`
  // itself — and whatever's persisted server-side — never changes. The
  // day after, AppShell clears it and the real value is already right
  // there, unchanged, for free and Premium accounts alike.
  const [birthdayOverride, setBirthdayOverride] = useState(null);

  useEffect(() => {
    const isDark = resolveIsDark(mode);
    applyTheme(isDark);
    setResolvedTheme(isDark ? 'dark' : 'light');
    try { localStorage.setItem(STORAGE_KEY, mode); } catch (_) {}
  }, [mode]);

  useEffect(() => {
    applyAccent(birthdayOverride || accent);
    try { localStorage.setItem(ACCENT_STORAGE_KEY, accent); } catch (_) {}
  }, [accent, birthdayOverride]);

  useEffect(() => {
    applyFontScale(fontScale);
    try { localStorage.setItem(FONT_STORAGE_KEY, fontScale); } catch (_) {}
  }, [fontScale]);

  useEffect(() => {
    try { localStorage.setItem(BG_STYLE_STORAGE_KEY, backgroundStyle); } catch (_) {}
  }, [backgroundStyle]);

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

  const modeRef            = useRef(mode);
  const accentRef           = useRef(accent);
  const fontScaleRef        = useRef(fontScale);
  const backgroundStyleRef  = useRef(backgroundStyle);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { accentRef.current = accent; }, [accent]);
  useEffect(() => { fontScaleRef.current = fontScale; }, [fontScale]);
  useEffect(() => { backgroundStyleRef.current = backgroundStyle; }, [backgroundStyle]);

  useEffect(() => {
    let active = true;

    // Real bug that used to live here: the token was only checked once,
    // right when this effect first ran ([] deps — never re-runs). Logging
    // in mid-session (no full page reload, just navigating from the
    // Login page) meant there was no token yet at that first check, so
    // this poll never started at all — premium theme/accent/font-scale
    // sync from the server stayed broken for the rest of the session,
    // only recovering after a manual refresh. ThemeProvider sits outside
    // AuthProvider in main.jsx, so it can't just depend on useAuth()'s
    // user object here — instead, the interval itself always runs, and
    // each tick re-checks getToken() fresh, so it picks up a freshly-set
    // token within one poll interval of logging in, and just as
    // naturally stops making calls (falls through to the token-less
    // no-op below) within the same window after logging out.
    const pull = async () => {
      const token = getToken();
      if (!token) return;
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
        if (active && p?.background_style && BACKGROUND_STYLES.includes(p.background_style) && p.background_style !== backgroundStyleRef.current) {
          setBackgroundStyleState(p.background_style);
        }
        if (active) setIsPremium(Boolean(p?.is_premium));
      } catch (_) {}
      try {
        const f = await api.get('/focus/font-scale');
        if (active && f?.font_scale && FONT_SCALES[f.font_scale] && f.font_scale !== fontScaleRef.current) {
          setFontScaleState(f.font_scale);
        }
      } catch (_) {}
      try {
        const eq = await api.get('/trees/equipped-summary');
        if (active) setEquippedTreeKey(eq?.tree_key || null);
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

  // Local-only setter, same shape as setAccent — the actual POST +
  // optimistic-update/rollback lives in SettingsModal.jsx's
  // changeBackground, which calls this after the request succeeds (or
  // to revert it if the request fails), same pattern as changeTheme.
  const setBackgroundStyle = useCallback((next) => {
    if (BACKGROUND_STYLES.includes(next)) setBackgroundStyleState(next);
  }, []);

  const setFontScale = useCallback((next) => {
    if (!FONT_SCALES[next]) return;
    setFontScaleState(next);
    const token = getToken();
    if (token) api.put('/focus/font-scale', { font_scale: next }).catch(() => {});
  }, []);

  return (
    <ThemeContext.Provider value={{
      mode, setMode, resolvedTheme,
      // `accent` stays the REAL saved preference (what Settings' theme
      // picker should show as selected, and what setAccent/toggle logic
      // compares against) — the birthday override never touches it.
      // `displayAccent` is what anything doing its own JS color lookup
      // (can't use the [data-accent] CSS vars applyAccent already sets)
      // should render with, so it matches the rest of the app today.
      accent, setAccent, displayAccent: birthdayOverride || accent, setBirthdayOverride,
      fontScale, setFontScale, isPremium,
      backgroundStyle, setBackgroundStyle,
      // null unless the equipped tree is one of the 6 paid ones — an
      // earnable/mystic tree equipped means no aura, same as nothing
      // equipped at all.
      treeAuraColor: PREMIUM_TREE_COLORS[equippedTreeKey] || null,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}