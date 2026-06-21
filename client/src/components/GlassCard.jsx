import React from 'react';
import { motion } from 'framer-motion';

// The base surface used everywhere: frosted, soft-shadowed, gently
// animated in. `tier` controls visual weight so the UI has real
// hierarchy instead of every card looking identical:
//   1 (default) — standard content card
//   2 — elevated/featured card (slightly stronger blur + border + shadow)
//   3 — hero/focal surface (richest depth, used sparingly — e.g. one per page)
// `interactive` adds a subtle hover lift, for cards that represent a
// clickable/actionable item (tasks, goals, etc).
const TIERS = {
  1: 'bg-white/60 dark:bg-white/[0.04] backdrop-blur-xl border border-white/70 dark:border-white/10 shadow-glass',
  2: 'bg-white/70 dark:bg-white/[0.06] backdrop-blur-2xl border border-white/80 dark:border-white/[0.12] shadow-glass-lg',
  3: 'bg-white/80 dark:bg-white/[0.08] backdrop-blur-2xl border border-white/90 dark:border-white/[0.15] shadow-glass-xl',
};

export default function GlassCard({
  children, className = '', delay = 0, tier = 1, interactive = false, as: As = motion.div, ...props
}) {
  return (
    <As
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
      className={`relative rounded-3xl ${TIERS[tier] || TIERS[1]} transition-all duration-300 ease-premium ${
        interactive ? 'hover:-translate-y-0.5 hover:shadow-glass-lg dark:hover:border-white/20 cursor-pointer' : ''
      } ${className}`}
      {...props}
    >
      {/* Glass highlight — a thin light streak along the top edge, reads as a frosted-glass reflection */}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-3xl bg-gradient-to-r from-transparent via-white/70 dark:via-white/20 to-transparent" />
      {children}
    </As>
  );
}