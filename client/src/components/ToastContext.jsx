import React, { createContext, useCallback, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, Trophy, CheckCircle2, AlertCircle, PartyPopper } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = { xp: Sparkles, achievement: Trophy, success: CheckCircle2, error: AlertCircle };
const STYLES = {
  xp: 'from-lavender-500 to-lavender-700',
  achievement: 'from-sun-500 to-coral-500',
  success: 'from-sage-500 to-sage-600',
  error: 'from-coral-500 to-coral-500',
};

function ConfettiBurst() {
  const colors = ['#7C6AF0', '#FFB84D', '#4CC38A', '#FF7A63', '#06B6D4'];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      {Array.from({ length: 16 }).map((_, i) => {
        const angle = (i / 16) * Math.PI * 2;
        const distance = 60 + Math.random() * 50;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 h-2 w-2 rounded-sm"
            style={{ backgroundColor: colors[i % colors.length] }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
            animate={{ x, y, opacity: 0, rotate: Math.random() * 360, scale: 0.4 }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: i * 0.01 }}
          />
        );
      })}
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [levelUp, setLevelUp] = useState(null); // { level } | null

  const push = useCallback((toast) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, ...toast }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), toast.duration || 3400);
  }, []);

  const value = {
    push,
    xp: (amount, reason) => push({ type: 'xp', title: `+${amount} XP`, message: reason }),
    achievement: (title) => push({ type: 'achievement', title: 'Achievement unlocked!', message: title, duration: 4200 }),
    success: (message) => push({ type: 'success', title: 'Done', message }),
    error: (message) => push({ type: 'error', title: 'Something went wrong', message }),
    levelUp: (level) => {
      setLevelUp({ level });
      setTimeout(() => setLevelUp(null), 2600);
    },
  };

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Standard toast stack — bottom right */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = ICONS[t.type] || Sparkles;
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 40, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.9, transition: { duration: 0.2 } }}
                transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                className="glass-card pointer-events-auto relative flex items-center gap-3 px-4 py-3 min-w-[230px] max-w-xs overflow-visible"
              >
                {t.type === 'achievement' && <ConfettiBurst />}
                <motion.div
                  animate={t.type === 'xp' || t.type === 'achievement' ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ duration: 0.4 }}
                  className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${STYLES[t.type]} text-white shadow-md`}
                >
                  <Icon size={18} />
                </motion.div>
                <div className="relative z-10 min-w-0">
                  <p className="text-sm font-semibold text-ink dark:text-white truncate">{t.title}</p>
                  {t.message && <p className="text-xs text-ink/60 dark:text-white/45 truncate">{t.message}</p>}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Level-up celebration — rare, full-attention moment, center stage */}
      <AnimatePresence>
        {levelUp && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-none bg-ink/10 dark:bg-black/30 backdrop-blur-[2px]"
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: -10 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              className="relative glass-card px-10 py-8 flex flex-col items-center text-center overflow-visible"
            >
              <ConfettiBurst />
              <motion.div
                animate={{ rotate: [0, -8, 8, -4, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 0.8, ease: 'easeInOut' }}
                className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sun-400 to-coral-500 text-white shadow-glow-lg mb-3"
              >
                <PartyPopper size={28} />
              </motion.div>
              <p className="relative z-10 text-xs font-semibold uppercase tracking-wider text-lavender-600 dark:text-lavender-300">Level up!</p>
              <p className="relative z-10 font-display text-2xl font-bold text-ink dark:text-white mt-1">
                You reached Level {levelUp.level}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}