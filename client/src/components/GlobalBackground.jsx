import React, { Suspense, lazy } from 'react';

// Spline's runtime is heavy, so it's lazy-loaded rather than bundled into
// the main app chunk. Mounted once at the App root (not per-page) so it
// persists smoothly across route changes instead of reloading.
const Spline = lazy(() => import('@splinetool/react-spline'));

export default function GlobalBackground() {
  return (
    <div className="fixed inset-0 -z-10 w-screen h-screen overflow-hidden">
      <Suspense fallback={<div className="w-full h-full bg-[#0c0a1a]" />}>
        <Spline scene="https://prod.spline.design/H-SRwMBChSgp1uzm/scene.splinecode" />
      </Suspense>
      {/* Contrast scrim — keeps every page's text readable over the
          brighter/shifting parts of the scene, regardless of light/dark mode. */}
      <div className="absolute inset-0 bg-black/35 pointer-events-none" />
    </div>
  );
}
