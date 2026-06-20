import React from 'react';
import GlassCard from './GlassCard.jsx';

export default function StatCard({ icon: Icon, label, value, sublabel, accent = 'from-lavender-500 to-lavender-700', delay = 0 }) {
  return (
    <GlassCard delay={delay} className="p-5 flex items-center gap-4">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} text-white shadow-glow`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink/50">{label}</p>
        <p className="font-display text-xl font-bold text-ink leading-tight truncate">{value}</p>
        {sublabel && <p className="text-[11px] text-ink/40 mt-0.5">{sublabel}</p>}
      </div>
    </GlassCard>
  );
}