import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

// The Nuvora companion — name TBD, kept as a generic component name on
// purpose so renaming it later is a one-line prop/import change, not a
// find-and-replace across the app.
//
// A soft rounded "becoming" blob (not a perfect circle, same reasoning
// as the login card's morph shape), with a small star-sparkle instead
// of a logo — ties back to the nova/becoming identity rather than
// being a mascot bolted on separately from it. Built as plain SVG +
// Framer Motion, same technique already used for the Mystic Tree
// shapes, so it costs nothing extra to load and matches the rest of
// the app's visual language instead of looking like an imported asset.
//
// Blinks on its own on an irregular loop (real eyes don't blink on a
// metronome), and can wave once on mount via the `wave` prop.
export default function NuvoraBuddy({ size = 64, wave = false, bob = true, onClick, className = '', title }) {
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let t1, t2;
    const loop = () => {
      const delay = 2200 + Math.random() * 2600;
      t1 = setTimeout(() => {
        if (cancelled) return;
        setBlink(true);
        t2 = setTimeout(() => { if (!cancelled) setBlink(false); }, 140);
        loop();
      }, delay);
    };
    loop();
    return () => { cancelled = true; clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <motion.div
      onClick={onClick}
      title={title}
      className={`relative select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{ width: size, height: size }}
      animate={bob ? { y: [0, -4, 0] } : {}}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      whileHover={onClick ? { scale: 1.06 } : {}}
      whileTap={onClick ? { scale: 0.94 } : {}}
    >
      <svg viewBox="0 0 64 64" width="100%" height="100%"
        style={{ filter: 'drop-shadow(0 6px 16px rgb(var(--accent-500) / 0.45))', overflow: 'visible' }}>
        <defs>
          <radialGradient id="buddyBody" cx="35%" cy="28%" r="75%">
            <stop offset="0%"  stopColor="rgb(var(--accent-300))" />
            <stop offset="55%" stopColor="rgb(var(--accent-500))" />
            <stop offset="100%" stopColor="rgb(var(--accent-700))" />
          </radialGradient>
        </defs>

        {/* waving arm — sits behind the body so only the "hand" peeks out, like a real wave */}
        <motion.g
          style={{ transformOrigin: '13px 40px' }}
          animate={wave ? { rotate: [0, -24, 6, -20, 0] } : { rotate: 0 }}
          transition={{ duration: 1.1, ease: 'easeInOut', delay: 0.1 }}
        >
          <ellipse cx="9" cy="41" rx="6.5" ry="9.5" fill="rgb(var(--accent-400))" />
        </motion.g>

        {/* body — a soft rounded blob, not a perfect circle */}
        <path
          d="M32 5.5 C47 5.5 57.5 16.5 57.5 32 C57.5 47.5 47 58.5 31 58.5 C15.5 58.5 6.5 47.5 6.5 31.5 C6.5 16.5 17 5.5 32 5.5 Z"
          fill="url(#buddyBody)"
        />

        {/* cheeks */}
        <ellipse cx="18.5" cy="38" rx="3.2" ry="2.1" fill="white" opacity="0.30" />
        <ellipse cx="45.5" cy="38" rx="3.2" ry="2.1" fill="white" opacity="0.30" />

        {/* eyes — snap open/closed on blink, no easing, real blinks aren't a slow fade */}
        <ellipse cx="24" cy="29" rx="3.3" ry={blink ? 0.5 : 3.7} fill="#241B3D" />
        <ellipse cx="40" cy="29" rx="3.3" ry={blink ? 0.5 : 3.7} fill="#241B3D" />

        {/* smile */}
        <path d="M25 40 Q32 46.5 39 40" stroke="#241B3D" strokeWidth="2.3" strokeLinecap="round" fill="none" />

        {/* sparkle — the nova moment, in miniature */}
        <path d="M48 12 L49.6 16.2 L53.8 17.8 L49.6 19.4 L48 23.6 L46.4 19.4 L42.2 17.8 L46.4 16.2 Z" fill="white" opacity="0.9" />
      </svg>
    </motion.div>
  );
}
