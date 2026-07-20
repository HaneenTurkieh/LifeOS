import React, { Suspense, lazy } from 'react';
import { useTheme } from '../context/ThemeContext.jsx';
const Spline = lazy(() => import('@splinetool/react-spline'));

export default function GlobalBackground() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  return (
    <div
      className="w-screen h-screen fixed top-0 left-0 -z-10 pointer-events-none scale-x-150 scale-y-[175%]"
      /* Additional opacity wrapper — reduces entire Spline scene by 40% */
      style={{ opacity: isDark ? 0.38 : 0.22 }}
    >
      <Suspense fallback={<div className="w-full h-full" style={{ backgroundColor: '#070B14' }} />}>
        <Spline scene="https://prod.spline.design/H-SRwMBChSgp1uzm/scene.splinecode" />
      </Suspense>
      {/* Heavy overlay — pushes aurora to pure environmental lighting */}
      <div
        className="absolute inset-0"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse 100% 80% at 50% 50%, rgba(7,11,20,0.55) 0%, rgba(7,11,20,0.82) 100%)'
            : 'radial-gradient(ellipse 100% 80% at 50% 50%, rgba(240,245,255,0.55) 0%, rgba(240,245,255,0.80) 100%)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />
    </div>
  );
}