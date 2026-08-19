import React from 'react';

// Shared with TreeShop.jsx (the designer) so every place that shows a
// Mystic Tree — the shop, the Focus timer, the Dashboard card, the
// productivity sphere, the "you just planted a tree" modal — renders
// the exact shape the person actually designed, instead of a generic
// placeholder emoji standing in for it.
//
// Gave up on hand-drawn SVG entirely — two attempts at custom line art
// and then chunky filled shapes both read as cheap next to the real
// emoji the rest of the app already uses for its plain preset trees.
// Real emoji glyphs are polished, professionally illustrated assets;
// nothing hand-rolled here was ever going to beat that. So "shape" now
// just picks which real emoji renders as the canopy.
//
// The one real tradeoff: emoji glyphs are pre-colored and can't be
// recolored via CSS `color`/currentColor, so the person's chosen
// "Colour" no longer tints the tree itself — every caller already wraps
// this in a span styled with `color` + a `drop-shadow` glow, and the
// glow half of that still works great on an emoji (it's just a filter
// on the rendered pixels). The color picker isn't wasted either: both
// TreeShop's MysticTreeCard and the shop card border/background use
// `color_hex` to tint the *card the tree sits in*, so it still does
// something real — customizing the frame around a great-looking emoji,
// rather than trying to repaint the emoji itself.
const SHAPE_EMOJI = {
  spiral:  '🌀',
  crystal: '🔮',
  orbs:    '🫧',
  bloom:   '🪷',
  bough:   '🍄',
  nova:    '🌟',
  aurora:  '🌌',
};

export default function MysticSvg({ shapeKey, size = 56 }) {
  const emoji = SHAPE_EMOJI[shapeKey] || SHAPE_EMOJI.spiral;
  return (
    <span
      role="img"
      aria-label={shapeKey}
      style={{ fontSize: size, lineHeight: 1, display: 'inline-block' }}
    >
      {emoji}
    </span>
  );
}
