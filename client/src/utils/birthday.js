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
