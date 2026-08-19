import React from 'react';

// Shared with TreeShop.jsx (the designer) so every place that shows a
// Mystic Tree — the shop, the Focus timer, the Dashboard card, the
// productivity sphere, the "you just planted a tree" modal — renders
// the exact shape the person actually designed, instead of a generic
// placeholder emoji standing in for it.
//
// Redesigned from thin geometric line art (which read as cheap/flat) to
// chunky, filled, rounded silhouettes — the same visual language as
// buddy's own body: solid blobby shapes plus a soft white highlight for
// shine, closer to how an emoji tree actually reads (🌳/🌸/💎) than to
// a wireframe icon. Every shape still tapers into the same trunk at the
// base, just with a fuller, rounder canopy on top.
const TRUNK_FILL = 'M32 62 C 29.5 52 29.5 46 32 40 C 34.5 46 34.5 52 32 62 Z';

export default function MysticSvg({ shapeKey, size = 56 }) {
  const common = { width: size, height: size, viewBox: '0 0 64 64' };
  if (shapeKey === 'crystal') {
    // Crystal tree — rounded gem droplets (like a real gem emoji, not
    // sharp angular shards) clustered into a canopy.
    return (
      <svg {...common} fill="currentColor">
        <path d={TRUNK_FILL} opacity="0.55" />
        <path d="M32 4 C40 12 42 20 32 46 C22 20 24 12 32 4 Z" />
        <path d="M32 4 C34 16 34 32 32 46 C30 32 30 16 32 4 Z" fill="white" opacity="0.28" />
        <path d="M15 24 C20 28 21 34 15 44 C9 34 10 28 15 24 Z" opacity="0.85" />
        <path d="M49 24 C54 28 55 34 49 44 C43 34 44 28 49 24 Z" opacity="0.85" />
        <path d="M15 24 C17 30 17 36 15 44 C13 36 13 30 15 24 Z" fill="white" opacity="0.22" />
      </svg>
    );
  }
  if (shapeKey === 'orbs') {
    // Orb tree — a bubbly cluster of solid glowing orbs (grapes-style),
    // no thin branch lines holding them up anymore.
    return (
      <svg {...common} fill="currentColor">
        <path d={TRUNK_FILL} opacity="0.55" />
        <circle cx="32" cy="35" r="10" />
        <circle cx="18" cy="27" r="9"  opacity="0.92" />
        <circle cx="46" cy="27" r="9"  opacity="0.92" />
        <circle cx="24" cy="14" r="8"  opacity="0.85" />
        <circle cx="40" cy="14" r="8"  opacity="0.85" />
        <circle cx="32" cy="7"  r="5.5" opacity="0.8" />
        <circle cx="20" cy="23" r="2.2" fill="white" opacity="0.45" />
        <circle cx="36" cy="10" r="1.8" fill="white" opacity="0.4" />
      </svg>
    );
  }
  if (shapeKey === 'bloom') {
    // Blossom tree — a full round pom-pom of overlapping petal blobs,
    // plumper and rounder than thin flower-petal ellipses.
    return (
      <svg {...common} fill="currentColor">
        <path d={TRUNK_FILL} opacity="0.55" />
        <circle cx="32" cy="24" r="17" />
        <circle cx="19" cy="30" r="12" />
        <circle cx="45" cy="30" r="12" />
        <circle cx="23" cy="13" r="11" />
        <circle cx="41" cy="13" r="11" />
        <circle cx="32" cy="21" r="8" fill="white" opacity="0.30" />
        <circle cx="21" cy="19" r="3" fill="white" opacity="0.30" />
        <circle cx="14" cy="52" r="3" opacity="0.5" />
        <circle cx="50" cy="48" r="2.4" opacity="0.4" />
      </svg>
    );
  }
  if (shapeKey === 'bough') {
    // Ancient bough — a full rounded canopy silhouette (classic tree
    // shape) instead of bare branch lines, with a couple of soft
    // knot/texture marks for character.
    return (
      <svg {...common} fill="currentColor">
        <path d={TRUNK_FILL} opacity="0.55" />
        <path d="M32 46 C14 46 8 30 16 18 C22 8 30 10 32 20 C34 10 42 8 48 18 C56 30 50 46 32 46 Z" />
        <circle cx="22" cy="22" r="3.2" fill="white" opacity="0.22" />
        <circle cx="41" cy="26" r="2.6" fill="white" opacity="0.18" />
        <circle cx="32" cy="34" r="2.2" fill="white" opacity="0.16" />
      </svg>
    );
  }
  if (shapeKey === 'nova') {
    // Nova tree — a plump burst of light, same shape family as buddy's
    // own sparkle, with two smaller sparkles catching light nearby.
    return (
      <svg {...common} fill="currentColor">
        <path d={TRUNK_FILL} opacity="0.55" />
        <path d="M32 4 L37 19 L52 24 L37 29 L32 44 L27 29 L12 24 L27 19 Z" />
        <path d="M14 12 L15.6 16.2 L19.8 17.8 L15.6 19.4 L14 23.6 L12.4 19.4 L8.2 17.8 L12.4 16.2 Z" opacity="0.75" />
        <path d="M52 10 L53.2 13.2 L56.4 14.4 L53.2 15.6 L52 18.8 L50.8 15.6 L47.6 14.4 L50.8 13.2 Z" opacity="0.7" />
        <circle cx="32" cy="20" r="5" fill="white" opacity="0.28" />
      </svg>
    );
  }
  if (shapeKey === 'aurora') {
    // Aurora tree — thick, rounded ribbon curls (filled with a fat
    // rounded stroke, not a thin line) like curtains of northern light.
    return (
      <svg {...common} fill="currentColor">
        <path d={TRUNK_FILL} opacity="0.55" />
        <path d="M14 40 C20 22 28 34 32 16 C36 34 44 22 50 40"
          fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" opacity="0.92" />
        <path d="M20 44 C25 30 30 38 32 24"
          fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" opacity="0.5" />
        <circle cx="32" cy="12" r="2.6" />
      </svg>
    );
  }
  // spiral (default) — a fat, rounded coil (thick stroke, round caps)
  // instead of a thin wireframe swirl.
  return (
    <svg {...common} fill="currentColor">
      <path d={TRUNK_FILL} opacity="0.55" />
      <path d="M32 44 C16 44 8 30 16 18 C22 9 36 10 34 22 C33 28 25 27 26 21"
        fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" />
      <circle cx="32" cy="6" r="3" />
    </svg>
  );
}
