import React from 'react';
import { useTheme } from '../context/ThemeContext.jsx';

// Note (Sept 2026): nuvora.ps's Vercel edge cache served a ~50min-stale
// copy of index.html after the sparkle-field deploy went out, pointing
// browsers at the old (blob-rotation) JS bundle regardless of hard
// refresh or browser — confirmed via response headers (x-vercel-cache:
// HIT, high age, even on a cache:'no-store' fetch), not a browser-side
// caching issue. This comment exists solely to force a fresh build/asset
// hash and re-trigger Vercel's cache invalidation for the domain.

// Vivid's particle field — computed once at module load (not per-render,
// and not with Math.random(), which would make the layout jump around on
// every re-render/theme change). Coprime-ish multipliers on the index
// give an organic-looking scatter across the viewport without actually
// being random. Two tiers: a handful of bigger, softer "glow motes" for
// depth, and a larger number of small, brighter "sparkle" points that do
// most of the work of reading as "a field of light" rather than "two big
// shapes" — a genuinely different visual language from Aurora's drifting
// orbs and Minimal's single glow, not just a resized/rotated version of
// the same idea.
const VIVID_GLOWS = Array.from({ length: 9 }, (_, i) => ({
  top:      (i * 41 + 6) % 100,
  left:     (i * 67 + 9) % 100,
  size:     16 + (i % 4) * 6,
  delay:    (i % 5) * 0.6,
  duration: 4 + (i % 4) * 0.8,
}));
const VIVID_SPARKLES = Array.from({ length: 24 }, (_, i) => ({
  top:      (i * 29 + 3) % 100,
  left:     (i * 53 + 17) % 100,
  size:     3 + (i % 4) * 1.4,
  delay:    (i % 8) * 0.3,
  duration: 1.8 + (i % 5) * 0.4,
}));

