import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Signature visual: a tree that grows with the user's daily streak.
// Stage 0 = seed ... Stage 4 = full bloom. Pure SVG, no images needed.
// When the stage INCREASES (detected via a ref of the previous stage),
// it plays a brief celebratory glow + particle burst instead of just
// silently redrawing — growth should feel like an event, not a diff.
const STAGE_LABELS = ['Planting a seed', 'First sprout', 'Sapling', 'Young tree', 'Full bloom'];

function Particle({ index, total }) {
  const angle = (index / total) * Math.PI * 2;
  const distance = 38 + Math.random() * 18;
  const x = Math.cos(angle) * distance;
  const y = Math.sin(angle) * distance - 20;
  const colors = ['#7C6AF0', '#4CC38A', '#FFB84D', '#FF7A63'];
  return (
    <motion.span
      className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
      style={{ backgroundColor: colors[index % colors.length] }}
      initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
      animate={{ x, y, opacity: 0, scale: 0.4 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    />
  );
}

export default function ProductivityTree({ stage = 0, streak = 0 }) {
  const trunkHeight = 14 + stage * 10;
  const canopyScale = 0.35 + stage * 0.17;
  const prevStage = useRef(stage);
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    if (stage > prevStage.current) {
      setCelebrating(true);
      const t = setTimeout(() => setCelebrating(false), 1000);
      prevStage.current = stage;
      return () => clearTimeout(t);
    }
    prevStage.current = stage;
  }, [stage]);

  return (
    <div className="flex flex-col items-center justify-end h-full relative">
      <div className="relative">
        <AnimatePresence>
          {celebrating && (
            <>
              <motion.div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-24 w-24 rounded-full bg-sage-400/30 blur-xl"
                initial={{ scale: 0.3, opacity: 0.8 }}
                animate={{ scale: 1.6, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
              />
              {Array.from({ length: 8 }).map((_, i) => (
                <Particle key={i} index={i} total={8} />
              ))}
            </>
          )}
        </AnimatePresence>

        <svg width="120" height="140" viewBox="0 0 120 140" className="overflow-visible relative z-10">
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
              animate={celebrating ? { scale: [1, 1.12, 1] } : { scale: 1 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformOrigin: `60px ${124 - trunkHeight}px` }}
            >
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
            </motion.g>
          )}
        </svg>
      </div>
      <p className="font-display text-sm font-semibold text-ink dark:text-white mt-1">{STAGE_LABELS[stage]}</p>
      <p className="text-xs text-ink/45 dark:text-white/40">{streak} day streak</p>
      <AnimatePresence>
        {celebrating && (
          <motion.p
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute -top-2 text-[11px] font-bold text-sage-600 dark:text-sage-400"
          >
            Your tree grew! 🌱
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}