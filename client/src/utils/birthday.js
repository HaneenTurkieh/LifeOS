// utils/birthday.js
// Shared birthday-date logic — previously duplicated (and drifting)
// across SettingsModal.jsx and BirthdayCelebration.jsx. Birthdays are
// stored as "YYYY-MM-DD" strings; only month/day matter for "is it
// their birthday today".

export function isTodayBirthday(birthday) {
  if (!birthday) return false;
  const today = new Date();
  const [, m, d] = birthday.split('-');
  return Number(m) === today.getMonth() + 1 && Number(d) === today.getDate();
}

export function getAge(birthday) {
  if (!birthday) return null;
  const year = Number(birthday.split('-')[0]);
  if (!Number.isFinite(year)) return null;
  return new Date().getFullYear() - year;
}

// The server may run in a different timezone than the person using the
// app (Render's servers default to UTC; someone in Palestine is UTC+3).
// Right around midnight that can make the server briefly disagree with
// the browser about what day it is, which would make a birthday-gated
// feature go quiet for the first few hours of the actual day even
// though the browser already knows it's their birthday. Sending this
// alongside birthday-sensitive requests lets the server trust the
// browser's own local date instead of guessing from its own clock.
export function localDateStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