export default function GlobalBackground() {
  const { resolvedTheme, backgroundStyle } = useTheme();
  const isDark = resolvedTheme === 'dark';
  // 'aurora' is the original look below, unchanged — soft round orbs,
  // gentle drift. 'minimal' fades the orbs out to a single slow, soft
  // "breathing" glow instead of cutting straight to a flat wash — zero
  // motion read as "nothing happened" rather than an intentional calm
  // choice, so this keeps just enough life in it to feel deliberate
  // while still being the calmest, least-distracting option. 'vivid'
  // used to just be "the same orbs, bigger", then "the same orbs, but
  // rotating blobs" — both still read as basically the same background
  // next to Aurora. It's now a completely different shape language: a
  // scattered, twinkling particle field instead of a couple of large
  // soft shapes. All three layers stay mounted at all times and only
  // ever cross-fade their own opacity (see the transitions below), so
  // switching between them is a smooth 900ms blend, never an instant
  // swap. Every layer still reads its color from the same --accent-*
  // variables (index.css), so this composes with any of the 7 accent
  // colors "for free" — this only ever touches shape/motion, never which
  // color.
  const style      = backgroundStyle || 'aurora';
  const isAurora   = style === 'aurora' || !style;
  const isMinimal  = style === 'minimal';
  const isVivid    = style === 'vivid';
  const orbOpacity = (v) => (isAurora ? Math.min(v, 0.92) : 0);

  // Every shape below pulls from the --accent-* CSS variables, which
  // flip instantly when the premium theme preset changes —
  // purple/orange/pink/blue/green/coral/gold, everywhere.
  const orbGrad = (inner, mid, outerOpacity = 60) =>
    `radial-gradient(circle at 38% 35%, rgb(var(--accent-${inner})) 0%, rgb(var(--accent-${mid})) 50%, color-mix(in srgb, rgb(var(--accent-700)) ${outerOpacity}%, black) 100%)`;

  const orbGradLight = (inner, mid) =>
    `radial-gradient(circle at 38% 35%, rgb(var(--accent-${inner})) 0%, rgb(var(--accent-${mid})) 55%, color-mix(in srgb, rgb(var(--accent-700)) 65%, white) 100%)`;

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: isDark
            ? 'color-mix(in srgb, rgb(var(--accent-700)) 7%, #080612)'
            : 'color-mix(in srgb, rgb(var(--accent-100)) 55%, #F4F6FB)',
        }}
      />
      <style>{`
        .orb {
          position: absolute;
          border-radius: 50%;
          will-change: transform, opacity;
          transition: opacity 900ms ease, filter 900ms ease;
        }
        .orb-1 { animation: drift1 18s ease-in-out infinite; }
        .orb-2 { animation: drift2 24s ease-in-out infinite; }
        .orb-3 { animation: drift3 20s ease-in-out infinite; }
        .orb-4 { animation: drift4 15s ease-in-out infinite; }
        .orb-5 { animation: drift1 22s ease-in-out infinite reverse; }
        @keyframes drift1 {
          0%,100% { transform: translate(0,0) scale(1); }
          33%      { transform: translate(25px,-20px) scale(1.06); }
          66%      { transform: translate(-18px,22px) scale(0.96); }
        }
        @keyframes drift2 {
          0%,100% { transform: translate(0,0) scale(1); }
          40%      { transform: translate(-30px,18px) scale(1.04); }
          70%      { transform: translate(20px,-25px) scale(0.97); }
        }
        @keyframes drift3 {
          0%,100% { transform: translate(0,0); }
          50%      { transform: translate(22px,28px); }
        }
        @keyframes drift4 {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(-20px,-18px) scale(1.08); }
        }
        .minimal-glow {
          position: absolute;
          top: 50%;
          left: 50%;
          border-radius: 50%;
          will-change: opacity, transform;
          transition: opacity 900ms ease;
          animation: breathe 9s ease-in-out infinite;
        }
        @keyframes breathe {
          0%,100%  { transform: translate(-50%,-50%) scale(1); }
          50%       { transform: translate(-50%,-50%) scale(1.12); }
        }
        .vivid-field {
          transition: opacity 900ms ease;
        }
        .vivid-glow {
          position: absolute;
          border-radius: 50%;
          transform: translate(-50%,-50%);
          animation-name: vividGlowPulse;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }
        @keyframes vividGlowPulse {
          0%,100% { opacity: 0.22; transform: translate(-50%,-50%) scale(1);    }
          50%      { opacity: 0.65; transform: translate(-50%,-50%) scale(1.2); }
        }
        .vivid-sparkle {
          position: absolute;
          border-radius: 50%;
          transform: translate(-50%,-50%);
          animation-name: vividSparkleTwinkle;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }
        @keyframes vividSparkleTwinkle {
          0%,100% { opacity: 0.12; transform: translate(-50%,-50%) scale(0.8); }
          50%      { opacity: 0.95; transform: translate(-50%,-50%) scale(1.15); }
        }
      `}</style>
      {/* Minimal's "still alive" glow — always mounted (like everything
          else here) so switching in/out of Minimal cross-fades via the
          opacity transition instead of popping in/out. Deliberately much
          calmer than the other two styles: one soft circle, slow
          breathing, no drifting position. */}
      <div className="minimal-glow" style={{
        width: 520, height: 520,
        background: isDark
          ? `radial-gradient(circle, rgb(var(--accent-400) / 0.32) 0%, transparent 70%)`
          : `radial-gradient(circle, rgb(var(--accent-300) / 0.30) 0%, transparent 70%)`,
        filter: 'blur(40px)',
        opacity: isMinimal ? 1 : 0,
      }} />
      {/* Vivid's twinkling particle field — a scattered set of small
          points and a few soft glow motes behind them, each pulsing on
          its own independent cycle. Wrapped in one container so the
          whole field cross-fades in/out together when switching styles,
          while the individual twinkle animations keep running underneath
          that. */}
      <div className="vivid-field absolute inset-0" style={{ opacity: isVivid ? 1 : 0 }}>
        {VIVID_GLOWS.map((g, i) => (
          <div key={`vg${i}`} className="vivid-glow" style={{
            top: `${g.top}%`, left: `${g.left}%`,
            width: g.size, height: g.size,
            background: isDark
              ? `radial-gradient(circle, rgb(var(--accent-300) / 0.9) 0%, transparent 70%)`
              : `radial-gradient(circle, rgb(var(--accent-400) / 0.75) 0%, transparent 70%)`,
            filter: 'blur(8px)',
            animationDelay: `${g.delay}s`,
            animationDuration: `${g.duration}s`,
          }} />
        ))}
        {VIVID_SPARKLES.map((s, i) => (
          <div key={`vs${i}`} className="vivid-sparkle" style={{
            top: `${s.top}%`, left: `${s.left}%`,
            width: s.size, height: s.size,
            background: `rgb(var(--accent-300))`,
            boxShadow: `0 0 ${Math.round(s.size * 2.2)}px rgb(var(--accent-400) / 0.9)`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }} />
        ))}
      </div>
      {isDark ? (
        <>
          <div className="orb orb-1" style={{
            width: 480, height: 480,
            top: -140, left: -120,
            background: orbGrad('300', '500', 55),
            filter: 'blur(28px)',
            opacity: orbOpacity(0.58),
          }} />
          <div className="orb orb-2" style={{
            width: 340, height: 340,
            bottom: -80, right: -60,
            background: orbGrad('200', '400', 45),
            filter: 'blur(22px)',
            opacity: orbOpacity(0.48),
          }} />
          <div className="orb orb-3" style={{
            width: 180, height: 180,
            top: '35%', right: '8%',
            background: orbGrad('100', '400', 40),
            filter: 'blur(16px)',
            opacity: orbOpacity(0.52),
          }} />
          <div className="orb orb-4" style={{
            width: 100, height: 100,
            top: '10%', right: '22%',
            background: `radial-gradient(circle, rgb(var(--accent-100)) 0%, rgb(var(--accent-500)) 100%)`,
            filter: 'blur(10px)',
            opacity: orbOpacity(0.48),
          }} />
          <div className="orb orb-5" style={{
            width: 220, height: 220,
            bottom: '15%', left: '10%',
            background: orbGrad('400', '600', 75),
            filter: 'blur(20px)',
            opacity: orbOpacity(0.38),
          }} />
        </>
      ) : (
        <>
          <div className="orb orb-1" style={{
            width: 440, height: 440,
            top: -120, left: -100,
            background: orbGradLight('200', '500'),
            filter: 'blur(26px)',
            opacity: orbOpacity(0.44),
          }} />
          <div className="orb orb-2" style={{
            width: 300, height: 300,
            bottom: -60, right: -50,
            background: orbGradLight('100', '400'),
            filter: 'blur(20px)',
            opacity: orbOpacity(0.40),
          }} />
          <div className="orb orb-3" style={{
            width: 160, height: 160,
            top: '30%', right: '10%',
            background: orbGradLight('50', '500'),
            filter: 'blur(14px)',
            opacity: orbOpacity(0.46),
          }} />
          <div className="orb orb-4" style={{
            width: 90, height: 90,
            top: '12%', right: '25%',
            background: `radial-gradient(circle, rgb(var(--accent-50)) 0%, rgb(var(--accent-600)) 100%)`,
            filter: 'blur(9px)',
            opacity: orbOpacity(0.42),
          }} />
          <div className="orb orb-5" style={{
            width: 200, height: 200,
            bottom: '18%', left: '8%',
            background: orbGradLight('200', '500'),
            filter: 'blur(18px)',
            opacity: orbOpacity(0.32),
          }} />
        </>
      )}
    </div>
  );
}
