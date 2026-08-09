// lib/birthday.js
// Server-side mirror of client/src/utils/birthday.js's isTodayBirthday
// — birthdays are stored as "YYYY-MM-DD"; only month/day matter for
// "is it their birthday today".
function isTodayBirthday(birthday) {
  if (!birthday) return false;
  const today = new Date();
  const [, m, d] = birthday.split('-');
  return Number(m) === today.getMonth() + 1 && Number(d) === today.getDate();
}

module.exports = { isTodayBirthday };
