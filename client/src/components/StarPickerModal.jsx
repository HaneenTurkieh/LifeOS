import React from 'react';
import Modal from './Modal.jsx';

// The little reward moment for finishing a goal — pick which star design
// gets pinned to it on the Goals page's star-chart poster (StarChartCard).
// Purely cosmetic (stored as goals.star_style), no gameplay consequence —
// just a "make it yours" touch, same spirit as picking a tree design.
export const STAR_STYLES = [
  { key: 'gold',    glyph: '★', color: '#F5B324' },
  { key: 'silver',  glyph: '★', color: '#A9B4C0' },
  { key: 'navy',    glyph: '★', color: '#3A4A7A' },
  { key: 'coral',   glyph: '★', color: '#E0685A' },
  { key: 'pink',    glyph: '★', color: '#E28BB0' },
  { key: 'green',   glyph: '★', color: '#5FA777' },
  { key: 'sky',     glyph: '★', color: '#5B9BD6' },
  { key: 'sparkle', glyph: '✦', color: '#8B7FD1' },
];

export default function StarPickerModal({ goal, onClose, onPick, t }) {
  return (
    <Modal open={!!goal} onClose={onClose} title={t('goals.pickStarTitle')} maxWidth="max-w-sm">
      <p className="text-sm text-ink/55 dark:text-white/40 mb-5 -mt-1">
        {t('goals.pickStarIntro', { title: goal?.title || '' })}
      </p>
      <div className="grid grid-cols-4 gap-3">
        {STAR_STYLES.map((s) => (
          <button
            key={s.key}
            onClick={() => onPick(s.key)}
            className="flex h-16 items-center justify-center rounded-2xl text-3xl transition-transform hover:scale-110 active:scale-95"
            style={{ background: 'rgb(var(--accent-500) / 0.06)', border: '1px solid rgb(var(--accent-500) / 0.14)', color: s.color }}
          >
            {s.glyph}
          </button>
        ))}
      </div>
    </Modal>
  );
}
