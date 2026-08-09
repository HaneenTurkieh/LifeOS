import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { api } from '../api/client.js';
import { isTodayBirthday, getAge } from '../utils/birthday.js';

// ── "Happy Birthday to You" melody, played on load via Web Audio ──
// Same oscillator-per-note pattern as playDone/playTreeDied in
// FocusContext.jsx, just sequenced into an actual tune instead of a
// single chord/arpeggio.
const NOTES = {
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99,
};
const TUNE = [
  ['G4', 0.28], ['G4', 0.22], ['A4', 0.5], ['G4', 0.5], ['C5', 0.5], ['B4', 1.0],
  ['G4', 0.28], ['G4', 0.22], ['A4', 0.5], ['G4', 0.5], ['D5', 0.5], ['C5', 1.0],
  ['G4', 0.28], ['G4', 0.22], ['G5', 0.5], ['E5', 0.5], ['C5', 0.5], ['B4', 0.5], ['A4', 1.0],
  ['F5', 0.28], ['F5', 0.22], ['E5', 0.5], ['C5', 0.5], ['D5', 0.5], ['C5', 1.0],
];
function playHappyBirthday() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    let t = ctx.currentTime + 0.15;
    const tempo = 0.34;
    TUNE.forEach(([note, beats]) => {
      const dur  = beats * tempo;
      const freq = NOTES[note];
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = freq; o.type = 'triangle';
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.24, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.92);
      o.start(t); o.stop(t + dur);
      t += dur;
    });
  } catch (_) {}
}

const CONFETTI = ['🎉', '🎈', '🎂', '✨', '🎁', '🌟'];

// Fires once per calendar day for a user whose stored birthday matches
// today — mounted at the app shell level so it shows up the moment
// they land anywhere in the app, not just if they happen to open
// Settings. Deduped via localStorage so a refresh/relogin later the
// same day doesn't replay it.
export default function BirthdayCelebration({ user }) {
  const { t } = useLanguage();
  const [show, setShow] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(0);

  const isBirthday = isTodayBirthday(user?.birthday);
  const age = getAge(user?.birthday);
  const firstName = user?.name?.split(' ')[0] || '';

  // Festive accent color for the whole day — set on <html> the moment
  // we know it's their birthday, independent of the popup's own
  // once-a-day dedup below, so the theme stays festive across every
  // page/refresh all day even after the popup's been dismissed. Cleared
  // automatically once it's no longer their birthday (next render after
  // midnight, or a different account).
  useEffect(() => {
    document.documentElement.toggleAttribute('data-birthday', isBirthday);
    return () => document.documentElement.removeAttribute('data-birthday');
  }, [isBirthday]);

  useEffect(() => {
    if (!user?.id || !isBirthday) return;
    const todayKey = new Date().toISOString().slice(0, 10);
    const key = `aurora_bday_shown_${user.id}_${todayKey}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    setShow(true);
    playHappyBirthday();
    api.post('/gamification/birthday-claim')
      .then((res) => { if (res?.claimed) setXpAwarded(res.xpAwarded || 0); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isBirthday]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] flex items-center justify-center px-4"
          style={{ background: 'rgba(7,11,20,0.65)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
          onClick={() => setShow(false)}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {Array.from({ length: 26 }).map((_, i) => (
              <motion.span
                key={i}
                initial={{ y: '-10vh', opacity: 0, rotate: 0 }}
                animate={{ y: '110vh', opacity: [0, 1, 1, 0], rotate: 360 }}
                transition={{
                  duration: 3.5 + Math.random() * 2.5,
                  delay: Math.random() * 1.4,
                  repeat: Infinity,
                  ease: 'linear',
                }}
                className="absolute text-2xl select-none"
                style={{ left: `${Math.random() * 100}%` }}
              >
                {CONFETTI[i % CONFETTI.length]}
              </motion.span>
            ))}
          </div>

          <motion.div
            initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 10 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            className="relative w-full max-w-sm rounded-3xl overflow-hidden text-center px-7 py-9"
            style={{
              background:           'linear-gradient(160deg, rgba(124,106,240,0.30), rgba(245,64,143,0.20))',
              backdropFilter:       'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              border:               '1px solid rgba(255,255,255,0.20)',
              boxShadow:            '0 32px 80px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setShow(false)}
              className="absolute top-3 end-3 flex h-8 w-8 items-center justify-center rounded-xl text-white/60 hover:text-white transition">
              <X size={16} />
            </button>
            <motion.div
              animate={{ rotate: [0, -8, 8, -8, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 1.4 }}
              className="text-6xl mb-3"
            >
              🎂
            </motion.div>
            <h2 className="text-2xl font-display font-bold text-white mb-1">
              {t('bday.title', { name: firstName })}
            </h2>
            {age != null && (
              <p className="text-sm font-semibold text-white/80 mb-3">{t('bday.age', { n: age })}</p>
            )}
            <p className="text-sm text-white/70 leading-relaxed">{t('bday.message')}</p>
            {xpAwarded > 0 && (
              <motion.p
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, type: 'spring', stiffness: 300 }}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg, rgb(var(--accent-500)), rgb(var(--accent-600)))' }}
              >
                {t('bday.xpGift', { n: xpAwarded })}
              </motion.p>
            )}
            <button onClick={() => setShow(false)}
              className="mt-6 w-full rounded-2xl py-2.5 font-semibold text-sm text-white transition"
              style={{ background: 'linear-gradient(135deg, rgb(var(--accent-500)), rgb(var(--accent-600)))' }}
            >
              {t('bday.thanks')}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
