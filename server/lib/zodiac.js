// lib/zodiac.js
//
// Powers the Constellation system (server/routes/trees.js): instead of
// designing free-form "Mystic Tree" relics, a user now unlocks the 7
// stars of their OWN real zodiac sign — derived once from their
// birthday, fixed for their whole account. Every sign gets exactly the
// same number of stars (7) so nobody's constellation is a shorter grind
// than anyone else's purely by birth luck; what differs per sign is the
// stylized layout (STAR_LAYOUT below), which loosely nods to that sign's
// traditional shape rather than being an astronomically precise chart.

const SIGNS = [
  // Ordered by calendar start date; ranges below are what actually
  // resolve a birthday, this array is just for reference/iteration.
  { key: 'capricorn',   glyph: '♑', emoji: '🐐', nameEn: 'Capricorn',  nameAr: 'الجدي'   },
  { key: 'aquarius',    glyph: '♒', emoji: '🏺', nameEn: 'Aquarius',   nameAr: 'الدلو'   },
  { key: 'pisces',      glyph: '♓', emoji: '🐟', nameEn: 'Pisces',     nameAr: 'الحوت'   },
  { key: 'aries',       glyph: '♈', emoji: '🐏', nameEn: 'Aries',      nameAr: 'الحمل'   },
  { key: 'taurus',      glyph: '♉', emoji: '🐂', nameEn: 'Taurus',     nameAr: 'الثور'   },
  { key: 'gemini',      glyph: '♊', emoji: '👯', nameEn: 'Gemini',     nameAr: 'الجوزاء' },
  { key: 'cancer',      glyph: '♋', emoji: '🦀', nameEn: 'Cancer',     nameAr: 'السرطان' },
  { key: 'leo',         glyph: '♌', emoji: '🦁', nameEn: 'Leo',        nameAr: 'الأسد'   },
  { key: 'virgo',       glyph: '♍', emoji: '🌾', nameEn: 'Virgo',      nameAr: 'العذراء' },
  { key: 'libra',       glyph: '♎', emoji: '⚖️', nameEn: 'Libra',      nameAr: 'الميزان' },
  { key: 'scorpio',     glyph: '♏', emoji: '🦂', nameEn: 'Scorpio',    nameAr: 'العقرب'  },
  { key: 'sagittarius', glyph: '♐', emoji: '🏹', nameEn: 'Sagittarius', nameAr: 'القوس'  },
];
const SIGN_BY_KEY = Object.fromEntries(SIGNS.map((s) => [s.key, s]));

// [startMonth, startDay, endMonth, endDay] — capricorn wraps the new
// year (Dec 22 → Jan 19), handled as a special case below.
const RANGES = {
  capricorn:   [[12, 22], [1, 19]],
  aquarius:    [[1, 20], [2, 18]],
  pisces:      [[2, 19], [3, 20]],
  aries:       [[3, 21], [4, 19]],
  taurus:      [[4, 20], [5, 20]],
  gemini:      [[5, 21], [6, 20]],
  cancer:      [[6, 21], [7, 22]],
  leo:         [[7, 23], [8, 22]],
  virgo:       [[8, 23], [9, 22]],
  libra:       [[9, 23], [10, 22]],
  scorpio:     [[10, 23], [11, 21]],
  sagittarius: [[11, 22], [12, 21]],
};

// Stylized 7-point layouts, percentage coordinates (0-100) within the
// sky panel, ordered to trace a rough silhouette of the sign as stars
// unlock in sequence. Deliberately simplified/artistic, not a real star
// chart — the sign's name + glyph header is what actually identifies it.
const STAR_LAYOUT = {
  aries:       [[18,72],[28,58],[38,48],[50,44],[60,50],[64,62],[56,68]],   // ram horn curl
  taurus:      [[18,24],[32,42],[48,58],[64,42],[78,24],[48,74],[58,66]],   // V horns + muzzle
  gemini:      [[30,20],[28,42],[26,66],[48,44],[70,66],[68,42],[66,20]],   // twin columns + bridge
  cancer:      [[50,22],[50,42],[30,52],[20,66],[70,52],[80,66],[50,60]],   // Y claws
  leo:         [[24,60],[30,44],[42,32],[56,30],[66,38],[70,52],[52,70]],   // sickle + body
  virgo:       [[16,50],[32,36],[48,44],[62,32],[78,44],[60,62],[42,68]],   // wide kite
  libra:       [[50,20],[30,42],[70,42],[50,60],[30,76],[70,76],[50,44]],   // balanced scales
  scorpio:     [[16,30],[24,44],[34,54],[46,60],[58,62],[68,56],[74,68]],   // long hooked tail
  sagittarius: [[22,64],[38,68],[50,58],[38,44],[26,44],[54,74],[70,30]],   // teapot + arrow
  capricorn:   [[18,36],[34,52],[50,60],[66,52],[82,40],[62,68],[44,72]],   // sea-goat boat
  aquarius:    [[16,26],[28,40],[20,54],[32,68],[24,82],[48,44],[64,58]],   // zigzag stream
  pisces:      [[14,26],[28,42],[42,54],[56,60],[70,52],[82,38],[50,34]],   // two fish, tied line
};

function pad2(n) { return String(n).padStart(2, '0'); }

// birthday: "YYYY-MM-DD" (or anything Date-parseable with that shape).
// Returns a sign object ({ key, glyph, emoji, nameEn, nameAr, stars })
// or null if no valid birthday is set yet.
function getZodiacSign(birthday) {
  if (!birthday || typeof birthday !== 'string') return null;
  const m = birthday.match(/^\d{4}-(\d{2})-(\d{2})/);
  if (!m) return null;
  const month = Number(m[1]);
  const day   = Number(m[2]);
  if (!month || !day) return null;

  for (const [key, [[sm, sd], [em, ed]]] of Object.entries(RANGES)) {
    const inRange = sm > em
      // wraps new year (capricorn): after start OR before/on end
      ? ((month === sm && day >= sd) || (month > sm) || (month < em) || (month === em && day <= ed))
      : ((month === sm && day >= sd) || (month > sm && month < em) || (month === em && day <= ed));
    if (inRange) {
      const sign = SIGN_BY_KEY[key];
      return { ...sign, stars: STAR_LAYOUT[key] };
    }
  }
  return null;
}

function getSignMeta(key) {
  const sign = SIGN_BY_KEY[key];
  if (!sign) return null;
  return { ...sign, stars: STAR_LAYOUT[key] };
}

module.exports = { SIGNS, getZodiacSign, getSignMeta };
