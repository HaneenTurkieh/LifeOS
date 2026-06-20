import React from 'react';
import { motion } from 'framer-motion';

// Signature visual: a tree that grows with the user's daily streak.
// Stage 0 = seed ... Stage 4 = full bloom. Pure SVG, no images needed.
const STAGE_LABELS = ['Planting a seed', 'First sprout', 'Sapling', 'Young tree', 'Full bloom'];

export default function ProductivityTree({ stage = 0, streak = 0 }) {
  const trunkHeight = 14 + stage * 10;
  const canopyScale = 0.35 + stage * 0.17;

  return (
    <div className="flex flex-col items-center justify-end h-full">
      <svg width="120" height="140" viewBox="0 0 120 140" className="overflow-visible">
        <ellipse cx="60" cy="128" rx="38" ry="7" fill="#7C6AF0" opacity="0.08" />
        <motion.rect
          x="55" width="10" rx="4" fill="url(#trunkGrad)"
          initial={{ height: 0, y: 124 }}
          animate={{ height: trunkHeight, y: 124 - trunkHeight }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
        <defs>
          <linearGradient id="trunkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#B08968" />
            <stop offset="100%" stopColor="#8B5E3C" />
          </linearGradient>
          <radialGradient id="canopyGrad" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#9AE6B4" />
            <stop offset="100%" stopColor="#2DA76E" />
          </radialGradient>
        </defs>
        {stage === 0 ? (
          <motion.circle cx="60" cy="120" r="5" fill="#8B5E3C" initial={{ scale: 0 }} animate={{ scale: 1 }} />
        ) : (
          <motion.g
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: `60px ${124 - trunkHeight}px` }}
          >
            <circle cx="60" cy={124 - trunkHeight - 6} r={26 * canopyScale + 8} fill="url(#canopyGrad)" />
            <circle cx={60 - 18 * canopyScale} cy={124 - trunkHeight + 4} r={20 * canopyScale + 6} fill="url(#canopyGrad)" opacity="0.9" />
            <circle cx={60 + 18 * canopyScale} cy={124 - trunkHeight + 4} r={20 * canopyScale + 6} fill="url(#canopyGrad)" opacity="0.9" />
          </motion.g>
        )}
      </svg>
      <p className="font-display text-sm font-semibold text-ink mt-1">{STAGE_LABELS[stage]}</p>
      <p className="text-xs text-ink/45">{streak} day streak</p>
    </div>
  );
}