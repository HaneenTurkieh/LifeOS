import React, { Suspense, lazy } from 'react';
import { useTheme } from '../context/ThemeContext.jsx';
import { usePerformance } from '../context/PerformanceContext.jsx';

const Spline = lazy(() => import('@splinetool/react-spline'));

export default function GlobalBackground() {
const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
const { lowPower } = usePerformance();
  return (
    <div className="w-screen h-screen fixed top-0 left-0 -z-10 pointer-events-none transform scale-[1.35] md:scale-150 origin-center">
{lowPower ? (
        <div className="w-full h-full bg-gradient-to-br from-[#2a1f4d] via-[#1a1530] to-[#0c0a1a]" />
      ) : (
        <Suspense fallback={<div className="w-full h-full bg-[#0c0a1a]" />}>
          <Spline scene="https://prod.spline.design/H-SRwMBChSgp1uzm/scene.splinecode" />
        </Suspense>
      )}
<div
        className="absolute inset-0 transition-opacity duration-500"
        style={{ backgroundColor: '#05030c', opacity: isDark ? 0.72 : 0 }}
      />
    </div>
  );
}
