import React from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import NotificationBell from './NotificationBell.jsx';

export default function TopBar({ onSearchOpen }) {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 h-14"
      style={{
        background:           'rgba(255,255,255,0.55)',
        backdropFilter:       'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom:         '1px solid rgba(255,255,255,0.50)',
        boxShadow:            'inset 0 -1px 0 rgba(0,0,0,0.04)',
      }}
    >
      {/* Left — app name */}
      <div className="flex items-center gap-2 pl-16 lg:pl-20">
        <span className="font-display font-bold text-ink/70 dark:text-white/60 text-sm tracking-wide">
          Aurora
        </span>
      </div>

      {/* Right — search + bell */}
      <div className="flex items-center gap-2">
        {/* Search — shows shortcut hint on desktop */}
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={onSearchOpen}
          className="flex items-center gap-2 rounded-xl px-3 py-1.5 transition-all"
          style={{
            background:           'rgba(255,255,255,0.60)',
            border:               '1px solid rgba(255,255,255,0.70)',
            backdropFilter:       'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow:            'inset 0 1px 0 rgba(255,255,255,0.85)',
          }}
        >
          <Search size={14} className="text-ink/45 dark:text-white/40" />
          <span className="text-xs text-ink/40 dark:text-white/35 hidden sm:block">Search</span>
          <kbd className="hidden lg:flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold text-ink/30 dark:text-white/25"
            style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.08)' }}>
            ⌘K
          </kbd>
        </motion.button>

        <NotificationBell />
      </div>
    </div>
  );
}