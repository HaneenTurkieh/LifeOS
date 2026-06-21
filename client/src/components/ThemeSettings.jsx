import React from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';

const OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export default function ThemeSettings() {
  const { mode, setMode } = useTheme();

  return (
    <div>
      <p className="text-xs font-semibold text-ink/50 dark:text-white/40 mb-2.5">Appearance</p>
      <div className="relative grid grid-cols-3 gap-1 rounded-2xl bg-ink/5 dark:bg-white/5 p-1">
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const active = mode === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className="relative flex flex-col items-center gap-1.5 rounded-xl px-3 py-3 text-xs font-semibold transition-colors"
            >
              {active && (
                <motion.div
                  layoutId="theme-pill"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  className="absolute inset-0 rounded-xl bg-white dark:bg-white/10 shadow-sm"
                />
              )}
              <span className={`relative flex items-center gap-1.5 ${active ? 'text-lavender-600 dark:text-lavender-300' : 'text-ink/45 dark:text-white/40'}`}>
                <Icon size={15} />
              </span>
              <span className={`relative ${active ? 'text-lavender-600 dark:text-lavender-300' : 'text-ink/45 dark:text-white/40'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-ink/35 dark:text-white/30 mt-2.5">
        "System" follows your OS appearance automatically, even if you change it while Aurora is open.
      </p>
    </div>
  );
}