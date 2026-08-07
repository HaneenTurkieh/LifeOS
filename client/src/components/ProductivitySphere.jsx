import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext.jsx';

export default function ProductivitySphere({ score = 0, size = 132, equippedTree = null }) {
  const radius       = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset       = circumference - (Math.min(100, score) / 100) * circumference;
  const { accent }   = useTheme();

  const TREE_EMOJIS = {
    seedling:       '🌱', sprout: '🌿', oak: '🌳',
    cherry_blossom: '🌸', bamboo: '🎋', palm: '🌴',
    pine:           '🌲', crystal: '✨', mystic: '🔮',
  };
  const treeEmoji = !equippedTree ? '🌱' : equippedTree.startsWith('mystic') ? '🔮' : (TREE_EMOJIS[equippedTree] || '🌱');

  // SVG <linearGradient> stops can't read CSS custom properties reliably
  // across browsers the way inline styles can, so each accent preset
  // gets an explicit hex pair here — kept in sync with the --accent-*
  // values in index.css. Falls back to purple if accent is unset.
  const GRADIENT_STOPS = {
    purple: ['#8B5CF6', '#7C6AF0'],
    orange: ['#FF8A42', '#FF7A2E'],
    pink:   ['#FF6BA6', '#F5408F'],
    blue:   ['#5C9AFF', '#3B82F6'],
  };
  const [stopStart, stopEnd] = GRADIENT_STOPS[accent] || GRADIENT_STOPS.purple;
  // Unique id per instance in case multiple spheres ever render at once —
  // a shared id would collide and only the last-mounted gradient would apply.
  const gradId = `sphereGrad-${accent}`;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <motion.div
        animate={{ scale: [1, 1.04, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute inset-0 rounded-full blur-2xl"
        style={{ background: `radial-gradient(circle, rgb(var(--accent-500) / 0.30) 0%, rgb(var(--accent-600) / 0.20) 55%, rgb(var(--accent-400) / 0.20) 100%)` }}
      />
      <svg width={size} height={size} className="-rotate-90 relative z-10">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor={stopStart} />
            <stop offset="100%" stopColor={stopEnd} />
          </linearGradient>
        </defs>
        <circle cx={size/2} cy={size/2} r={radius} stroke="rgb(var(--accent-500) / 0.12)" strokeWidth="8" fill="none" />
        <motion.circle
          cx={size/2} cy={size/2} r={radius}
          stroke={`url(#${gradId})`} strokeWidth="8" fill="none"
          strokeLinecap="round" strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>

      <div className="absolute z-10 flex flex-col items-center">
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