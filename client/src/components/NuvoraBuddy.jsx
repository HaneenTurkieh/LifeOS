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
// metronome), waves once on mount via the `wave` prop, AND — separately —
// waves again on its own every so often (`waveLoop`, on by default) so it
// reads as alive anywhere it's parked, not just in the one-time cinematic
// intro. This is what makes the persistent corner bubble and the login
// page's companion feel interactive instead of a static sticker.
//
// `mood` (1-5, same scale as the dashboard's mood-of-the-day picker) swaps
// the mouth curve and, on rough days, adds a pair of soft concerned brows —
// so the same character reflects how the day's actually going instead of
// always wearing one fixed expression. Leave it unset for the default
// happy face.
export default function NuvoraBuddy({ size = 64, wave = false, waveLoop = true, bob = true, mood = null, onClick, className = '', title }) {
  const [blink, setBlink] = useState(false);
  const [waving, setWaving] = useState(wave);

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

  useEffect(() => {
    if (!waveLoop) return;
    let cancelled = false;
    let t1, t2;
    const loop = () => {
      const delay = 9000 + Math.random() * 7000; // idle stretch, then a quick wave
      t1 = setTimeout(() => {
        if (cancelled) return;
        setWaving(true);
        t2 = setTimeout(() => { if (!cancelled) setWaving(false); }, 1150);
        loop();
      }, delay);
    };
    loop();
    return () => { cancelled = true; clearTimeout(t1); clearTimeout(t2); };
  }, [waveLoop]);

  // Mouth shape by mood: bigger smile on great days, flatter on okay days,
  // a gentle downturn (+ worried brows) on rough/meh ones. Falls back to
  // the original friendly default when no mood is known yet.
  const mouthPath =
    mood >= 5 ? 'M23 39 Q32 49.5 41 39' :
    mood === 3 ? 'M25 41.5 Q32 43.5 39 41.5' :
    mood != null && mood <= 2 ? 'M25 42.5 Q32 38 39 42.5' :
    'M25 40 Q32 46.5 39 40';
  const showConcernBrows = mood != null && mood <= 2;

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
          animate={waving ? { rotate: [0, -24, 6, -20, 0] } : { rotate: 0 }}
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

        {/* worried brows — only on rough/meh mood days */}
        {showConcernBrows && (
          <>
            <path d="M20 22.5 Q24 20 28 22.5" stroke="#241B3D" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.5" />
            <path d="M36 22.5 Q40 20 44 22.5" stroke="#241B3D" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.5" />
          </>
        )}

        {/* eyes — snap open/closed on blink, no easing, real blinks aren't a slow fade */}
        <ellipse cx="24" cy="29" rx="3.3" ry={blink ? 0.5 : 3.7} fill="#241B3D" />
        <ellipse cx="40" cy="29" rx="3.3" ry={blink ? 0.5 : 3.7} fill="#241B3D" />

        {/* smile — shape follows mood */}
        <path d={mouthPath} stroke="#241B3D" strokeWidth="2.3" strokeLinecap="round" fill="none" />

        {/* sparkle — the nova moment, in miniature */}
        <path d="M48 12 L49.6 16.2 L53.8 17.8 L49.6 19.4 L48 23.6 L46.4 19.4 L42.2 17.8 L46.4 16.2 Z" fill="white" opacity="0.9" />
      </svg>
    </motion.div>
  );
}
