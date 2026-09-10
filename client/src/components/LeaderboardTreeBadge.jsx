import React from 'react';
import TreeSvg from './TreeSvg.jsx';
import MysticSvg from './MysticTreeIcon.jsx';

// Matches PREMIUM_TREES in server/routes/trees.js / PREMIUM_COLORS in
// TreeShop.jsx — same 6 keys+colors, duplicated here rather than shared
// (same call SettingsModal's PREMIUM_TREE_OPTIONS already makes) since a
// leaderboard row has no reason to round-trip the whole shop catalogue
// just to know whether a key is a paid one.
const PREMIUM_COLORS = {
  aurora:  '#38BDF8',
  phoenix: '#FB923C',
  galaxy:  '#A855F7',
  nebula:  '#EC4899',
  eclipse: '#FBBF24',
  comet:   '#7DD3FC',
};

// Whichever tree a leaderboard row's person currently has equipped.
// Wiring this into /rankings and each channel's own leaderboards (see
// server/lib/equippedTreeDisplay.js) is what gives the $2.99/$6.99 Tree
// Shop trees an actual audience — a premium tree gets a glowing colored
// ring here so it visibly stands out from the free/earnable ones next
// to it. Without that ring, a premium tree just looks like any other
// tree and the purchase buys nothing anyone would notice.
export default function LeaderboardTreeBadge({ treeKey, mysticDesign, size = 22 }) {
  const isMystic = typeof treeKey === 'string' && treeKey.startsWith('mystic:');
  const premiumColor = PREMIUM_COLORS[treeKey];
  const box = size + 8;

  if (isMystic && mysticDesign) {
    const c = mysticDesign.color_hex || '#8B5CF6';
    return (
      <div className="shrink-0 flex items-center justify-center rounded-full"
        style={{ width: box, height: box, background: `${c}22`, boxShadow: `0 0 0 1.5px ${c}66` }}
        title="Mystic Tree">
        <MysticSvg shapeKey={mysticDesign.shape_key} size={size} colorHex={mysticDesign.color_hex} glowHex={mysticDesign.glow_hex} />
      </div>
    );
  }
  if (premiumColor) {
    return (
      <div className="shrink-0 flex items-center justify-center rounded-full"
        style={{ width: box, height: box, background: `${premiumColor}22`, boxShadow: `0 0 0 1.5px ${premiumColor}99` }}
        title="Premium tree">
        <TreeSvg speciesKey={treeKey} size={size} />
      </div>
    );
  }
  return (
    <div className="shrink-0 flex items-center justify-center opacity-60" style={{ width: box, height: box }}>
      <TreeSvg speciesKey={treeKey} size={size} />
    </div>
  );
}
