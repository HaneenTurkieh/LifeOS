import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Target, Wand2, CheckSquare, Square, Trash2 } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import GlassCard from '../components/GlassCard.jsx';
import ProgressRing from '../components/ProgressRing.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import PageLoader from '../components/Loader.jsx';

const emptyForm = { title: '', description: '', category: 'Personal', target_date: '', milestonesText: '' };

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [suggesting, setSuggesting] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    try { setGoals(await api.get('/goals')); } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const suggestMilestones = async () => {
    if (!form.title.trim()) { toast.error('Add a goal title first'); return; }
    setSuggesting(true);
    try {
      const { plan } = await api.post('/ai/goal-breakdown', { title: form.title, weeks: 4 });
      setForm({ ...form, milestonesText: plan.map((p) => p.focus).join('\n') });
    } catch (e) { toast.error(e.message); } finally { setSuggesting(false); }
  };

  const createGoal = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const milestones = form.milestonesText.split('\n').map((s) => s.trim()).filter(Boolean);
    try {
      await api.post('/goals', { ...form, target_date: form.target_date || null, milestones });
      toast.success('Goal created');
      setForm(emptyForm);
      setModalOpen(false);
      load();
    } catch (err) { toast.error(err.message); }
  };

  const toggleMilestone = async (goal, milestone) => {
    await api.put(`/goals/${goal.id}/milestones/${milestone.id}`, { done: !milestone.done });
    load();
  };

  const markComplete = async (goal) => {
    const { xpAwarded, unlocked } = await api.put(`/goals/${goal.id}`, { status: goal.status === 'completed' ? 'active' : 'completed' });
    if (xpAwarded) toast.xp(xpAwarded, `Goal complete: ${goal.title}`);
    unlocked?.forEach((k) => toast.achievement(k.replace(/_/g, ' ')));
    load();
  };

  const removeGoal = async (id) => { await api.del(`/goals/${id}`); toast.success('Goal removed'); load(); };

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        eyebrow="Goals"
        title="The big picture"
        subtitle="Break ambitious goals into milestones you can actually check off."
        action={<button className="btn-primary" onClick={() => setModalOpen(true)}><Plus size={16}/> New goal</button>}
      />

      {goals.length === 0 ? (
        <EmptyState icon={Target} title="No goals yet" message="Add a goal like 'Get driving license' or 'Build portfolio project'." action={<button className="btn-primary mt-2" onClick={() => setModalOpen(true)}><Plus size={16}/> New goal</button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {goals.map((g, i) => (
            <GlassCard key={g.id} delay={i * 0.05} className="p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <ProgressRing value={g.progress} size={56} strokeWidth={6} colorFrom={g.status === 'completed' ? '#4CC38A' : '#7C6AF0'} colorTo={g.status === 'completed' ? '#2DA76E' : '#5B47E0'} />
                  <div>
                    <p className="pill bg-lavender-100 text-lavender-700 mb-1">{g.category}</p>
                    <h3 className="font-display font-bold text-ink leading-snug">{g.title}</h3>
                  </div>
                </div>
                <button onClick={() => removeGoal(g.id)} className="text-ink/25 hover:text-coral-500 transition shrink-0"><Trash2 size={15} /></button>
              </div>
              {g.description && <p className="text-sm text-ink/50 mt-3">{g.description}</p>}
              {g.target_date && <p className="text-xs text-ink/40 mt-1">Target: {g.target_date}</p>}

              {g.milestones.length > 0 && (
                <div className="mt-4 flex flex-col gap-1.5">
                  {g.milestones.map((m) => (
                    <button key={m.id} onClick={() => toggleMilestone(g, m)} className="flex items-center gap-2 text-left rounded-xl px-2 py-1.5 hover:bg-white/60 transition">
                      {m.done ? <CheckSquare size={16} className="text-sage-500 shrink-0" /> : <Square size={16} className="text-ink/25 shrink-0" />}
                      <span className={`text-sm ${m.done ? 'text-ink/40 line-through' : 'text-ink/80'}`}>{m.title}</span>
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => markComplete(g)}
                className={`mt-4 w-full rounded-2xl py-2 text-sm font-semibold transition ${
                  g.status === 'completed' ? 'bg-sage-100 text-sage-700' : 'bg-lavender-50 text-lavender-700 hover:bg-lavender-100'
                }`}
              >
                {g.status === 'completed' ? '✓ Goal completed' : 'Mark goal as complete'}
              </button>
            </GlassCard>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New goal">
        <form onSubmit={createGoal} className="flex flex-col gap-3.5">
          <input className="input-field" placeholder="Goal title, e.g. Finish Python course" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus required />
          <textarea className="input-field" placeholder="Description (optional)" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <input className="input-field" placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <input type="date" className="input-field" value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-ink/50">Milestones (one per line)</label>
              <button type="button" onClick={suggestMilestones} disabled={suggesting} className="flex items-center gap-1 text-xs font-semibold text-lavender-600 hover:underline disabled:opacity-50">
                <Wand2 size={12} /> {suggesting ? 'Thinking…' : 'Suggest with AI'}
              </button>
            </div>
            <textarea className="input-field" rows={4} placeholder={'Research the goal\nFinish first sub-task\nGet feedback\nShip it'} value={form.milestonesText} onChange={(e) => setForm({ ...form, milestonesText: e.target.value })} />
          </div>
          <button type="submit" className="btn-primary justify-center mt-1">Create goal</button>
        </form>
      </Modal>
    </div>
  );
}