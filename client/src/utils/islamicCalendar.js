// utils/islamicCalendar.js
// Converts today's Gregorian date to the Hijri (Islamic lunar) calendar
// via the browser's own Intl/ICU implementation — no hardcoded date
// table to maintain, so Ramadan/Eid detection stays correct every year
// automatically as the lunar calendar drifts ~10-11 days earlier each
// Gregorian year. Uses the Umm al-Qura calendar, the same civil
// calendar Saudi Arabia uses for its official Ramadan/Eid dates.
import { isTodayBirthday } from './birthday.js';

export function getHijriDate(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
      day: 'numeric', month: 'numeric', year: 'numeric',
    }).formatToParts(date);
    const day   = Number(parts.find((p) => p.type === 'day')?.value);
    const month = Number(parts.find((p) => p.type === 'month')?.value);
    const year  = Number(parts.find((p) => p.type === 'year')?.value);
    if (!day || !month || !year) return null;
    return { day, month, year };
  } catch (_) {
    return null; // Intl Islamic calendar unsupported — just skip the decoration
  }
}

// 'birthday' takes priority if it happens to land during Ramadan/Eid —
// still gets its own popup + song, so it should still visually "win".
export function getFestiveOccasion(user) {
  if (isTodayBirthday(user?.birthday)) return 'birthday';
  const h = getHijriDate();
  if (!h) return null;
  if (h.month === 9) return 'ramadan';                          // 1-29/30 Ramadan
  if (h.month === 10 && h.day <= 3) return 'eid';                // Eid al-Fitr, 1-3 Shawwal
  if (h.month === 12 && h.day >= 10 && h.day <= 13) return 'eid'; // Eid al-Adha, 10-13 Dhul Hijjah
  return null;
}
