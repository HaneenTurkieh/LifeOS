// lib/notificationDedupe.js
function buildDedupeKey(type, link, day) {
  if (type === 'streak' || type === 'mood') return `${type}:${day}`;
  return `${type}:${link}`;
}
module.exports = { buildDedupeKey };
