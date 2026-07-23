import React from 'react';
import { motion } from 'framer-motion';

export default function EmptyState({
  icon: Icon,
  illustration,
  title,
  description,
  features,
  action,
  secondaryAction,
  tip,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center text-center py-16 px-6 max-w-md mx-auto"
    >
      {/* Illustration / Icon */}
      {illustration ? (
        <div className="mb-6 select-none">{illustration}</div>
      ) : Icon ? (
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl"
          style={{
            background:   'linear-gradient(135deg, rgba(124,106,240,0.15) 0%, rgba(91,71,224,0.08) 100%)',
            border:       '1px solid rgba(124,106,240,0.20)',
            boxShadow:    'inset 0 1px 0 rgba(255,255,255,0.50)',
          }}>
          <Icon size={28} className="text-lavender-500" strokeWidth={1.8} />
        </div>
      ) : null}

      {/* Title */}
      <h3 className="font-display text-xl font-bold text-ink dark:text-white mb-2">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-ink/50 dark:text-white/40 leading-relaxed mb-6">
          {description}
        </p>
      )}

      {/* Feature bullets — what this page does */}
      {features?.length > 0 && (
        <div className="flex flex-col gap-2 w-full mb-7">
          {features.map(({ icon, text }) => (
            <div key={text}
              className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-left"
              style={{
                background: 'rgba(255,255,255,0.50)',
                border:     '1px solid rgba(255,255,255,0.60)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}>
              <span className="text-lg shrink-0">{icon}</span>
              <span className="text-xs font-medium text-ink/65 dark:text-white/55">{text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Primary action */}
      {action && <div className="w-full mb-3">{action}</div>}

      {/* Secondary action */}
      {secondaryAction && (
        <div className="w-full mb-4">{secondaryAction}</div>
      )}

      {/* Tip */}
      {tip && (
        <p className="text-[11px] text-ink/30 dark:text-white/25 mt-2 flex items-center gap-1.5">
          <span>💡</span> {tip}
        </p>
      )}
    </motion.div>
  );
}