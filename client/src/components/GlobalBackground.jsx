import React, { Suspense, lazy } from 'react';

const Spline = lazy(() => import('@splinetool/react-spline'));

export default function GlobalBackground() {
  return (
    <div className="w-screen h-screen fixed top-0 left-0 -z-10 pointer-events-none transform scale-[1.35] md:scale-150 origin-center">
      <Suspense fallback={<div className="w-full h-full bg-[#0c0a1a]" />}>
        <Spline scene="https://prod.spline.design/H-SRwMBChSgp1uzm/scene.splinecode" />
      </Suspense>
    </div>
  );
}
