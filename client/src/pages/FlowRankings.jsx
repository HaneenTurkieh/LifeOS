// FlowRankings.jsx — standalone site-wide Flow leaderboard page, split
// out of wherever it lived inline before so it has its own nav entry
// (per Haneen's call: a real page, not just a section buried in Flow).
// Reuses the existing GET /focus/leaderboard endpoint — that data
// already existed, this just gives it a real home.
import React, { useEffect, useState } from 'react';
import { Trophy, Flame, Clock, Medal, Users } from 'lucide-react';
import { api } from '../api/client.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useFocus } from '../context/FocusContext.jsx';
import GlassCard from '../components/GlassCard.jsx';
import LeaderboardTreeBadge from '../components/LeaderboardTreeBadge.jsx';

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

export default function FlowRankings() {
  const { t } = useLanguage();
  const { room } = useFocus(); // whichever room is currently active, if any (set app-wide by FocusContext)
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // 'global' (existing site-wide weekly leaderboard) vs 'room' (this
  // room's own members, ranked by the same weekly focus_minutes the
  // room screen already shows — no new leaderboard concept, just a
  // second view onto data that already existed).
  const [viewMode, setViewMode] = useState('global');
  const [roomData, setRoomData] = useState(null);
  const [roomLoading, setRoomLoading] = useState(false);

  useEffect(() => {
    api.get('/focus/leaderboard').then(setData).catch(() => setData({ leaderboard: [], spotlights: {} }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (viewMode !== 'room' || !room?.code) return;
    setRoomLoading(true);
    api.get(`/focus/rooms/${room.code}`).then(setRoomData).catch(() => setRoomData(null))
      .finally(() => setRoomLoading(false));
  }, [viewMode, room?.code]);

  if (loading) return <div className="flex items-center justify-center min-h-[40vh] text-ink/30 dark:text-white/30">…</div>;

  const board = data?.leaderboard || [];
  const s = data?.spotlights || {};
  // GET /focus/rooms/:code already returns members ordered by
  // focus_minutes DESC (see server/routes/focus.js) — this just adds
  // the 1-based rank on top of that existing order.
  const roomBoard = (roomData?.members || []).map((m, i) => ({ ...m, rank: i + 1 }));

  return (
    <div className="flex flex-col gap-6">
      <GlassCard className="p-6 sm:p-7">
        <h1 className="font-display text-2xl font-semibold text-ink dark:text-white flex items-center gap-2">
          <Trophy size={22} className="text-[rgb(var(--accent-500))]" /> {t('flow.rankingsTitle')}
        </h1>
        <p className="text-sm text-ink/45 dark:text-white/40 mt-1">{t('flow.rankingsSubtitle')}</p>

        <div className="flex items-center gap-1.5 mt-4">
          <button type="button" onClick={() => setViewMode('global')}
            className="rounded-xl px-3.5 py-1.5 text-xs font-semibold transition"
            style={viewMode === 'global'
              ? { background: 'rgb(var(--accent-500) / 0.15)', color: 'rgb(var(--accent-500))' }
              : { background: 'transparent', color: 'inherit' }}>
            {t('flow.globalRankings')}
          </button>
          <button type="button" onClick={() => setViewMode('room')}
            className="rounded-xl px-3.5 py-1.5 text-xs font-semibold transition flex items-center gap-1.5"
            style={viewMode === 'room'
              ? { background: 'rgb(var(--accent-500) / 0.15)', color: 'rgb(var(--accent-500))' }
              : { background: 'transparent', color: 'inherit' }}>
            <Users size={13} /> {t('flow.roomRankings')}
          </button>
        </div>
      </GlassCard>

      {viewMode === 'room' ? (
        <GlassCard className="p-5">
          {!room?.code ? (
            <p className="text-sm text-ink/40 dark:text-white/35 text-center py-6">{t('flow.noRoomForRanking')}</p>
          ) : roomLoading ? (
            <p className="text-sm text-ink/30 dark:text-white/25 text-center py-6">…</p>
          ) : roomBoard.length === 0 ? (
            <p className="text-sm text-ink/40 dark:text-white/35 text-center py-6">{t('flow.noRankingsYet')}</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {roomBoard.map((m) => (
                <div key={m.user_id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-ink/[0.03] dark:bg-white/5">
                  <span className="w-7 text-center font-display font-bold text-sm"
                    style={{ color: MEDAL_COLORS[m.rank - 1] || 'inherit' }}>
                    {m.rank <= 3 ? <Medal size={16} style={{ color: MEDAL_COLORS[m.rank - 1] }} /> : m.rank}
                  </span>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white text-xs font-bold"
                    style={{ background: 'linear-gradient(135deg, rgb(var(--accent-500)) 0%, rgb(var(--accent-500) / 0.65) 100%)' }}>
                    {m.display_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <span className="flex-1 text-sm font-medium text-ink dark:text-white truncate">{m.display_name}</span>
                  <span className="text-sm font-bold text-[rgb(var(--accent-500))]">{m.focus_minutes}m</span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      ) : (s.star || s.consistent || s.longest) && (
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

      {viewMode !== 'room' && (
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
                  {/* Who they are (initials avatar, same language as the
                      room view) is now the primary shape here, with what
                      they've equipped as a small badge riding its corner
                      — same layering the room member list already uses
                      for the "focusing" badge, just carrying a tree
                      instead. Keeps the Tree Shop showcase this badge
                      exists for (see LeaderboardTreeBadge) without a
                      second full-size icon competing for space. */}
                  <div className="relative shrink-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl text-white text-xs font-bold"
                      style={{ background: 'linear-gradient(135deg, rgb(var(--accent-500)) 0%, rgb(var(--accent-500) / 0.65) 100%)' }}>
                      {r.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="absolute -bottom-1.5 -end-1.5 rounded-full p-[3px] bg-white dark:bg-[#181428]"
                      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
                      <LeaderboardTreeBadge treeKey={r.equipped_tree_key} mysticDesign={r.mystic_design} size={13} />
                    </div>
                  </div>
                  <span className="flex-1 text-sm font-medium text-ink dark:text-white truncate">{r.name}</span>
                  <span className="text-xs text-ink/40 dark:text-white/35">{r.session_count} sessions</span>
                  <span className="text-sm font-bold text-[rgb(var(--accent-500))]">{r.total_minutes}m</span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      )}
    </div>
  );
}
