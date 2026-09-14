// A small curated palette of vivid duotone gradients, assigned
// deterministically per person (hashed from their user id) so the same
// person gets the same color everywhere they show up as an avatar —
// the room member list, room/global Rankings, and cheer bubbles. This
// is the same trick Slack/Discord/Notion use for identicon colors: a
// room full of people should read as a room full of different
// *people*, not one repeated accent color. Hashing the id (rather than,
// say, join order or row index) keeps it stable even as the member
// list re-sorts between polls.
const PALETTE = [
  ['#7C6AF0', '#B98CF0'], // violet
  ['#F5408F', '#FF7AB8'], // rose
  ['#FF7A2E', '#FFC15E'], // amber
  ['#2FA36B', '#6FE3A6'], // emerald
  ['#3B82F6', '#7DD3FC'], // sky
  ['#E85D50', '#FF9A8B'], // coral
  ['#8B5CF6', '#38BDF8'], // indigo-cyan
  ['#EC4899', '#C026D3'], // fuchsia
];

function hashSeed(seed) {
  const s = String(seed ?? '');
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return hash;
}

// CSS gradient string, ready to drop into a style={{ background: ... }}.
export function avatarGradient(seed) {
  const [from, to] = PALETTE[hashSeed(seed) % PALETTE.length];
  return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;
}

// Just the "from" hue, for places that want a single accent color
// (e.g. a glow/shadow tint) rather than the full two-tone gradient.
export function avatarColor(seed) {
  return PALETTE[hashSeed(seed) % PALETTE.length][0];
}
