// client/src/context/LanguageContext.jsx
// Auto-detects Arabic browsers → flips the whole app to RTL.
// Persists the choice in localStorage. Provides t() for translations.
//
// Wire-up (client/src/main.jsx or App.jsx — wrap OUTSIDE ThemeProvider):
//   import { LanguageProvider } from './context/LanguageContext.jsx';
//   <LanguageProvider> ...existing providers... </LanguageProvider>

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { translations } from '../i18n/translations.js';
import { migrateStorageKey } from '../utils/migrateStorageKey.js';

const LanguageContext = createContext(null);
const STORAGE_KEY = 'nuvora_lang';
migrateStorageKey(localStorage, 'aurora_lang', STORAGE_KEY);

function detectLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ar' || saved === 'en') return saved;
  } catch (_) {}
  // Auto-detect: any Arabic locale (ar, ar-PS, ar-SA, ar-EG, …)
  const nav = navigator.language || navigator.userLanguage || '';
  return nav.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(detectLanguage);

  // Flip the entire document direction — this alone fixes most
  // broken layouts, since flexbox and grid mirror automatically.
  useEffect(() => {
    const isAr = lang === 'ar';
    document.documentElement.lang = lang;
    document.documentElement.dir  = isAr ? 'rtl' : 'ltr';
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) {}
  }, [lang]);

  const setLang = useCallback((l) => {
    if (l === 'ar' || l === 'en') setLangState(l);
  }, []);

  // t('key') → translated string. Falls back to English, then the key.
  // Supports {placeholders}: t('lumi.greeting', { name: 'Haneen' })
  const t = useCallback((key, vars) => {
    let str = translations[lang]?.[key] ?? translations.en[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replaceAll(`{${k}}`, v);
      }
    }
    return str;
  }, [lang]);

  const isRTL = lang === 'ar';

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

// Safe fallback: if the provider isn't mounted (or during hot-reload),
// return working English defaults instead of crashing the whole app.
const FALLBACK = {
  lang: 'en',
  isRTL: false,
  setLang: () => {},
  t: (key, vars) => {
    let str = translations.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) str = str.replaceAll(`{${k}}`, v);
    return str;
  },
};

export const useLanguage = () => useContext(LanguageContext) || FALLBACK;