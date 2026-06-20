import React from 'react';
import * as Icons from 'lucide-react';
import { Check } from 'lucide-react';
import GlassCard from './GlassCard.jsx';

function last7Dates() {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function dayLabel(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'narrow' });
}

// Expects `habits` = result of GET /api/habits (each item has `last30: string[]`).
export default function HabitHistory({ habits = [] }) {
  const dates = last7Dates();

  if (habits.length === 0) {
    return (
      <GlassCard className="p-6">
        <p className="text-sm text-ink/40">No habits yet — add one to see your 7-day history.</p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-6">
      <h3 className="font-display font-bold text-ink mb-4">7-day habit history</h3>
      <div className="flex flex-col gap-3">
        {habits.map((h) => {
          const Icon = Icons[h.icon] || Icons.Sparkles;
          const done = new Set(h.last30 || []);
          return (
            <div key={h.id} className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: h.color }}>
                <Icon size={14} />
              </div>
              <p className="text-sm font-medium text-ink w-28 truncate">{h.name}</p>
              <div className="flex gap-1.5">
                {dates.map((date) => (
                  <div key={date} className="flex flex-col items-center gap-1">
                    <span className="text-[9px] text-ink/35">{dayLabel(date)}</span>
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                        done.has(date) ? 'border-transparent text-white' : 'border-ink/10 bg-white/40'
                      }`}
                      style={done.has(date) ? { backgroundColor: h.color } : {}}
                    >
                      {done.has(date) && <Check size={12} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}