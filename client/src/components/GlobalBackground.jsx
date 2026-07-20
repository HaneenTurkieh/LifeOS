import React, { Suspense, lazy } from 'react';
import { useTheme } from '../context/ThemeContext.jsx';

const Spline = lazy(() => import('@splinetool/react-spline'));

export default function GlobalBackground() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  return (
    <div className="w-screen h-screen fixed top-0 left-0 -z-10 pointer-events-none scale-x-150 scale-y-[175%]">
      <Suspense fallback={<div className="w-full h-full bg-[#060B18]" />}>
        <Spline scene="https://prod.spline.design/H-SRwMBChSgp1uzm/scene.splinecode" />
      </Suspense>
      {/* Environmental overlay — tones aurora down to atmospheric lighting */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(6,11,24,0.35) 0%, rgba(6,11,24,0.55) 100%)',
          opacity: isDark ? 1 : 0.5,
          backdropFilter: 'blur(2px)',
        }}
      />
    </div>
  );
}

