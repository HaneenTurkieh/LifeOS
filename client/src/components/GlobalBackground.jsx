import React, { Suspense, lazy, memo } from 'react';
import { useTheme } from '../context/ThemeContext.jsx';

const SplineScene = memo(lazy(() => import('@splinetool/react-spline')));

export default function GlobalBackground() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div
      className="w-screen h-screen fixed top-0 left-0 -z-10 pointer-events-none scale-x-150 scale-y-[175%]"
      style={{ opacity: isDark ? 0.38 : 0.12 }} // ← light mode dropped from 0.22 → 0.12
    >
      <Suspense fallback={<div className="w-full h-full" style={{ backgroundColor: isDark ? '#070B14' : '#F4F6FB' }} />}>
        <SplineScene scene="https://prod.spline.design/H-SRwMBChSgp1uzm/scene.splinecode" />
      </Suspense>

      {/* Light mode — heavy white wash to push aurora into background */}
      {!isDark && (
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 100% 80% at 50% 50%, rgba(244,246,251,0.82) 0%, rgba(244,246,251,0.92) 100%)',
          }}
        />
      )}

      {/* Dark mode — navy overlay */}
      {isDark && (
        <div
          className="absolute inset-0 transition-opacity duration-500"
          style={{ backgroundColor: '#05030c', opacity: 0.72 }}
        />
      )}
    </div>
  );
}