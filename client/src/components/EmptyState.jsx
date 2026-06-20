import React from 'react';
import { motion } from 'framer-motion';

export default function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
      className="glass-card flex flex-col items-center justify-center gap-3 py-14 px-6 text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-lavender-100 text-lavender-600">
        {Icon && <Icon size={26} />}
      </div>
      <div>
        <p className="font-display font-semibold text-ink">{title}</p>
        {message && <p className="text-sm text-ink/55 mt-1 max-w-sm">{message}</p>}
      </div>
      {action}
    </motion.div>
  );
}