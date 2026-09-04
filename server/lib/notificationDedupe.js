// lib/notificationDedupe.js
function buildDedupeKey(type, link, day) {
    // Streak: once per day, regardless of link.
    // Mood: once per day, regardless of checkpoint. Real bug this fixes —
    // this used to key on `${type}:${day}:${link}`, and the mood
    // reminder's link encodes which checkpoint fired it (12/15/18/21) —
    // so a fresh, separate, unread "How are you feeling?" row got
    // inserted at EVERY checkpoint that passed with mood still unlogged,
    // instead of one reminder for the day. Four near-identical unread
    // notifications stacking up by 9pm read as spam, not four genuine
    // separate nudges. Matching the streak pattern (once per day, full
    // stop) keeps the same daily nudge without the pileup.
    // Everything else (overdue, deadline): once per entity, forever,
    // until resolved — link encodes the entity id.
    if (type === 'streak') return `${type}:${day}`;
    if (type === 'mood')   return `${type}:${day}`;
    return `${type}:${link}`;
  }
  module.exports = { buildDedupeKey };