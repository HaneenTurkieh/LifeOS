import React from 'react';
import { motion } from 'framer-motion';

export default function ProductivitySphere({ score = 0, size = 132, equippedTree = null }) {
  const radius       = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset       = circumference - (Math.min(100, score) / 100) * circumference;

  const TREE_EMOJIS = {
    seedling:       '🌱', sprout: '🌿', oak: '🌳',
    cherry_blossom: '🌸', bamboo: '🎋', palm: '🌴',
    pine:           '🌲', crystal: '✨',
  };
  const treeEmoji = equippedTree ? (TREE_EMOJIS[equippedTree] || '🌱') : '🌱';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <motion.div
        animate={{ scale: [1, 1.04, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute inset-0 rounded-full bg-gradient-to-br from-aurora-violet/30 via-aurora-indigo/20 to-aurora-sky/20 blur-2xl"
      />
      <svg width={size} height={size} className="-rotate-90 relative z-10">
        <defs>
          <linearGradient id="sphereGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#60A5FA" />
          </linearGradient>
        </defs>
        <circle cx={size/2} cy={size/2} r={radius} stroke="rgba(124,92,255,0.12)" strokeWidth="8" fill="none" />
        <motion.circle
          cx={size/2} cy={size/2} r={radius}
          stroke="url(#sphereGrad)" strokeWidth="8" fill="none"
          strokeLinecap="round" strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>

      <div className="absolute z-10 flex flex-col items-center">
        {/* Tree emoji floats above score */}
        <motion.div
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          className="text-2xl mb-0.5 select-none"
        >
          {treeEmoji}
        </motion.div>
        <span className="font-display text-lg font-bold text-ink dark:text-white leading-none">{score}%</span>
        <span className="text-[9px] text-ink/40 dark:text-white/35">today</span>
      </div>
    </div>
  );
}