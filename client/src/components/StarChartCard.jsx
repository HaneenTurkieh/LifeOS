import React from 'react';
import { Sparkles } from 'lucide-react';
import GlassCard from './GlassCard.jsx';

// A whimsical, decorative companion to the real goals grid below it —
// every active goal shown as a star on a little paper poster, filling
// in gold once it's done. Purely visual (no drag-and-drop, no separate
// state of its own): it just reads straight off the same `goals` array
// the grid uses, so it can never drift out of sync with real data.
// The paper background is deliberately NOT theme-aware (light/dark) —
// it's meant to read as a physical object (an actual sheet of paper),
// and a "dark mode paper" would look wrong rather than adaptive.
export default function StarChartCard({ goals = [], t }) {
  const visible = goals.slice(0, 6);
  const extra   = goals.length - visible.length;

  const captionFor = (g) => {
    if (g.status === 'completed') return t('goals.starDone');
    const total = g.milestones?.length || 0;
    const done  = g.milestones?.filter((m) => m.done).length || 0;
    if (total > 0) return t('goals.starMilestones', { done, total });
    if (Number(g.progress) > 0) return t('goals.starProgress', { n: Math.round(Number(g.progress)) });
    return t('goals.starNotStarted');
  };

  return (
    <GlassCard className="p-5 mb-5">
      <div className="flex items-center gap-2 mb-3.5">
        <Sparkles size={15} style={{ color: 'rgb(var(--accent-500))' }} />
        <span className="text-xs font-bold uppercase tracking-widest text-ink/45 dark:text-white/35">
          {t('goals.starChartLabel')}
        </span>
      </div>
      <div className="relative rounded-2xl px-4 py-4 shadow-[0_8px_20px_rgba(0,0,0,0.18)]"
        style={{ background: '#F3ECDA', transform: 'rotate(-0.4deg)' }}>
        <span className="absolute -top-2 left-6 h-3.5 w-9 -rotate-3"
          style={{ background: 'rgba(230,200,120,0.55)' }} />
        <div className="flex flex-col gap-2.5">
          {visible.map((g) => {
            const filled = g.status === 'completed' || Number(g.progress) >= 100;
            return (
              <div key={g.id} className="flex items-center gap-2.5">
                <span className="text-lg leading-none shrink-0" style={{ color: filled ? '#F5B324' : '#C9BE9E' }}>
                  {filled ? '★' : '☆'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold leading-tight truncate" style={{ color: '#3A3020' }}>
                    {g.title}
                  </p>
                  <p className="text-[11px] leading-tight" style={{ color: '#8A7B55' }}>
                    {captionFor(g)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        {extra > 0 && (
          <p className="text-[11px] mt-2.5 text-right" style={{ color: '#8A7B55' }}>
            {t('goals.starMore', { n: extra })}
          </p>
        )}
        <span className="absolute bottom-2.5 right-3.5 text-sm rotate-12" style={{ color: '#D8A6C4' }}>✧</span>
        <span className="absolute top-3.5 right-4 text-[11px] -rotate-6" style={{ color: '#9BB8E0' }}>✧</span>
      </div>
    </GlassCard>
  );
}
