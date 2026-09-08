import React from 'react';
import { useTheme } from '../context/ThemeContext.jsx';

export default function GlobalBackground() {
  const { resolvedTheme, backgroundStyle } = useTheme();
  const isDark = resolvedTheme === 'dark';
  // 'aurora' is the original look below, unchanged (multiplier 1).
  // 'minimal' skips the orbs entirely — just the flat accent-tinted
  // wash, for anyone who wants a calmer, distraction-free screen while
  // studying. 'vivid' keeps the exact same orb layout but scales
  // opacity/size up for a bolder, more saturated feel. Composes with
  // any of the 7 accent colors "for free" since every orb below still
  // reads its color from the same --accent-* variables — this only
  // ever touches how much of that color shows, never which color.
  const style       = backgroundStyle || 'aurora';
  const showOrbs     = style !== 'minimal';
  const opacityMult = style === 'vivid' ? 1.35 : 1;
  const sizeMult     = style === 'vivid' ? 1.12 : 1;
  const op  = (v) => Math.min(v * opacityMult, 0.92);
  const sz  = (v) => Math.round(v * sizeMult);

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
          will-change: transform;
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
      `}</style>
      {showOrbs && (isDark ? (
        <>
          <div className="orb orb-1" style={{
            width: sz(480), height: sz(480),
            top: -140, left: -120,
            background: orbGrad('300', '500', 55),
            filter: 'blur(28px)',
            opacity: op(0.58),
          }} />
          <div className="orb orb-2" style={{
            width: sz(340), height: sz(340),
            bottom: -80, right: -60,
            background: orbGrad('200', '400', 45),
            filter: 'blur(22px)',
            opacity: op(0.48),
          }} />
          <div className="orb orb-3" style={{
            width: sz(180), height: sz(180),
            top: '35%', right: '8%',
            background: orbGrad('100', '400', 40),
            filter: 'blur(16px)',
            opacity: op(0.52),
          }} />
          <div className="orb orb-4" style={{
            width: sz(100), height: sz(100),
            top: '10%', right: '22%',
            background: `radial-gradient(circle, rgb(var(--accent-100)) 0%, rgb(var(--accent-500)) 100%)`,
            filter: 'blur(10px)',
            opacity: op(0.48),
          }} />
          <div className="orb orb-5" style={{
            width: sz(220), height: sz(220),
            bottom: '15%', left: '10%',
            background: orbGrad('400', '600', 75),
            filter: 'blur(20px)',
            opacity: op(0.38),
          }} />
        </>
      ) : (
        <>
          <div className="orb orb-1" style={{
            width: sz(440), height: sz(440),
            top: -120, left: -100,
            background: orbGradLight('200', '500'),
            filter: 'blur(26px)',
            opacity: op(0.44),
          }} />
          <div className="orb orb-2" style={{
            width: sz(300), height: sz(300),
            bottom: -60, right: -50,
            background: orbGradLight('100', '400'),
            filter: 'blur(20px)',
            opacity: op(0.40),
          }} />
          <div className="orb orb-3" style={{
            width: sz(160), height: sz(160),
            top: '30%', right: '10%',
            background: orbGradLight('50', '500'),
            filter: 'blur(14px)',
            opacity: op(0.46),
          }} />
          <div className="orb orb-4" style={{
            width: sz(90), height: sz(90),
            top: '12%', right: '25%',
            background: `radial-gradient(circle, rgb(var(--accent-50)) 0%, rgb(var(--accent-600)) 100%)`,
            filter: 'blur(9px)',
            opacity: op(0.42),
          }} />
          <div className="orb orb-5" style={{
            width: sz(200), height: sz(200),
            bottom: '18%', left: '8%',
            background: orbGradLight('200', '500'),
            filter: 'blur(18px)',
            opacity: op(0.32),
          }} />
        </>
      ))}
    </div>
  );
}