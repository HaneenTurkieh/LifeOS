import React from 'react';
import { motion } from 'framer-motion';

// The base surface used everywhere: frosted, soft-shadowed, gently animated in.
export default function GlassCard({ children, className = '', delay = 0, as: As = motion.div, ...props }) {
  return (
    <As
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
      className={`glass-card ${className}`}
      {...props}
    >
      {children}
    </As>
  );
}