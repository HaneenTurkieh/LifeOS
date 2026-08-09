import React, { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext.jsx';
import { getFestiveOccasion } from '../utils/islamicCalendar.js';

// Ambient, persistent, site-wide — distinct from BirthdayCelebration's
// one-time popup burst. This is the "hung on the website" decoration:
// a personalized pennant banner (like a real party-supply bunting —
// one flag per letter, strung along the top edge) plus a slow, sparse
// rain of themed icons, present on every page for as long as the
// occasion lasts (all of Ramadan, the Eid days, or the birthday).
// Purely pointer-events-none so it never blocks clicks on the search/
// notification pill or anything else, and tuned to stay in the
// background — slow, low-opacity, sparse — rather than being something
// that fights for attention while someone's actually working.
const THEMES = {
  birthday: { icons: ['🎉', '🎈', '🎂', '✨', '🎁', '🌟'], flags: ['#FF2B99', '#7C6AF0', '#FFD23F', '#4CC38A'] },
  ramadan:  { icons: ['🌙', '⭐', '✨', '🌟'],              flags: ['#D4A537', '#3B2F7A', '#F2C94C', '#5B4A9E'] },
  eid:      { icons: ['🐑', '🐑', '✨', '🌙'],              flags: ['#10A569', '#F2C94C', '#0D8A57', '#E8C468'] },
};

function Flag({ text, color, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 0.95, y: [0, 2, 0], rotate: [-4, 4, -4] }}
      transition={{
        opacity: { delay, duration: 0.4 },
        y:       { duration: 2.6 + (delay % 1) * 0.6, repeat: Infinity, ease: 'easeInOut', delay },
        rotate:  { duration: 2.6 + (delay % 1) * 0.6, repeat: Infinity, ease: 'easeInOut', delay },
      }}
      className="flex items-center justify-center text-[10px] font-extrabold text-white select-none shrink-0"
      style={{
        minWidth: 20, height: 24, padding: '0 3px',
        background: color,
        clipPath: 'polygon(0 0, 100% 0, 100% 68%, 50% 100%, 0 68%)',
        marginTop: 4,
        boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
        transformOrigin: 'top center',
      }}
    >
      {text}
    </motion.div>
  );
}

// Latin script reads fine chopped into one-letter flags; Arabic letters
// change shape depending on their position in a word (isolated forms
// look wrong split apart), so Arabic renders one flag per whole word
// instead of per letter.
function Bunting({ colors, label, rtl }) {
  const words = label.trim().split(/\s+/);
  let flagIndex = 0;
  return (
    <div className="pointer-events-none fixed top-0 inset-x-0 z-40 flex justify-center" style={{ overflow: 'visible' }}>
      <div className="relative flex items-start" style={{ gap: 10, paddingTop: 4, direction: rtl ? 'rtl' : 'ltr' }}>
        <span className="pointer-events-none absolute inset-x-0" style={{ top: 6, height: 1, background: 'rgba(255,255,255,0.35)' }} />
        {words.map((word, wi) => {
          const units = rtl ? [word] : Array.from(word);
          return (
            <div key={wi} className="flex items-start" style={{ gap: 3 }}>
              {units.map((unit, ui) => {
                const i = flagIndex++;
                return (
                  <Flag key={ui} text={unit.toUpperCase()} color={colors[i % colors.length]} delay={i * 0.06} />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AmbientIcons({ icons }) {
  const COUNT = 13;
  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      {Array.from({ length: COUNT }).map((_, i) => (
        <motion.span
          key={i}
          initial={{ y: '-8vh', opacity: 0 }}
          animate={{ y: '108vh', opacity: [0, 0.42, 0.42, 0] }}
          transition={{
            duration: 17 + Math.random() * 11,
            delay:    Math.random() * 16,
            repeat:   Infinity,
            ease:     'linear',
          }}
          className="absolute select-none"
          style={{ left: `${(i / COUNT) * 100 + Math.random() * 6}%`, fontSize: 15 + (i % 3) * 4 }}
        >
          {icons[i % icons.length]}
        </motion.span>
      ))}
    </div>
  );
}

const LABELS = {
  birthday: { en: (name) => `HAPPY BIRTHDAY ${name}`, ar: (name) => `عيد ميلاد سعيد ${name}` },
  ramadan:  { en: () => 'RAMADAN MUBARAK',             ar: () => 'رمضان مبارك' },
  eid:      { en: () => 'EID MUBARAK',                 ar: () => 'عيد مبارك' },
};

export default function FestiveDecoration({ user }) {
  const { lang } = useLanguage();
  // Birthday is a per-user check; Ramadan/Eid come purely from today's
  // Hijri date, so they don't depend on `user` at all — recomputed
  // fresh on every mount (i.e. every refresh), no localStorage needed.
  const occasion = useMemo(() => getFestiveOccasion(user), [user?.birthday]);

  useEffect(() => {
    if (occasion) document.documentElement.setAttribute('data-festive', occasion);
    else document.documentElement.removeAttribute('data-festive');
    return () => document.documentElement.removeAttribute('data-festive');
  }, [occasion]);

  if (!occasion) return null;
  const theme = THEMES[occasion];
  const firstName = user?.name?.split(' ')[0] || '';
  const isAr = lang === 'ar';
  const label = LABELS[occasion][isAr ? 'ar' : 'en'](firstName);

  return (
    <>
      <Bunting colors={theme.flags} label={label} rtl={isAr} />
      <AmbientIcons icons={theme.icons} />
    </>
  );
}
