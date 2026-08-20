import React from 'react';

// Renders a single star in a user's Constellation — one of the 7 stars
// of their own real zodiac sign (see server/lib/zodiac.js). `shapeKey`
// here is actually the zodiac key ('leo', 'aries', ...) — kept the prop
// name since every call site already passes `mystic.shape_key`, and the
// server now writes the zodiac key into that same column, so nothing
// upstream needed to change, only what gets drawn with it. All 7 stars
// in one person's constellation share the same zodiac emoji — what
// makes each star its own is the name/color/glow they picked, not the
// glyph.
//
// Every star is a real emoji (learned the hard way, twice, that
// hand-drawn SVG and CSS hue-rotate tricks both read as cheap next to
// real emoji quality) sitting inside two layered glows instead of one
// flat shadow: a tight inner "core" glow from `colorHex` and a wider
// soft "halo" from `glowHex` — like a real star's white-hot center vs.
// its colored corona. That's also the fix for emoji not being
// recolorable via CSS: instead of fighting to tint the glyph itself,
// both color choices go into light around it, which genuinely works.
const ZODIAC_EMOJI = {
  aries: '🐏', taurus: '🐂', gemini: '👯', cancer: '🦀',
  leo: '🦁', virgo: '🌾', libra: '⚖️', scorpio: '🦂',
  sagittarius: '🏹', capricorn: '🐐', aquarius: '🏺', pisces: '🐟',
};

export default function MysticSvg({ shapeKey, size = 56, colorHex, glowHex }) {
  const emoji = ZODIAC_EMOJI[shapeKey] || '✦';
  const core  = colorHex || '#8B5CF6';
  const halo  = glowHex  || core;
  return (
    <span
      style={{
        position: 'relative', display: 'inline-flex',
        width: size, height: size, alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* outer halo — soft, wide, breathing */}
      <span
        aria-hidden="true"
        className="animate-pulse"
        style={{
          position: 'absolute', inset: -size * 0.34, borderRadius: '9999px',
          background: `radial-gradient(circle, ${halo}45 0%, transparent 70%)`,
          filter: `blur(${Math.max(4, size * 0.2)}px)`,
        }}
      />
      {/* inner core — tighter, brighter */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute', inset: -size * 0.12, borderRadius: '9999px',
          background: `radial-gradient(circle, ${core}66 0%, transparent 75%)`,
          filter: `blur(${Math.max(2, size * 0.08)}px)`,
        }}
      />
      {/* four-point star flare behind the relic — sells "this is a star",
          not just a glowing icon */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute', fontSize: size * 0.9, lineHeight: 1, color: 'white', opacity: 0.35,
        }}
      >
        ✦
      </span>
      <span
        role="img" aria-label={shapeKey}
        style={{
          position: 'relative', fontSize: size * 0.58, lineHeight: 1,
          filter: `drop-shadow(0 0 5px ${core}CC)`,
        }}
      >
        {emoji}
      </span>
    </span>
  );
}
