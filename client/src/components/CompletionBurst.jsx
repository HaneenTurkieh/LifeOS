import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AnimatedFlame from './AnimatedFlame.jsx';

export default function CompletionBurst({ show }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5, y: 0 }}
          animate={{ opacity: 1, scale: 1.3, y: -24 }}
          exit={{ opacity: 0, scale: 0.8, y: -36 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none absolute -top-2 right-2 z-20"
        >
          <AnimatedFlame size={22} className="text-coral-500" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
