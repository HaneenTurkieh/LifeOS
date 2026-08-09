// lib/birthday.js
// Server-side mirror of client/src/utils/birthday.js's isTodayBirthday
// — birthdays are stored as "YYYY-MM-DD"; only month/day matter for
// "is it their birthday today".
//
// clientDate (optional, "YYYY-MM-DD") lets a caller pass the browser's
// own local date instead of trusting this server's clock. The server
// (Render, effectively UTC) and someone in a timezone ahead of UTC
// (like Palestine, UTC+3) can briefly disagree about what day it is
// right around midnight — without this, a birthday-gated feature could
// stay quiet for the first few hours of the actual day even though the
// browser already knows it's their birthday.
function todayParts(clientDate) {
  if (clientDate && /^\d{4}-\d{2}-\d{2}$/.test(clientDate)) {
    const [, m, d] = clientDate.split('-');
    return { month: Number(m), day: Number(d) };
  }
  const now = new Date();
  return { month: now.getMonth() + 1, day: now.getDate() };
}

function isTodayBirthday(birthday, clientDate) {
  if (!birthday) return false;
  const [, bm, bd] = birthday.split('-');
  const { month, day } = todayParts(clientDate);
  return Number(bm) === month && Number(bd) === day;
}

module.exports = { isTodayBirthday };
