import React from 'react';
import { motion } from 'framer-motion';

// Tier 1/2/3 all now route through the same Spline-ready glass treatment —
// translucent white layer + heavy blur + thin white stroke, with tier only
// affecting depth/shadow strength so the hero card still reads as the
// most prominent surface.
const TIERS = {
  1: 'shadow-[0_8px_32px_rgba(0,0,0,0.25)]',
  2: 'shadow-[0_12px_40px_rgba(0,0,0,0.3)]',
  3: 'shadow-[0_20px_60px_rgba(0,0,0,0.4)]',
};

export default function GlassCard({
  children, className = '', delay = 0, tier = 1, interactive = false, as: As = motion.div, ...props
}) {
  return (
    <As
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
      className={`relative rounded-3xl glass-spline ${TIERS[tier] || TIERS[1]} transition-all duration-300 ease-premium ${
        interactive ? 'hover:-translate-y-0.5 hover:border-white/30 cursor-pointer' : ''
      } ${className}`}
      {...props}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-3xl bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      {children}
    </As>
  );
}
