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
    // Crystal tree — a geode cluster instead of a single lonely gem:
    // one tall central shard flanked by two mid shards and two small
    // splinters, each with its own facet highlight.
    return (
      <svg {...common} fill="currentColor">
        <path d={TRUNK_FILL} opacity="0.5" />
        <polygon points="32,4 40,20 32,46 24,20" />
        <polygon points="32,4 32,46 24,20" opacity="0.35" fill="white" />
        <polygon points="16,26 24,20 22,42 12,38" opacity="0.85" />
        <polygon points="16,26 22,42 12,38" opacity="0.28" fill="white" />
        <polygon points="48,26 40,20 42,42 52,38" opacity="0.85" />
        <polygon points="48,26 42,42 52,38" opacity="0.28" fill="white" />
        <polygon points="8,42 12,38 11,49 6,47" opacity="0.6" />
        <polygon points="56,42 52,38 53,49 58,47" opacity="0.6" />
      </svg>
    );
  }
  if (shapeKey === 'orbs') {
    // Orb tree — a fuller branch structure carrying six glowing orbs of
    // varying size instead of three, plus a tiny highlight spark.
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <path d="M32 62 L32 34 M32 42 L18 30 M32 38 L46 26 M32 30 L14 18 M32 26 L50 16 M32 20 L32 6" />
        <circle cx="18" cy="30" r="7" fill="currentColor" stroke="none" opacity="0.9" />
        <circle cx="46" cy="26" r="6" fill="currentColor" stroke="none" opacity="0.85" />
        <circle cx="14" cy="18" r="5" fill="currentColor" stroke="none" opacity="0.8" />
        <circle cx="50" cy="16" r="5" fill="currentColor" stroke="none" opacity="0.8" />
        <circle cx="32" cy="6"  r="6" fill="currentColor" stroke="none" />
        <circle cx="26" cy="13" r="1.8" fill="white" stroke="none" opacity="0.85" />
      </svg>
    );
  }
  if (shapeKey === 'bloom') {
    // Blossom tree — two layered rings of petals (large + smaller,
    // rotated between them) for a fuller sakura canopy, plus a couple
    // of petals drifting free below it.
    return (
      <svg {...common} fill="currentColor">
        <path d={TRUNK_FILL} opacity="0.5" />
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <ellipse key={`o${deg}`} cx="32" cy="22" rx="8" ry="19" opacity="0.8" transform={`rotate(${deg} 32 22)`} />
        ))}
        {[30, 90, 150, 210, 270, 330].map((deg) => (
          <ellipse key={`i${deg}`} cx="32" cy="22" rx="5" ry="12" opacity="0.5" fill="white" transform={`rotate(${deg} 32 22)`} />
        ))}
        <circle cx="32" cy="22" r="5" fill="white" opacity="0.95" />
        <ellipse cx="14" cy="52" rx="3" ry="5" opacity="0.5" transform="rotate(-30 14 52)" />
        <ellipse cx="50" cy="48" rx="2.5" ry="4" opacity="0.4" transform="rotate(40 50 48)" />
      </svg>
    );
  }
  if (shapeKey === 'bough') {
    // Ancient bough — more twisting branches and budding tips than the
    // original two-branch version, so it reads as gnarled, not just bare.
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
        <path d="M32 60 L32 44 C 32 44 22 40 16 26 M32 44 C 32 44 42 38 48 22 M32 50 C 27 50 22 53 14 52 M32 48 C 35 47 40 49 46 46" />
        <circle cx="16" cy="26" r="3"   fill="currentColor" stroke="none" />
        <circle cx="48" cy="22" r="3"   fill="currentColor" stroke="none" />
        <circle cx="14" cy="52" r="2.5" fill="currentColor" stroke="none" />
        <circle cx="46" cy="46" r="2.5" fill="currentColor" stroke="none" />
        <circle cx="24" cy="18" r="2"   fill="currentColor" stroke="none" opacity="0.7" />
        <circle cx="52" cy="16" r="2"   fill="currentColor" stroke="none" opacity="0.7" />
      </svg>
    );
  }
  if (shapeKey === 'nova') {
    // Nova tree — new option. The canopy is a burst of light, the same
    // shape as buddy's own sparkle and the brand's nova story, echoed
    // by two smaller sparkles catching light nearby.
    return (
      <svg {...common} fill="currentColor">
        <path d={TRUNK_FILL} opacity="0.5" />
        <path d="M32 4 L36 20 L52 24 L36 28 L32 44 L28 28 L12 24 L28 20 Z" />
        <path d="M14 12 L15.6 16.2 L19.8 17.8 L15.6 19.4 L14 23.6 L12.4 19.4 L8.2 17.8 L12.4 16.2 Z" opacity="0.75" />
        <path d="M52 10 L53.2 13.2 L56.4 14.4 L53.2 15.6 L52 18.8 L50.8 15.6 L47.6 14.4 L50.8 13.2 Z" opacity="0.7" />
      </svg>
    );
  }
  if (shapeKey === 'aurora') {
    // Aurora tree — new option. Flowing ribbons instead of foliage,
    // like curtains of northern light caught mid-drift over the trunk.
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeLinecap="round">
        <path d={TRUNK_FILL} fill="currentColor" stroke="none" opacity="0.5" />
        <path d="M14 40 C 20 22 28 34 32 16 C 36 34 44 22 50 40" strokeWidth="4" opacity="0.9" />
        <path d="M18 44 C 24 28 30 38 32 22 C 34 38 40 28 46 44" strokeWidth="3" opacity="0.5" />
        <circle cx="14" cy="40" r="1.8" fill="currentColor" stroke="none" />
        <circle cx="50" cy="40" r="1.8" fill="currentColor" stroke="none" />
        <circle cx="32" cy="14" r="2"   fill="currentColor" stroke="none" />
      </svg>
    );
  }
  // spiral (default) — a bigger double-coil canopy with trailing
  // sparkles, instead of the original single thin swirl.
  return (
    <svg {...common} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
      <path d="M32 60 L32 38" />
      <path d="M32 38 C 16 38 8 24 16 14 C 22 6 34 8 32 18 C 30 25 22 24 24 18" />
      <circle cx="32" cy="6"  r="2.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="20" r="1.6" fill="currentColor" stroke="none" opacity="0.7" />
      <circle cx="40" cy="12" r="1.6" fill="currentColor" stroke="none" opacity="0.7" />
    </svg>
  );
}
