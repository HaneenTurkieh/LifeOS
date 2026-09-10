// lib/equippedTreeDisplay.js — batch-resolves "what tree does this user
// currently have equipped" for a whole leaderboard at once, so a Tree
// Shop purchase actually has an audience: right now a premium tree only
// ever shows up on its owner's own private Shelf. Wiring this into the
// app-wide Flow rankings (routes/focus.js GET /leaderboard) and each
// channel's own Flow + points leaderboards (routes/channels.js) means a
// premium tree shows up next to someone's name every week, in front of
// their actual classmates — that's the whole reason anyone would pay
// $2.99-$6.99 for one instead of just growing the free ones.
const { db } = require('../db/connection');

function isMysticKey(treeKey) {
  return typeof treeKey === 'string' && treeKey.startsWith('mystic:');
}

// A Mystic Tree's real shape/color lives in whoever designed it's own
// user_mystic_tree row, not on the tree_key itself — same fact
// routes/focus.js's own (single-user) resolveMysticDesign exists to
// handle for the shared focus-room tree. Anywhere a tree_key is shown to
// someone other than its designer needs this resolved server-side, or
// they'd just see the generic fallback glyph instead of the real design.
async function resolveMysticDesign(treeKey) {
  if (!isMysticKey(treeKey)) return null;
  try {
    const id = Number(treeKey.slice('mystic:'.length));
    const design = (await db.execute({
      sql: `SELECT shape_key, color_hex, glow_hex FROM user_mystic_tree WHERE id = ?`,
      args: [id],
    })).rows[0];
    return design || null;
  } catch (_) { return null; }
}

// Attaches `equipped_tree_key` (+ `mystic_design` when it's a Mystic
// Tree) to every row of an already-built leaderboard array (each row
// just needs an `id` — the user id). One batched IN(...) query for the
// whole board rather than one query per row, since these boards run
// 20+ people deep.
async function attachEquippedTrees(rows) {
  if (!rows || rows.length === 0) return rows;
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(',');
  const equippedRows = (await db.execute({
    sql: `SELECT user_id, tree_key FROM user_equipped_tree WHERE user_id IN (${placeholders})`,
    args: ids,
  })).rows;
  const byUser = new Map(equippedRows.map((r) => [r.user_id, r.tree_key]));

  const out = [];
  for (const row of rows) {
    const treeKey = byUser.get(row.id) || 'seedling';
    const mysticDesign = await resolveMysticDesign(treeKey);
    out.push({ ...row, equipped_tree_key: treeKey, mystic_design: mysticDesign });
  }
  return out;
}

module.exports = { attachEquippedTrees, resolveMysticDesign, isMysticKey };
