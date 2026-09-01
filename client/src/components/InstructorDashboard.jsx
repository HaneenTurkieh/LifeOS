// InstructorDashboard.jsx — the whole student-oriented Dashboard.jsx
// (mood, habits, goals, forest, XP…) doesn't apply to an instructor
// account, so rather than bolting instructor-only branches into every
// widget on that page, Dashboard.jsx renders this small, separate view
// instead once user.role === 'instructor' (see the early return there).
// Per Haneen's spec: "change dashboard accordingly" for instructor
// accounts — this is a light landing pad that points straight at
// Channels, which is the entire point of an instructor account.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ArrowRight, Plus } from 'lucide-react';
import { api } from '../api/client.js';
import GlassCard from './GlassCard.jsx';

export default function InstructorDashboard({ user, t }) {
  const navigate = useNavigate();
  const [channels, setChannels] = useState(null);

  useEffect(() => {
    api.get('/channels/mine').then(setChannels).catch(() => setChannels([]));
  }, []);

  const totalStudents = (channels || []).reduce((sum, c) => sum + (c.member_count || 0), 0);
  const firstName = (user?.name || '').split(' ')[0];

  return (
    <div className="flex flex-col gap-6">
      <GlassCard className="p-7 sm:p-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink dark:text-white mb-1.5">
          {t('dash.instructorWelcome', { name: firstName })} 👋
        </h1>
        <p className="text-sm text-ink/45 dark:text-white/40 mb-5">{t('dash.instructorSubtitle')}</p>
        {channels && channels.length > 0 && (
          <p className="text-sm text-ink/55 dark:text-white/45 mb-5">
            {t('dash.instructorStudentsTotal', { n: totalStudents, c: channels.length })}
          </p>
        )}
        <button onClick={() => navigate('/channels')}
          className="flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg, rgb(var(--accent-400)) 0%, rgb(var(--accent-600)) 100%)' }}>
          <Users size={16} /> {t('dash.instructorGoToChannels')} <ArrowRight size={14} />
        </button>
      </GlassCard>

      {channels && channels.length === 0 && (
        <GlassCard className="p-8 text-center">
          <Plus size={22} className="mx-auto mb-2 text-ink/25 dark:text-white/25" />
          <p className="text-sm text-ink/45 dark:text-white/40">{t('dash.instructorNoChannels')}</p>
        </GlassCard>
      )}

      {channels && channels.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {channels.map((ch) => (
            <GlassCard key={ch.id} interactive onClick={() => navigate('/channels')} className="p-5 cursor-pointer">
              <h3 className="font-display font-bold text-ink dark:text-white truncate">{ch.name}</h3>
              <p className="text-xs text-ink/45 dark:text-white/40 mt-1">{t('channels.members', { n: ch.member_count || 0 })}</p>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
