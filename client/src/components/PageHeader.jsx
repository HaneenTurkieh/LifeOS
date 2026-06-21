import React from 'react';
import { motion } from 'framer-motion';

export default function PageHeader({ eyebrow, title, subtitle, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-7"
    >
      <div>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-wider text-lavender-600 dark:text-lavender-300 mb-1.5">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-2xl sm:text-[1.75rem] font-bold text-ink dark:text-white tracking-tight">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-ink/55 dark:text-white/45 mt-1.5 max-w-xl leading-relaxed">{subtitle}</p>}
      </div>
      {action}
    </motion.div>
  );
}