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
export default function NuvoraBuddy({ size = 64, wave = false, waveLoop = true, bob = true, mood = null, glow = true, onClick, className = '', title }) {
  const [blink, setBlink] = useState(false);
  const [waving, setWaving] = useState(wave);

  // Re-fires whenever the `wave` prop flips to true — not just on the
  // very first mount — so a caller can trigger an on-demand wave on an
  // already-mounted, persistent instance (e.g. the corner buddy waving
  // again when you come back after being away) instead of only ever
  // waving once for the component's whole lifetime.
  useEffect(() => {
    if (!wave) return;
    setWaving(true);
    const t = setTimeout(() => setWaving(false), 1150);
    return () => clearTimeout(t);
  }, [wave]);

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

  // Every so often the little sparkle on buddy's head throws off a few
  // grains of stardust — a tiny nova of its own, echoing the brand story
  // in miniature instead of just sitting there as a static icon.
  const [burstKey, setBurstKey] = useState(0);
  useEffect(() => {
    if (!glow) return;
    let cancelled = false;
    let t;
    const loop = () => {
      const delay = 5000 + Math.random() * 5000;
      t = setTimeout(() => {
        if (cancelled) return;
        setBurstKey((k) => k + 1);
        loop();
      }, delay);
    };
    loop();
    return () => { cancelled = true; clearTimeout(t); };
  }, [glow]);
  const STARDUST = [
    { dx: -7, dy: -9,  delay: 0    },
    { dx: 6,  dy: -11, delay: 0.08 },
    { dx: 1,  dy: -14, delay: 0.16 },
  ];

  // Mouth shape by mood: bigger smile on great days, flatter on okay days,
  // a gentle downturn (+ worried brows) on rough/meh ones. The resting
  // default — no mood logged yet, OR mood === 4 ("good", which never had
  // its own shape) — is a clear, unmistakable smile, not the fainter
  // curve this used to fall back to. Nova's "neutral" is happy, not blank.
  const mouthPath =
    mood >= 5 ? 'M23 39 Q32 49.5 41 39' :
    mood === 3 ? 'M25 41.5 Q32 43.5 39 41.5' :
    mood != null && mood <= 2 ? 'M25 42.5 Q32 38 39 42.5' :
    'M24 39.5 Q32 48 40 39.5';
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
      {/* ambient aura — a soft breathing glow behind the body, plus a thin
          orbiting ring, matching the "planet with a halo" reference look.
          Purely decorative: absolutely positioned, no pointer events, sits
          behind the SVG via -z-10 within this component's own stacking
          context (the wrapper above is already `relative`). */}
      {glow && (
        <>
          <motion.div
            className="pointer-events-none absolute inset-0 -z-10 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgb(var(--accent-300) / 0.9) 0%, rgb(var(--accent-500) / 0.55) 40%, transparent 72%)',
              filter: `blur(${Math.max(10, size * 0.32)}px)`,
            }}
            animate={{ opacity: [0.55, 0.95, 0.55], scale: [1.55, 1.85, 1.55] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.svg
            viewBox="0 0 64 64" width="100%" height="100%"
            className="pointer-events-none absolute inset-0"
            style={{ overflow: 'visible' }}
            animate={{ rotate: 360 }}
            transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
          >
            <ellipse cx="32" cy="32" rx="35" ry="13" fill="none" stroke="white" strokeOpacity="0.4" strokeWidth="0.9" transform="rotate(-20 32 32)" />
          </motion.svg>
        </>
      )}
      <svg viewBox="0 0 64 64" width="100%" height="100%"
        style={{ filter: 'drop-shadow(0 6px 16px rgb(var(--accent-500) / 0.45))', overflow: 'visible' }}>
        <defs>
          <radialGradient id="buddyBody" cx="35%" cy="28%" r="75%">
            <stop offset="0%"  stopColor="rgb(var(--accent-300))" />
            <stop offset="55%" stopColor="rgb(var(--accent-500))" />
            <stop offset="100%" stopColor="rgb(var(--accent-700))" />
          </radialGradient>
          {/* Star-eye shape for "great" mood — matches the 🤩 on the
              mood-of-the-day picker. Defined once, centered on its own
              origin, then placed twice via <use> at each eye socket. */}
          <path id="buddyEyeStar" d="M0 -4.4 L1.3 -1.2 L4.4 0 L1.3 1.2 L0 4.4 L-1.3 1.2 L-4.4 0 L-1.3 -1.2 Z" fill="#241B3D" />
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

        {/* eyes — star-struck on great days (no blink, stars don't blink);
            otherwise the normal round eyes, snapping open/closed on blink
            with no easing since real blinks aren't a slow fade */}
        {mood >= 5 ? (
          <>
            <use href="#buddyEyeStar" x="24" y="29" />
            <use href="#buddyEyeStar" x="40" y="29" />
          </>
        ) : (
          <>
            <ellipse cx="24" cy="29" rx="3.3" ry={blink ? 0.5 : 3.7} fill="#241B3D" />
            <ellipse cx="40" cy="29" rx="3.3" ry={blink ? 0.5 : 3.7} fill="#241B3D" />
          </>
        )}

        {/* smile — shape follows mood */}
        <path d={mouthPath} stroke="#241B3D" strokeWidth="2.3" strokeLinecap="round" fill="none" />

        {/* sparkle — the nova moment, in miniature */}
        <path d="M48 12 L49.6 16.2 L53.8 17.8 L49.6 19.4 L48 23.6 L46.4 19.4 L42.2 17.8 L46.4 16.2 Z" fill="white" opacity="0.9" />

        {/* stardust burst — re-plays whenever burstKey changes, throwing
            a few grains off the sparkle that drift out and fade */}
        {glow && (
          <g key={burstKey}>
            {STARDUST.map((p, i) => (
              <motion.circle key={i} r="1.15" fill="white"
                initial={{ opacity: 0, cx: 48, cy: 17 }}
                animate={{ opacity: [0, 1, 0], cx: 48 + p.dx, cy: 17 + p.dy }}
                transition={{ duration: 1.3, delay: p.delay, ease: 'easeOut' }}
              />
            ))}
          </g>
        )}
      </svg>
    </motion.div>
  );
}
