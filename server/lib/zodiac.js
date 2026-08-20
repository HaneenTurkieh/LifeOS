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
// Each layout traces that sign's real, named-star asterism — the same
// pattern shown in star charts — trimmed or lightly padded to exactly
// 7 points so every sign costs the same to complete. Order matters:
// it's also the order stars unlock in, and doubles as the path the
// connecting lines draw, so points are sequenced to trace the actual
// shape rather than just being scattered.
const STAR_LAYOUT = {
  // Body line (Botein → belly → shoulder) curving up into the real
  // 3-star head-curve: Mesarthim → Sheratan → Hamal (brightest, tip).
  aries:       [[20,74],[30,68],[42,60],[54,52],[62,42],[58,30],[46,26]],
  // Pleiades cluster marker, sweeping through both Hyades horn-tips
  // and Aldebaran (the bull's eye) at the V's vertex, down to the neck.
  taurus:      [[78,18],[28,30],[40,46],[50,58],[62,46],[74,32],[50,76]],
  // Castor's column down to its foot, a linking star, up the other
  // side through Pollux's foot to Pollux's head — the twins' "ladder".
  gemini:      [[34,18],[30,40],[26,64],[46,50],[66,64],[70,40],[66,18]],
  // The faint inverted-Y: tail → Beehive-cluster junction → both claws.
  cancer:      [[50,80],[50,60],[50,46],[38,36],[28,22],[62,36],[72,22]],
  // The actual Sickle — Regulus at the hook's base, curving up and left
  // through Eta/Algieba/Adhafera, curling back right at the tip (the
  // real "backward question mark") — then a line out to Zosma and
  // Denebola for the back/tail, same as how star charts draw Leo.
  leo:         [[30,66],[24,54],[22,40],[28,28],[40,22],[58,30],[76,42]],
  // Spica at the base, up through both arms of the big Y/kite to the
  // head — Virgo's real shape is exactly this loose, wide Y.
  virgo:       [[50,78],[44,60],[36,44],[24,30],[58,44],[70,28],[50,20]],
  // Zubenelgenubi → beam (toward Sigma Librae) → Zubeneschamali, then
  // both "chains" down to Brachium and back to a center fulcrum.
  libra:       [[28,52],[46,36],[70,44],[64,60],[56,74],[38,66],[44,50]],
  // The long real hook: claws → Antares (the heart) → curving body →
  // tail bend → Shaula, the stinger, curling back up at the very tip.
  scorpio:     [[18,30],[28,38],[38,48],[48,58],[58,64],[68,60],[76,50]],
  // The actual "Teapot": spout tip (Alnasl) → body → base → around and
  // up the handle → lid — same order the asterism is usually traced.
  sagittarius: [[24,58],[36,50],[30,68],[52,72],[66,58],[62,38],[44,32]],
  // The wide, shallow arrowhead/boat: horn-pair (Algedi + Dabih) along
  // the bottom edge to Deneb Algedi (the tail tip), back along the top.
  capricorn:   [[16,42],[20,48],[40,58],[60,64],[82,50],[66,34],[44,32]],
  // Both shoulder stars into the real 4-star Water Jar (its Y-junction),
  // then the "stream" pouring down and away from it.
  aquarius:    [[30,20],[48,30],[40,42],[28,38],[52,40],[44,58],[56,76]],
  // The real V: one fish (the Circlet) down the cord to Alrescha (the
  // knot, the V's vertex), back up the other cord to the second fish.
  pisces:      [[18,26],[30,42],[44,58],[54,70],[64,58],[76,42],[86,26]],
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
