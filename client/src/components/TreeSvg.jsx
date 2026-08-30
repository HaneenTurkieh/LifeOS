import React from 'react';

// TreeSvg — replaces the flat emoji "stamp" (🌳, 🌵, 🎋…) previously used
// everywhere a planted/equipped tree was shown (My Land, the timer's
// center icon, the congrats popup, the Tree Shop cards) with a real,
// hand-built illustration per species: visible roots, a trunk, and a
// canopy shaped like the actual thing — a cactus looks like a cactus, a
// pine looks like a conifer, bamboo is thin jointed stalks, not a round
// green blob recolored. Haneen's ask, verbatim: "i dont want the tree to
// be stamped but real tree planting with root and leaves."
//
// Every species shares the same 44×56 viewBox and ground line (y=51) so
// they drop into LandPlot/TreeIcon interchangeably at any size — the
// canopy is what varies, not the coordinate system. Dead-tree styling is
// deliberately NOT handled in here: callers (LandPlot) already wrap dead
// trees in a CSS grayscale/brightness filter, which works on any of
// these the same way it used to work on the emoji glyph, so there's no
// need for a second "wilted" palette per species.

const GROUND_Y = 51;

// ── Shared pieces ─────────────────────────────────────────────────
function Roots({ color = '#6B4226', cx = 22 }) {
  return (
    <g stroke={color} strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.5">
      <path d={`M${cx} ${GROUND_Y} Q${cx - 6} ${GROUND_Y + 3} ${cx - 11} ${GROUND_Y + 1.5}`} />
      <path d={`M${cx} ${GROUND_Y} Q${cx + 6} ${GROUND_Y + 3} ${cx + 11} ${GROUND_Y + 1.5}`} />
      <path d={`M${cx} ${GROUND_Y} L${cx} ${GROUND_Y + 4}`} />
    </g>
  );
}
function Trunk({ color = '#8B5A2B', cx = 22, topY = 28, width = 4.5, lean = 0 }) {
  const topX = cx + lean;
  return (
    <path
      d={`M${cx - width / 2} ${GROUND_Y} Q${cx - width / 2 + lean * 0.5} ${(topY + GROUND_Y) / 2} ${topX - width / 3} ${topY}
          L${topX + width / 3} ${topY} Q${cx + width / 2 + lean * 0.5} ${(topY + GROUND_Y) / 2} ${cx + width / 2} ${GROUND_Y} Z`}
      fill={color}
    />
  );
}
function Blobs({ points, color, opacity = 1, outline = true }) {
  // A cluster of overlapping circles — the base building block for any
  // "leafy round canopy" species (oak, cherry blossom, flamingo…), just
  // with a different color/count/spread per caller. A thin darkened-
  // outline stroke (derived from the fill, not a fixed color) is what
  // actually keeps a lighter canopy — sprout, cherry blossom's pale pink
  // — from washing out against LandPlot's own green grass gradient;
  // opacity-layered "shading" blobs (opacity < 1, used for depth accents)
  // skip it since they're meant to blend, not define an edge.
  return (
    <g opacity={opacity}>
      {points.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={color}
          stroke={outline && opacity === 1 ? 'rgba(0,0,0,0.22)' : 'none'}
          strokeWidth={outline && opacity === 1 ? 0.7 : 0} />
      ))}
    </g>
  );
}

