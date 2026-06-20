import HabitHistory from '../components/HabitHistory.jsx';
import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import { Plus, Trash2, Flame, Dumbbell } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import GlassCard from '../components/GlassCard.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import PageLoader from '../components/Loader.jsx';

const ICON_CHOICES = ['Dumbbell', 'BookOpen', 'Droplets', 'Code2', 'Wind', 'Sparkles', 'Sun', 'Moon', 'Music', 'PenLine'];
const COLOR_CHOICES = ['#F97316', '#6366F1', '#06B6D4', '#22C55E', '#A855F7', '#EC4899', '#F59E0B', '#14B8A6'];
const emptyForm = { name: '', icon: 'Sparkles', color: '#6366F1', target_per_week: 7 };

function last30Dates() {
  const out = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export default function Habits() {
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const toast = useToast();
  const dates = last30Dates();

  const load = useCallback(async () => {
    try { setHabits(await api.get('/habits')); } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const createHabit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      await api.post('/habits', form);
      toast.success('Habit added');
      setForm(emptyForm);
      setModalOpen(false);
      load();
    } catch (err) { toast.error(err.message); }
  };

  const toggleToday = async (habit) => {
    const { xpAwarded, unlocked } = await api.post(`/habits/${habit.id}/toggle`, {});
    if (xpAwarded) toast.xp(xpAwarded, habit.name);
    unlocked?.forEach((k) => toast.achievement(k.replace(/_/g, ' ')));
    load();
  };

  const removeHabit = async (id) => { await api.del(`/habits/${id}`); toast.success('Habit removed'); load(); };

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        eyebrow="Habit Tracker"
        title="Stack the small wins"
        subtitle="Exercise, reading, water, coding — consistency compounds."
        action={<button className="btn-primary" onClick={() => setModalOpen(true)}><Plus size={16}/> New habit</button>}
      />

      {habits.length === 0 ? (
        <EmptyState icon={Dumbbell} title="No habits yet" message="Add a habit you want to build, like Exercise or Reading." action={<button className="btn-primary mt-2" onClick={() => setModalOpen(true)}><Plus size={16}/> New habit</button>} />
      ) : (
        <div className="flex flex-col gap-4">
          {habits.map((h, i) => {
            const Icon = Icons[h.icon] || Icons.Sparkles;
            const doneDates = new Set(h.last30);
            return (
              <GlassCard key={h.id} delay={i * 0.04} className="p-5">
                <div className="flex flex-wrap items-center gap-4 justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-sm" style={{ backgroundColor: h.color }}>
                      <Icon size={19} />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-ink">{h.name}</h3>
                      <p className="text-xs text-ink/45">Target: {h.target_per_week}x / week</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="pill bg-coral-500/10 text-coral-500"><Flame size={12}/> {h.streak} day streak</div>
                    <div className="pill bg-lavender-100 text-lavender-700">{h.completionRate}% / 30d</div>
                    <button
                      onClick={() => toggleToday(h)}
                      className={`rounded-2xl px-4 py-2 text-xs font-semibold transition ${h.doneToday ? 'bg-sage-100 text-sage-700' : 'bg-lavender-50 text-lavender-700 hover:bg-lavender-100'}`}
                    >
                      {h.doneToday ? '✓ Done today' : 'Mark done'}
                    </button>
                    <button onClick={() => removeHabit(h.id)} className="text-ink/25 hover:text-coral-500 transition"><Trash2 size={15} /></button>
                  </div>
                </div>
                <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(18px, 1fr))' }}>
                  {dates.map((d) => (
                    <div
                      key={d}
                      title={d}
                      className="aspect-square rounded-md"
                      style={{ backgroundColor: doneDates.has(d) ? h.color : 'rgba(124,106,240,0.08)' }}
                    />
                  ))}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
      <div className="mt-6">
  <HabitHistory habits={habits} />
</div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New habit">
        <form onSubmit={createHabit} className="flex flex-col gap-3.5">
          <input className="input-field" placeholder="Habit name, e.g. Exercise" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus required />
          <div>
            <label className="text-xs font-semibold text-ink/50 mb-1.5 block">Icon</label>
            <div className="flex flex-wrap gap-2">
              {ICON_CHOICES.map((iconName) => {
                const Icon = Icons[iconName];
                return (
                  <button type="button" key={iconName} onClick={() => setForm({ ...form, icon: iconName })}
                    className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${form.icon === iconName ? 'border-lavender-500 bg-lavender-100' : 'border-white/70 bg-white/50'}`}>
                    <Icon size={16} />
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink/50 mb-1.5 block">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_CHOICES.map((c) => (
                <button type="button" key={c} onClick={() => setForm({ ...form, color: c })}
                  className={`h-7 w-7 rounded-full border-2 transition ${form.color === c ? 'border-ink scale-110' : 'border-white'}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink/50 mb-1.5 block">Target days / week: {form.target_per_week}</label>
            <input type="range" min="1" max="7" value={form.target_per_week} onChange={(e) => setForm({ ...form, target_per_week: Number(e.target.value) })} className="w-full accent-lavender-600" />
          </div>
          <button type="submit" className="btn-primary justify-center mt-1">Add habit</button>
        </form>
      </Modal>
    </div>
  );
}