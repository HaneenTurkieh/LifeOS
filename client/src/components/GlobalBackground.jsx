import React from 'react';
import { useTheme } from '../context/ThemeContext.jsx';

export default function GlobalBackground() {
  const { resolvedTheme, backgroundStyle } = useTheme();
  const isDark = resolvedTheme === 'dark';
  // 'aurora' is the original look below, unchanged — soft round orbs,
  // gentle drift. 'minimal' fades the drifting shapes out to a single
  // slow, soft "breathing" glow instead of cutting straight to a flat
  // wash — zero motion read as "nothing happened" rather than an
  // intentional calm choice, so this keeps just enough life in it to
  // feel deliberate while still being the calmest, least-distracting
  // option. 'vivid' used to just be "the same orbs, bigger" — too subtle
  // to actually notice next to Aurora. Now it swaps the shape language
  // entirely: organic rotating blobs instead of plain circles, with a
  // much bigger swing/rotation on the drift, so it reads as clearly
  // different at a glance instead of a faint size/opacity bump. Composes
  // with any of the 7 accent colors "for free" since every shape below
  // still reads its color from the same --accent-* variables — this only
  // ever touches shape/motion, never which color.
  const style       = backgroundStyle || 'aurora';
  const isMinimal   = style === 'minimal';
  const isVivid     = style === 'vivid';
  const opacityMult = isVivid ? 1.35 : 1;
  const sizeMult     = isVivid ? 1.12 : 1;
  // Orbs stay mounted across every style switch now (rather than being
  // conditionally rendered) — only their opacity changes, and the CSS
  // transition on .orb below is what turns that into a smooth cross-fade
  // instead of an instant snap when someone taps a different style.
  const op   = (v) => (isMinimal ? 0 : Math.min(v * opacityMult, 0.92));
  const sz   = (v) => Math.round(v * sizeMult);
  // Picks the plain-circle "aurora" class or the bigger-swing "blob"
  // class per shape slot (1-5). Vivid also drops the circular border
  // radius in favor of an organic one baked into the vivid keyframes.
  const cls  = (n) => `orb ${isVivid ? `orb-${n}-vivid` : `orb-${n}`}`;

  // Every orb and the base wash now pull from the --accent-* CSS
  // variables (index.css), which flip instantly when the premium
  // theme preset changes — purple/orange/pink/blue/green/coral/gold,
  // everywhere.
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
          will-change: transform, opacity, width, height, border-radius;
          transition: opacity 900ms ease, width 900ms ease, height 900ms ease, filter 900ms ease, border-radius 900ms ease;
        }
        /* Aurora — the original look: neat circles, mild drift. */
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
        /* Vivid — organic rotating blobs with a much wider swing than
           Aurora's drift, so the two are unmistakable side by side
           instead of "same circles, slightly bigger". */
        .orb-1-vivid { animation: driftVivid1 12s ease-in-out infinite;          border-radius: 58% 42% 63% 37% / 47% 55% 45% 53%; }
        .orb-2-vivid { animation: driftVivid2 15s ease-in-out infinite;          border-radius: 42% 58% 39% 61% / 58% 44% 56% 42%; }
        .orb-3-vivid { animation: driftVivid3 13s ease-in-out infinite;          border-radius: 63% 37% 55% 45% / 41% 59% 41% 59%; }
        .orb-4-vivid { animation: driftVivid4 10s ease-in-out infinite;          border-radius: 45% 55% 62% 38% / 55% 40% 60% 45%; }
        .orb-5-vivid { animation: driftVivid1 14s ease-in-out infinite reverse;  border-radius: 55% 45% 40% 60% / 60% 35% 65% 40%; }
        @keyframes driftVivid1 {
          0%,100% { transform: translate(0,0) rotate(0deg) scale(1); }
          33%      { transform: translate(55px,-45px) rotate(18deg) scale(1.14); }
          66%      { transform: translate(-42px,50px) rotate(-14deg) scale(0.9); }
        }
        @keyframes driftVivid2 {
          0%,100% { transform: translate(0,0) rotate(0deg) scale(1); }
          40%      { transform: translate(-60px,38px) rotate(-20deg) scale(1.1); }
          70%      { transform: translate(45px,-52px) rotate(16deg) scale(0.92); }
        }
        @keyframes driftVivid3 {
          0%,100% { transform: translate(0,0) rotate(0deg); }
          50%      { transform: translate(48px,58px) rotate(22deg); }
        }
        @keyframes driftVivid4 {
          0%,100% { transform: translate(0,0) rotate(0deg) scale(1); }
          50%      { transform: translate(-46px,-40px) rotate(-25deg) scale(1.16); }
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
      `}</style>
      {/* Minimal's "still alive" glow — always mounted (like the shapes
          below) so switching in/out of Minimal cross-fades via the
          transition on opacity instead of popping in/out. Deliberately
          much calmer than the orb/blob set: one soft circle, slow
          breathing, no drifting position. */}
      <div className="minimal-glow" style={{
        width: 520, height: 520,
        background: isDark
          ? `radial-gradient(circle, rgb(var(--accent-400) / 0.32) 0%, transparent 70%)`
          : `radial-gradient(circle, rgb(var(--accent-300) / 0.30) 0%, transparent 70%)`,
        filter: 'blur(40px)',
        opacity: isMinimal ? 1 : 0,
      }} />
      {isDark ? (
        <>
          <div className={cls(1)} style={{
            width: sz(480), height: sz(480),
            top: -140, left: -120,
            background: orbGrad('300', '500', 55),
            filter: 'blur(28px)',
            opacity: op(0.58),
          }} />
          <div className={cls(2)} style={{
            width: sz(340), height: sz(340),
            bottom: -80, right: -60,
            background: orbGrad('200', '400', 45),
            filter: 'blur(22px)',
            opacity: op(0.48),
          }} />
          <div className={cls(3)} style={{
            width: sz(180), height: sz(180),
            top: '35%', right: '8%',
            background: orbGrad('100', '400', 40),
            filter: 'blur(16px)',
            opacity: op(0.52),
          }} />
          <div className={cls(4)} style={{
            width: sz(100), height: sz(100),
            top: '10%', right: '22%',
            background: `radial-gradient(circle, rgb(var(--accent-100)) 0%, rgb(var(--accent-500)) 100%)`,
            filter: 'blur(10px)',
            opacity: op(0.48),
          }} />
          <div className={cls(5)} style={{
            width: sz(220), height: sz(220),
            bottom: '15%', left: '10%',
            background: orbGrad('400', '600', 75),
            filter: 'blur(20px)',
            opacity: op(0.38),
          }} />
        </>
      ) : (
        <>
          <div className={cls(1)} style={{
            width: sz(440), height: sz(440),
            top: -120, left: -100,
            background: orbGradLight('200', '500'),
            filter: 'blur(26px)',
            opacity: op(0.44),
          }} />
          <div className={cls(2)} style={{
            width: sz(300), height: sz(300),
            bottom: -60, right: -50,
            background: orbGradLight('100', '400'),
            filter: 'blur(20px)',
            opacity: op(0.40),
          }} />
          <div className={cls(3)} style={{
            width: sz(160), height: sz(160),
            top: '30%', right: '10%',
            background: orbGradLight('50', '500'),
            filter: 'blur(14px)',
            opacity: op(0.46),
          }} />
          <div className={cls(4)} style={{
            width: sz(90), height: sz(90),
            top: '12%', right: '25%',
            background: `radial-gradient(circle, rgb(var(--accent-50)) 0%, rgb(var(--accent-600)) 100%)`,
            filter: 'blur(9px)',
            opacity: op(0.42),
          }} />
          <div className={cls(5)} style={{
            width: sz(200), height: sz(200),
            bottom: '18%', left: '8%',
            background: orbGradLight('200', '500'),
            filter: 'blur(18px)',
            opacity: op(0.32),
          }} />
        </>
      )}
    </div>
  );
}
