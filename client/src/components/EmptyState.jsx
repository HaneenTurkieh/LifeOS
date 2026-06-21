import React from 'react';
import { motion } from 'framer-motion';

export default function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
      className="glass-card flex flex-col items-center justify-center gap-3 py-16 px-6 text-center"
    >
      <motion.div
        initial={{ scale: 0.7, rotate: -8 }} animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-lavender-100 to-lavender-200 dark:from-lavender-500/15 dark:to-lavender-600/10 text-lavender-600 dark:text-lavender-300 shadow-inner-highlight dark:shadow-none"
      >
        {Icon && <Icon size={28} />}
      </motion.div>
      <div>
        <p className="font-display font-semibold text-ink dark:text-white">{title}</p>
        {message && <p className="text-sm text-ink/55 dark:text-white/45 mt-1 max-w-sm">{message}</p>}
      </div>
      {action}
    </motion.div>
  );
}