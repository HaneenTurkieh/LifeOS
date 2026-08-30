// FlowRankings.jsx — standalone site-wide Flow leaderboard page, split
// out of wherever it lived inline before so it has its own nav entry
// (per Haneen's call: a real page, not just a section buried in Flow).
// Reuses the existing GET /focus/leaderboard endpoint — that data
// already existed, this just gives it a real home.
import React, { useEffect, useState } from 'react';
import { Trophy, Flame, Clock, Medal } from 'lucide-react';
import { api } from '../api/client.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import GlassCard from '../components/GlassCard.jsx';

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

export default function FlowRankings() {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/focus/leaderboard').then(setData).catch(() => setData({ leaderboard: [], spotlights: {} }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-[40vh] text-ink/30 dark:text-white/30">…</div>;

  const board = data?.leaderboard || [];
  const s = data?.spotlights || {};

  return (
    <div className="flex flex-col gap-6">
      <GlassCard className="p-6 sm:p-7">
        <h1 className="font-display text-2xl font-semibold text-ink dark:text-white flex items-center gap-2">
          <Trophy size={22} className="text-[rgb(var(--accent-500))]" /> {t('flow.rankingsTitle')}
        </h1>
        <p className="text-sm text-ink/45 dark:text-white/40 mt-1">{t('flow.rankingsSubtitle')}</p>
      </GlassCard>

      {(s.star || s.consistent || s.longest) && (
        <div className="grid sm:grid-cols-3 gap-4">
          {s.star && (
            <GlassCard className="p-5 text-center">
              <Trophy size={20} className="mx-auto mb-2" style={{ color: '#FFD700' }} />
              <p className="text-sm font-bold text-ink dark:text-white">{s.star.name}</p>
              <p className="text-xs text-ink/45 dark:text-white/40">{t('flow.mostFocused', { n: s.star.total_minutes })}</p>
            </GlassCard>
          )}
          {s.consistent && (
            <GlassCard className="p-5 text-center">
              <Flame size={20} className="mx-auto mb-2 text-sun-500" />
              <p className="text-sm font-bold text-ink dark:text-white">{s.consistent.name}</p>
              <p className="text-xs text-ink/45 dark:text-white/40">{t('flow.mostConsistent', { n: s.consistent.session_count })}</p>
            </GlassCard>
          )}
          {s.longest && (
            <GlassCard className="p-5 text-center">
              <Clock size={20} className="mx-auto mb-2 text-lavender-500" />
              <p className="text-sm font-bold text-ink dark:text-white">{s.longest.name}</p>
              <p className="text-xs text-ink/45 dark:text-white/40">{t('flow.longestSession', { n: s.longest.duration_minutes })}</p>
            </GlassCard>
          )}
        </div>
      )}

      <GlassCard className="p-5">
        {board.length === 0 ? (
          <p className="text-sm text-ink/40 dark:text-white/35 text-center py-6">{t('flow.noRankingsYet')}</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {board.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-ink/[0.03] dark:bg-white/5">
                <span className="w-7 text-center font-display font-bold text-sm"
                  style={{ color: MEDAL_COLORS[r.rank - 1] || 'inherit' }}>
                  {r.rank <= 3 ? <Medal size={16} style={{ color: MEDAL_COLORS[r.rank - 1] }} /> : r.rank}
                </span>
                <span className="flex-1 text-sm font-medium text-ink dark:text-white truncate">{r.name}</span>
                <span className="text-xs text-ink/40 dark:text-white/35">{r.session_count} sessions</span>
                <span className="text-sm font-bold text-[rgb(var(--accent-500))]">{r.total_minutes}m</span>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
