import React from 'react';

// Shared with TreeShop.jsx (the designer) so every place that shows a
// Mystic Tree — the shop, the Focus timer, the Dashboard card, the
// productivity sphere, the "you just planted a tree" modal — renders
// the exact shape the person actually designed, instead of a generic
// placeholder emoji standing in for it.
//
// Third attempt at this component. Hand-drawn SVG (both a thin-line
// version and a chunky filled version) read as cheap next to the real
// emoji the rest of the app already uses. Plain real emoji fixed that
// but made "Colour" a no-op — `color`/currentColor can't touch a
// pre-rendered emoji glyph — so it just sat there under a flat
// drop-shadow with nothing distinguishing one Mystic Tree from another
// besides the shadow color.
//
// This version keeps real tree emoji (still the actual good-looking
// asset) but genuinely recolors them: CSS filters operate on rendered
// pixels, not fill, so `hue-rotate` DOES work on an emoji glyph even
// though `color` never could. It's an approximation, not a precise
// single-hue repaint — a multi-tone glyph (green leaves, brown trunk)
// shifts as a whole — but it reliably reads as "this tree is now
// [color]" instead of doing nothing. Paired with a soft animated aura
// behind it (matching buddy's own glow) instead of a static shadow, so
// it feels alive rather than pasted on.
const SHAPE_EMOJI = {
  spiral:  '🎋', // bamboo — curling fronds
  crystal: '🌲', // evergreen — sharp, faceted silhouette
  orbs:    '🌳', // full round canopy
  bloom:   '🌸', // blossom
  bough:   '🌴', // palm — drooping boughs
  nova:    '🌵', // cactus — radiating spikes, closest real-emoji "burst"
  aurora:  '🌿', // herb — flowing fronds
};

// Hand-picked hue-rotate degrees that shift a real tree emoji's default
// green/brown palette toward each Mystic color swatch (baseline leaf
// green sits around hue 120°). Not derived automatically — tuned by
// eye so each one actually reads as its target color.
const HUE_ROTATE = {
  '#8B5CF6': 138, // violet
  '#F472B6': 210, // pink
  '#F59E0B': 278, // amber
  '#10B981': 40,  // emerald
  '#38BDF8': 79,  // sky blue
  '#6366F1': 119, // indigo
  '#FB7185': 235, // rose
  '#EAB308': 285, // gold
};

export default function MysticSvg({ shapeKey, size = 56, colorHex, glowHex }) {
  const emoji = SHAPE_EMOJI[shapeKey] || SHAPE_EMOJI.spiral;
  const hue   = colorHex ? (HUE_ROTATE[colorHex] ?? 0) : 0;
  const glow  = glowHex || colorHex || '#8B5CF6';
  return (
    <span
      style={{
        position: 'relative', display: 'inline-flex',
        width: size, height: size, alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* soft breathing aura instead of a flat static shadow */}
      <span
        aria-hidden="true"
        className="animate-pulse"
        style={{
          position: 'absolute', inset: -size * 0.22, borderRadius: '9999px',
          background: `radial-gradient(circle, ${glow}50 0%, ${glow}20 45%, transparent 72%)`,
          filter: `blur(${Math.max(4, size * 0.16)}px)`,
        }}
      />
      <span
        role="img" aria-label={shapeKey}
        style={{
          position: 'relative', fontSize: size * 0.82, lineHeight: 1,
          filter: `hue-rotate(${hue}deg) saturate(1.35) brightness(1.05) drop-shadow(0 0 6px ${glow}99)`,
        }}
      >
        {emoji}
      </span>
    </span>
  );
}
