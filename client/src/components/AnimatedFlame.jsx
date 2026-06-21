import React from 'react';
import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';

// A subtly "alive" flame — gentle flicker loop, scales up briefly on
// mount. Used wherever a streak count is shown so it reads as warm and
// rewarding rather than a static icon.
export default function AnimatedFlame({ size = 16, className = '' }) {
  return (
    <motion.span
      className={`inline-flex ${className}`}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 15 }}
    >
      <motion.span
        className="inline-flex animate-flicker"
        style={{ transformOrigin: '50% 90%' }}
      >
        <Flame size={size} fill="currentColor" className="drop-shadow-[0_0_6px_rgba(255,122,99,0.5)]" />
      </motion.span>
    </motion.span>
  );
}