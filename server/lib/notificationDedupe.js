// lib/notificationDedupe.js
function buildDedupeKey(type, link, day) {
    // Streak: once per day, regardless of link.
    // Mood: once per day PER CHECKPOINT (12/15/18/21) — link encodes
    // which checkpoint, so a fresh reminder can fire at each one if
    // mood still isn't logged, instead of only ever once per day.
    // Everything else (overdue, deadline): once per entity, forever,
    // until resolved — link encodes the entity id.
    if (type === 'streak') return `${type}:${day}`;
    if (type === 'mood')   return `${type}:${day}:${link}`;
    return `${type}:${link}`;
  }
  module.exports = { buildDedupeKey };