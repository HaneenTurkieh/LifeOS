import React, { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { getFestiveOccasion } from '../utils/islamicCalendar.js';

// Ambient, persistent, site-wide — distinct from BirthdayCelebration's
// one-time popup burst. This is the "hung on the website" decoration:
// a small bunting garland along the very top edge plus a few slow
// drifting icons, present on every page for as long as the occasion
// lasts (all of Ramadan, the Eid days, or the birthday). Purely
// pointer-events-none so it never blocks clicks on the search/
// notification pill or anything else.
const THEMES = {
  birthday: { icons: ['🎉', '🎈', '🎂', '✨', '🎁', '🌟'], flags: ['#FF2B99', '#7C6AF0', '#FFD23F', '#4CC38A'] },
  ramadan:  { icons: ['🌙', '⭐', '✨', '🌟'],              flags: ['#D4A537', '#3B2F7A', '#F2C94C', '#5B4A9E'] },
  eid:      { icons: ['🐑', '🐑', '✨', '🌙'],              flags: ['#10A569', '#F2C94C', '#0D8A57', '#E8C468'] },
};

function Bunting({ colors }) {
  const COUNT = 18;
  return (
    <div className="pointer-events-none fixed top-0 inset-x-0 z-40 flex justify-center" style={{ overflow: 'visible' }}>
      <div className="flex items-start" style={{ gap: 3 }}>
        {Array.from({ length: COUNT }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 0.92, y: [0, 2, 0], rotate: [-5, 5, -5] }}
            transition={{
              opacity: { delay: i * 0.025, duration: 0.4 },
              y:       { duration: 2.6 + (i % 3) * 0.35, repeat: Infinity, ease: 'easeInOut', delay: i * 0.06 },
              rotate:  { duration: 2.6 + (i % 3) * 0.35, repeat: Infinity, ease: 'easeInOut', delay: i * 0.06 },
            }}
            style={{
              width: 0, height: 0,
              borderLeft:  '8px solid transparent',
              borderRight: '8px solid transparent',
              borderTop:   `15px solid ${colors[i % colors.length]}`,
              filter:      'drop-shadow(0 2px 3px rgba(0,0,0,0.22))',
              transformOrigin: 'top center',
            }}
          />
        ))}
      </div>
    </div>
  );
}

function AmbientIcons({ icons }) {
  const COUNT = 8;
  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      {Array.from({ length: COUNT }).map((_, i) => (
        <motion.span
          key={i}
          initial={{ y: '-8vh', opacity: 0 }}
          animate={{ y: '108vh', opacity: [0, 0.5, 0.5, 0] }}
          transition={{
            duration: 15 + Math.random() * 10,
            delay:    Math.random() * 14,
            repeat:   Infinity,
            ease:     'linear',
          }}
          className="absolute text-xl select-none"
          style={{ left: `${(i / COUNT) * 100 + Math.random() * 6}%` }}
        >
          {icons[i % icons.length]}
        </motion.span>
      ))}
    </div>
  );
}

export default function FestiveDecoration({ user }) {
  // Birthday is a per-user check; Ramadan/Eid come purely from today's
  // Hijri date, so they don't depend on `user` at all — recomputed
  // fresh on every mount (i.e. every refresh), no localStorage needed.
  const occasion = useMemo(() => getFestiveOccasion(user), [user?.birthday]);

  useEffect(() => {
    if (occasion) document.documentElement.setAttribute('data-festive', occasion);
    else document.documentElement.removeAttribute('data-festive');
    return () => document.documentElement.removeAttribute('data-festive');
  }, [occasion]);

  if (!occasion) return null;
  const theme = THEMES[occasion];
  return (
    <>
      <Bunting colors={theme.flags} />
      <AmbientIcons icons={theme.icons} />
    </>
  );
}
