import React, { createContext, useCallback, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, Trophy, CheckCircle2, AlertCircle } from 'lucide-react';

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
  const [toasts, setToasts] = useState([]);

  const push = useCallback((toast) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, ...toast }]);
    // Longer messages (e.g. real API error text) need more than the
    // default 3.2s to actually read, especially now that they wrap
    // instead of getting cut off — scale duration with length, capped
    // so it never lingers forever.
    const textLen  = (toast.title?.length || 0) + (toast.message?.length || 0);
    const duration = toast.duration || Math.min(3200 + textLen * 40, 8000);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), duration);
  }, []);

  const value = {
    push,
    xp: (amount, reason) => push({ type: 'xp', title: `+${amount} XP`, message: reason }),
    achievement: (title) => push({ type: 'achievement', title: 'Achievement unlocked!', message: title }),
    success: (message) => push({ type: 'success', title: 'Done', message }),
    error: (message) => push({ type: 'error', title: 'Something went wrong', message }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-5 right-5 z-[100] flex flex-col gap-2.5 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = ICONS[t.type] || Sparkles;
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 40, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                className="glass-card pointer-events-auto flex items-start gap-3 px-4 py-3 min-w-[220px] max-w-sm"
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${STYLES[t.type]} text-white shadow-sm`}>
                  <Icon size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink leading-snug break-words">{t.title}</p>
                  {t.message && <p className="text-xs text-ink/60 mt-0.5 leading-relaxed break-words">{t.message}</p>}
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