// ── Species canopies (trunk + roots handled by the caller unless noted) ──
function Seedling() {
  return (
    <g>
      <Roots cx={22} color="#4C7A3A" />
      <path d="M22 51 L22 38" stroke="#4CA05A" strokeWidth="2" strokeLinecap="round" />
      <path d="M22 41 Q15 38 14 32 Q21 33 22 41 Z" fill="#5FBE6E" stroke="rgba(0,0,0,0.22)" strokeWidth="0.6" />
      <path d="M22 39 Q29 36 30 30 Q23 31 22 39 Z" fill="#4CA05A" stroke="rgba(0,0,0,0.22)" strokeWidth="0.6" />
    </g>
  );
}
function Sprout() {
  return (
    <g>
      <Roots cx={22} color="#4C7A3A" />
      <path d="M22 51 L22 40" stroke="#5B8A3A" strokeWidth="3" strokeLinecap="round" />
      <Blobs color="#5FBE6E" points={[[16, 38, 5.5], [28, 37, 5.5], [22, 33, 6.5]]} />
    </g>
  );
}
function Oak() {
  return (
    <g>
      <Roots />
      <Trunk topY={26} width={5.5} />
      <Blobs color="#3F8F52" points={[[13, 22, 9.5], [31, 22, 9.5], [22, 14, 12], [22, 26, 10]]} />
      <Blobs color="#4CA05A" opacity={0.55} points={[[17, 15, 6], [28, 17, 5]]} />
    </g>
  );
}
function CherryBlossom() {
  return (
    <g>
      <Roots />
      <Trunk topY={27} width={4} color="#7A5240" />
      <Blobs color="#F9A8D4" points={[[13, 23, 8], [31, 23, 8], [22, 15, 10.5], [22, 27, 8.5]]} />
      <Blobs color="#F472B6" opacity={0.6} points={[[17, 16, 4], [28, 18, 4], [22, 26, 3.5]]} />
      <g fill="#FBCFE8">
        <circle cx={8} cy={35} r={1.3} /><circle cx={36} cy={30} r={1.1} /><circle cx={11} cy={44} r={1} />
      </g>
    </g>
  );
}
function Coral() {
  // Branching, not leafy — a tree-shaped stand-in for coral: forking
  // limbs with rounded tips, no canopy at all.
  const branch = (d) => <path key={d} d={d} stroke="#FB7185" strokeWidth="3" strokeLinecap="round" fill="none" />;
  return (
    <g>
      <Roots color="#B45369" />
      {branch('M22 51 L22 34')}
      {branch('M22 42 Q15 38 12 28')}
      {branch('M22 42 Q29 38 32 28')}
      {branch('M22 34 Q17 28 15 20')}
      {branch('M22 34 Q27 28 29 20')}
      <g fill="#FDA4AF">
        <circle cx={12} cy={27} r={2.2} /><circle cx={32} cy={27} r={2.2} />
        <circle cx={15} cy={19} r={1.8} /><circle cx={29} cy={19} r={1.8} /><circle cx={22} cy={33} r={2} />
      </g>
    </g>
  );
}
function Bamboo() {
  const stalk = (x, h, color) => (
    <g key={x}>
      <rect x={x - 1.6} y={GROUND_Y - h} width={3.2} height={h} rx={1.4} fill={color} />
      {[0.28, 0.55, 0.82].map((f) => (
        <line key={f} x1={x - 1.6} y1={GROUND_Y - h * f} x2={x + 1.6} y2={GROUND_Y - h * f} stroke="#2F6B3B" strokeWidth="0.8" />
      ))}
    </g>
  );
  return (
    <g>
      <Roots color="#2F6B3B" />
      {stalk(15, 26, '#6FCB7A')}
      {stalk(22, 34, '#4FAF63')}
      {stalk(29, 22, '#6FCB7A')}
      <path d="M22 17 Q15 12 12 8" stroke="#5FBE6E" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M22 21 Q30 15 33 11" stroke="#5FBE6E" strokeWidth="2" strokeLinecap="round" fill="none" />
    </g>
  );
}
function Cactus() {
  return (
    <g>
      <Roots color="#3E7A4E" />
      <rect x={17} y={20} width={10} height={31} rx={5} fill="#4CA05A" />
      <rect x={9} y={28} width={7} height={16} rx={3.5} fill="#5FBE6E" />
      <rect x={28} y={24} width={7} height={20} rx={3.5} fill="#5FBE6E" />
      <g stroke="#2F6B3B" strokeWidth="0.9" opacity="0.6">
        <line x1={19.5} y1={22} x2={19.5} y2={49} /><line x1={22} y1={20} x2={22} y2={51} /><line x1={24.5} y1={22} x2={24.5} y2={49} />
      </g>
      <circle cx={22} cy={17} r={3.4} fill="#F472B6" />
    </g>
  );
}
function Palm() {
  return (
    <g>
      <Roots color="#7A5240" />
      <Trunk topY={20} width={3.5} lean={4} color="#9C6B3E" />
      {[-70, -35, -10, 10, 35, 70].map((deg) => (
        <path key={deg} d="M26 19 Q26 10 26 4"
          stroke="#3F8F52" strokeWidth="3" strokeLinecap="round" fill="none"
          transform={`rotate(${deg} 26 19)`} />
      ))}
      <circle cx={24} cy={22} r={1.6} fill="#7A5240" /><circle cx={28} cy={23} r={1.6} fill="#7A5240" />
    </g>
  );
}
function WaterTree() {
  return (
    <g>
      <ellipse cx={22} cy={GROUND_Y + 1} rx={13} ry={2.4} fill="#93C5FD" opacity="0.4" />
      <Trunk topY={30} width={4} color="#93C5FD" />
      <path d="M22 10 C30 16 30 28 22 32 C14 28 14 16 22 10 Z" fill="#60A5FA" />
      <path d="M22 14 C26 18 26 25 22 28" stroke="#BFDBFE" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </g>
  );
}
function Maple() {
  const leaf = (x, y, s, rot, color) => (
    <path key={`${x}-${y}`} d="M0 -6 L1.6 -1.8 L6 -1.4 L2.6 1.6 L3.6 6 L0 3.4 L-3.6 6 L-2.6 1.6 L-6 -1.4 L-1.6 -1.8 Z"
      fill={color} transform={`translate(${x} ${y}) scale(${s}) rotate(${rot})`} />
  );
  return (
    <g>
      <Roots />
      <Trunk topY={27} width={4.5} />
      {leaf(14, 22, 1.15, -10, '#EA580C')}
      {leaf(30, 22, 1.15, 12, '#DC2626')}
      {leaf(22, 14, 1.35, 0, '#F97316')}
      {leaf(22, 26, 1.1, 25, '#FBBF24')}
      {leaf(9, 30, 0.9, -20, '#DC2626')}
    </g>
  );
}
function Pine() {
  // Flat single-tone dark green used to disappear into LandPlot's own
  // grass gradient — each tier now gets a distinct, brighter shade
  // (darkest at the base, brightest at the tip) so the silhouette reads
  // as a layered conifer instead of blending into the lawn behind it.
  return (
    <g>
      <Roots />
      <rect x={19.5} y={44} width={5} height={7} fill="#7A5240" />
      <polygon points="9,44 35,44 22,32" fill="#0E7A3C" stroke="#0A5C2C" strokeWidth="0.6" />
      <polygon points="11,34 33,34 22,22" fill="#189B4A" stroke="#0A5C2C" strokeWidth="0.6" />
      <polygon points="13,24 31,24 22,12" fill="#22B85A" stroke="#0A5C2C" strokeWidth="0.6" />
    </g>
  );
}
function Flamingo() {
  return (
    <g>
      <Roots />
      <Trunk topY={29} width={3.5} color="#C08497" />
      <Blobs color="#F472B6" points={[[15, 24, 7], [29, 24, 7], [22, 16, 9]]} />
      {/* a tiny flamingo silhouette tucked beside the canopy */}
      <g transform="translate(31 30)" fill="#EC4899">
        <ellipse cx={0} cy={2} rx={3.2} ry={4} />
        <path d="M0 -1 Q3 -6 6 -8" stroke="#EC4899" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <circle cx={6.4} cy={-8.2} r={1.6} />
        <line x1={-1} y1={6} x2={-3} y2={12} stroke="#EC4899" strokeWidth="1.3" strokeLinecap="round" />
      </g>
    </g>
  );
}
function MoneyTree() {
  return (
    <g>
      <Roots />
      <Trunk topY={28} width={4.5} />
      <Blobs color="#3F8F52" opacity={0.35} points={[[14, 23, 8], [30, 23, 8], [22, 15, 10]]} />
      {[[14, 23], [30, 22], [22, 14], [22, 26], [18, 17], [27, 16]].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={4.2} fill="#FBBF24" stroke="#B45309" strokeWidth="0.8" />
          <text x={x} y={y + 2} fontSize="4.5" textAnchor="middle" fill="#B45309" fontWeight="700">$</text>
        </g>
      ))}
    </g>
  );
}
function CrystalTree() {
  const gem = (x, y, s, rot) => (
    <polygon key={`${x}-${y}`} points="0,-7 5,0 0,7 -5,0"
      fill="#C084FC" stroke="#7E22CE" strokeWidth="0.6"
      transform={`translate(${x} ${y}) scale(${s}) rotate(${rot})`} opacity="0.92" />
  );
  return (
    <g>
      <ellipse cx={22} cy={30} rx={13} ry={13} fill="#A855F7" opacity="0.18" />
      <Trunk topY={30} width={3.5} color="#D8B4FE" />
      {gem(14, 24, 1, -12)}
      {gem(30, 24, 1, 15)}
      {gem(22, 14, 1.25, 0)}
      {gem(22, 27, 0.9, 30)}
      <g fill="#F5F3FF">
        <circle cx={9} cy={18} r={1} /><circle cx={35} cy={20} r={0.9} /><circle cx={22} cy={6} r={1} />
      </g>
    </g>
  );
}
function ChristmasTree() {
  return (
    <g>
      <Roots />
      <rect x={19.5} y={44} width={5} height={7} fill="#7A5240" />
      <polygon points="9,44 35,44 22,32" fill="#0E7A3C" stroke="#0A5C2C" strokeWidth="0.6" />
      <polygon points="11,34 33,34 22,22" fill="#189B4A" stroke="#0A5C2C" strokeWidth="0.6" />
      <polygon points="13,24 31,24 22,12" fill="#22B85A" stroke="#0A5C2C" strokeWidth="0.6" />
      <g>
        {[[16, 40], [28, 40], [22, 30], [18, 29], [26, 19], [22, 18]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={1.3} fill={['#EF4444', '#FBBF24', '#60A5FA'][i % 3]} />
        ))}
      </g>
      <path d="M22 12 L23.3 15 L26.5 15.3 L24 17.4 L24.8 20.5 L22 18.8 L19.2 20.5 L20 17.4 L17.5 15.3 L20.7 15 Z" fill="#FBBF24" />
    </g>
  );
}
// Premium/cosmic trees — abstract by nature (no real-world silhouette to
// reference), so these lean on the same round-canopy base as Oak but
// swap in a gradient + a texture accent per theme instead of a wholly
// different shape.
function cosmicCanopy(id, stops, accentDots, accentColor) {
  return (
    <g>
      <Roots color="#4B4B6B" />
      <Trunk topY={27} width={4} color="#4B4B6B" />
      <defs>
        <radialGradient id={id} cx="40%" cy="35%" r="65%">
          {stops.map(([off, color], i) => <stop key={i} offset={off} stopColor={color} />)}
        </radialGradient>
      </defs>
      <circle cx={22} cy={20} r={13} fill={`url(#${id})`} />
      {accentDots.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={accentColor} opacity="0.85" />)}
    </g>
  );
}
function Aurora() {
  return cosmicCanopy('grad-aurora',
    [['0%', '#A7F3D0'], ['45%', '#38BDF8'], ['100%', '#7C3AED']],
    [[16, 15, 0.9], [28, 24, 0.8], [22, 12, 0.7]], '#F0FDFA');
}
function Phoenix() {
  return cosmicCanopy('grad-phoenix',
    [['0%', '#FDE68A'], ['45%', '#FB923C'], ['100%', '#B91C1C']],
    [[15, 24, 1], [29, 15, 0.9], [22, 10, 0.8]], '#FEF3C7');
}
function Galaxy() {
  return cosmicCanopy('grad-galaxy',
    [['0%', '#C4B5FD'], ['50%', '#7C3AED'], ['100%', '#1E1B4B']],
    [[15, 16, 0.8], [29, 22, 0.7], [24, 27, 0.6], [18, 26, 0.6]], '#F5F3FF');
}
function Nebula() {
  return (
    <g>
      <Roots color="#8B5CF6" />
      <Trunk topY={28} width={4} color="#8B5CF6" />
      <Blobs color="#F0ABFC" opacity={0.55} points={[[14, 23, 8], [30, 23, 8], [22, 14, 10]]} />
      <Blobs color="#38BDF8" opacity={0.45} points={[[18, 18, 6], [27, 20, 6]]} />
      <Blobs color="#F472B6" opacity={0.4} points={[[22, 24, 6]]} />
    </g>
  );
}
function Eclipse() {
  return (
    <g>
      <Roots color="#111827" />
      <Trunk topY={27} width={4} color="#111827" />
      <circle cx={22} cy={20} r={13} fill="#1E1B4B" />
      <circle cx={22} cy={20} r={13} fill="none" stroke="#FBBF24" strokeWidth="1.4" opacity="0.9" />
      <circle cx={18} cy={16} r={9.5} fill="#0B0B18" />
    </g>
  );
}
function Comet() {
  return (
    <g>
      <Roots color="#0EA5E9" />
      <Trunk topY={28} width={4} color="#BAE6FD" />
      <path d="M8 34 L20 24" stroke="#7DD3FC" strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
      <circle cx={22} cy={20} r={11} fill="#E0F2FE" />
      <circle cx={22} cy={20} r={11} fill="none" stroke="#38BDF8" strokeWidth="1.2" />
    </g>
  );
}

const SPECIES = {
  seedling: Seedling, sprout: Sprout, oak: Oak, cherry_blossom: CherryBlossom,
  coral: Coral, bamboo: Bamboo, cactus: Cactus, palm: Palm, water: WaterTree,
  maple: Maple, pine: Pine, flamingo: Flamingo, money: MoneyTree, crystal: CrystalTree,
  christmas: ChristmasTree,
  aurora: Aurora, phoenix: Phoenix, galaxy: Galaxy, nebula: Nebula, eclipse: Eclipse, comet: Comet,
};

export default function TreeSvg({ speciesKey, size = 34, className = '' }) {
  const key = (speciesKey || '').startsWith('mystic') ? null : speciesKey;
  const Species = SPECIES[key] || Oak;
  return (
    <svg
      viewBox="0 0 44 56" width={size} height={size}
      className={className}
      style={{
        display: 'inline-block', overflow: 'visible',
        // A dark-green pine/christmas canopy against LandPlot's own
        // green grass gradient was nearly invisible (same problem the
        // old emoji glyphs dodged with a text-shadow) — this drop-shadow
        // is what actually separates every species from whatever
        // background it sits on, not just the dark-canopy ones.
        filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.5))',
      }}
    >
      <Species />
    </svg>
  );
}
