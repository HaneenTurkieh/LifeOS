import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, Trophy, CheckCircle2, AlertCircle, ChevronDown } from 'lucide-react';
import { useLanguage } from './LanguageContext.jsx';

const ToastContext = createContext(null);

const ICONS = {
  xp: Sparkles,
  achievement: Trophy,
  success: CheckCircle2,
  error: AlertCircle,
};

const STYLES = {
  xp: 'from-lavender-500 to-lavender-700',
  achievement: 'from-sun-500 to-coral-500',
  success: 'from-sage-500 to-sage-600',
  error: 'from-coral-500 to-coral-500',
};

export function ToastProvider({ children }) {
  const { t } = useLanguage();
  const [toasts, setToasts] = useState([]);

  const push = useCallback((toast) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, expanded: false, ...toast }]);
    // Longer messages (e.g. real API error text) need more than the
    // default 3.2s to actually read, especially now that they wrap
    // instead of getting cut off — scale duration with length, capped
    // so it never lingers forever.
    const textLen  = (toast.title?.length || 0) + (toast.message?.length || 0);
    const duration = toast.duration || Math.min(3200 + textLen * 40, 8000);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), duration);
  }, []);

  const toggleExpand = useCallback((id) => {
    setToasts((prev) => prev.map((x) => (x.id === id ? { ...x, expanded: !x.expanded } : x)));
  }, []);

  // Real bug that used to live here: this was a brand-new object (with
  // brand-new function references) on every single render of
  // ToastProvider, which sits near the root of the whole app — so every
  // component anywhere that calls useToast() re-rendered on every toast
  // push/expiry, not just the toasts themselves. Harmless on its own most
  // of the time, but it compounds with anything downstream that resets
  // state based on a prop's *reference* changing rather than its actual
  // content (see TreeShop's mysticInitial/MysticModal fix) — this was one
  // of the two contributing causes there. push itself is already stable
  // (useCallback with no deps), so memoizing on it keeps `value` stable
  // across re-renders too.
  const value = useMemo(() => ({
    push,
    xp: (amount, reason) => push({ type: 'xp', title: `+${amount} XP`, message: reason }),
    achievement: (title) => push({ type: 'achievement', title: 'Achievement unlocked!', message: title }),
    success: (message) => push({ type: 'success', title: 'Done', message }),
    error: (message) => push({ type: 'error', title: 'Something went wrong', message }),
  }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-5 right-5 z-[100] flex flex-col gap-2.5 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => {
            const Icon = ICONS[toast.type] || Sparkles;
            // Apple-style banners: clamp to 2 lines by default and only
            // offer the expand chevron once the message is actually long
            // enough to get clipped by that clamp.
            const isLong = (toast.message?.length || 0) > 70;
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, x: 40, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                className="glass-card pointer-events-auto flex items-start gap-3 px-4 py-3 min-w-[220px] max-w-sm"
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${STYLES[toast.type]} text-white shadow-sm`}>
                  <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink leading-snug break-words">{toast.title}</p>
                  {toast.message && (
                    <p className={`text-xs text-ink/60 mt-0.5 leading-relaxed break-words ${!toast.expanded && isLong ? 'line-clamp-2' : ''}`}>
                      {toast.message}
                    </p>
                  )}
                  {isLong && (
                    <button
                      onClick={() => toggleExpand(toast.id)}
                      className="mt-1 flex items-center gap-0.5 text-[10px] font-semibold text-ink/35 hover:text-ink/60 transition-colors"
                    >
                      {toast.expanded ? t('common.less') : t('common.more')}
                      <motion.span
                        animate={{ rotate: toast.expanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex"
                      >
                        <ChevronDown size={11} />
                      </motion.span>
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}