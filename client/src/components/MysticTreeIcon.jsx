import React from 'react';

// Shared with TreeShop.jsx (the designer) so every place that shows a
// Mystic Tree — the shop, the Focus timer, the Dashboard card, the
// productivity sphere, the "you just planted a tree" modal — renders
// the exact shape the person actually designed, instead of a generic
// placeholder emoji standing in for it.
//
// Every shape reads as an actual small tree — tapered trunk at the
// base, a magical canopy on top — rather than a disconnected icon.
const TRUNK_FILL = 'M32 62 C 30.5 54 30 48 32 42 C 34 48 33.5 54 32 62 Z';

export default function MysticSvg({ shapeKey, size = 56 }) {
  const common = { width: size, height: size, viewBox: '0 0 64 64' };
  if (shapeKey === 'crystal') {
    // Crystal tree — a faceted gem canopy in place of leaves.
    return (
      <svg {...common} fill="currentColor">
        <path d={TRUNK_FILL} opacity="0.5" />
        <polygon points="32,6 46,24 32,44 18,24" />
        <polygon points="32,6 32,44 18,24" opacity="0.35" fill="white" />
        <polygon points="14,30 22,26 20,40 10,38" opacity="0.8" />
        <polygon points="50,30 42,26 44,40 54,38" opacity="0.8" />
      </svg>
    );
  }
  if (shapeKey === 'orbs') {
    // Orb tree — branches bearing glowing magic orbs instead of fruit.
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <path d="M32 62 L32 38 M32 44 L20 30 M32 40 L44 26 M32 34 L32 16" />
        <circle cx="20" cy="26" r="8" fill="currentColor" stroke="none" opacity="0.9" />
        <circle cx="44" cy="22" r="7" fill="currentColor" stroke="none" opacity="0.85" />
        <circle cx="32" cy="12" r="6" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (shapeKey === 'bloom') {
    // Blossom tree — a radiating flower canopy, sakura-style.
    return (
      <svg {...common} fill="currentColor">
        <path d={TRUNK_FILL} opacity="0.5" />
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <ellipse key={deg} cx="32" cy="24" rx="7" ry="17" opacity="0.85" transform={`rotate(${deg} 32 24)`} />
        ))}
        <circle cx="32" cy="24" r="6" fill="white" opacity="0.9" />
      </svg>
    );
  }
  if (shapeKey === 'bough') {
    // Ancient bough — a gnarled, wise old tree with sparse budding branches.
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
        <path d="M32 60 L32 46 C 32 46 24 40 20 28 M32 46 C 32 46 40 38 46 24 M32 50 C 28 50 24 52 18 50" />
        <circle cx="20" cy="28" r="3" fill="currentColor" stroke="none" />
        <circle cx="46" cy="24" r="3" fill="currentColor" stroke="none" />
        <circle cx="18" cy="50" r="2.5" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  // spiral (default) — a straight trunk topped with a swirling, sparking canopy.
  return (
    <svg {...common} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
      <path d="M32 60 L32 40" />
      <path d="M32 40 C 20 40 14 30 20 22 C 25 16 34 18 32 26 C 31 30 26 29 27 25" />
      <circle cx="32" cy="8" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
