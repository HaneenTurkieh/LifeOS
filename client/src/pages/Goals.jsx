import React, { useEffect, useState, useCallback } from 'react';
import * as Icons from 'lucide-react';
import { Plus, Target, Trash2, CheckSquare, Square, Flame, RefreshCw } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import GlassCard from '../components/GlassCard.jsx';
import ProgressRing from '../components/ProgressRing.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import PageLoader from '../components/Loader.jsx';
import HabitHistory from '../components/HabitHistory.jsx';

const ICON_CHOICES = ['Dumbbell','BookOpen','Droplets','Code2','Wind','Sparkles','Sun','Moon','Music','PenLine'];
const COLOR_CHOICES = ['#F97316','#6366F1','#06B6D4','#22C55E','#A855F7','#EC4899','#F59E0B','#14B8A6'];

const emptyGoalForm    = { title: '', description: '', category: 'Personal', target_date: '', milestonesText: '' };
const emptyRecurForm   = { name: '', icon: 'Sparkles', color: '#6366F1', target_per_week: 7 };

function last30Dates() {
  const out = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export default function Goals() {
  const [tab, setTab]               = useState('goals');
  const [goals, setGoals]           = useState([]);
  const [habits, setHabits]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [goalModal, setGoalModal]   = useState(false);
  const [recurModal, setRecurModal] = useState(false);
  const [goalForm, setGoalForm]     = useState(emptyGoalForm);
  const [recurForm, setRecurForm]   = useState(emptyRecurForm);
  const [suggesting, setSuggesting] = useState(false);
  const toast = useToast();
  const dates = last30Dates();

  const loadGoals  = useCallback(async () => {
    try { setGoals(await api.get('/goals')); } catch (e) { toast.error(e.message); }
  }, []); // eslint-disable-line
  const loadHabits = useCallback(async () => {
    try { setHabits(await api.get('/habits')); } catch (e) { toast.error(e.message); }
  }, []); // eslint-disable-line

  useEffect(() => {
    Promise.all([loadGoals(), loadHabits()]).finally(() => setLoading(false));
  }, [loadGoals, loadHabits]);

  // ── Goal handlers ─────────────────────────────────────
  const suggestMilestones = async () => {
    if (!goalForm.title.trim()) { toast.error('Add a goal title first'); return; }
    setSuggesting(true);
    try {
      const { plan } = await api.post('/ai/goal-breakdown', { title: goalForm.title, weeks: 4 });
      setGoalForm({ ...goalForm, milestonesText: plan.map((p) => p.focus).join('\n') });
    } catch (e) { toast.error(e.message); } finally { setSuggesting(false); }
  };

  const createGoal = async (e) => {
    e.preventDefault();
    if (!goalForm.title.trim()) return;
    const milestones = goalForm.milestonesText.split('\n').map((s) => s.trim()).filter(Boolean);
    try {
      await api.post('/goals', { ...goalForm, target_date: goalForm.target_date || null, milestones });
      toast.success('Goal created');
      setGoalForm(emptyGoalForm); setGoalModal(false); loadGoals();
    } catch (err) { toast.error(err.message); }
  };

  const toggleMilestone = async (goal, m) => {
    await api.put(`/goals/${goal.id}/milestones/${m.id}`, { done: !m.done });
    loadGoals();
  };

  const markComplete = async (goal) => {
    const { xpAwarded, unlocked } = await api.put(`/goals/${goal.id}`, {
      status: goal.status === 'completed' ? 'active' : 'completed',
    });
    if (xpAwarded) toast.xp(xpAwarded, `Goal complete: ${goal.title}`);
    unlocked?.forEach((k) => toast.achievement(k.replace(/_/g, ' ')));
    loadGoals();
  };

  const removeGoal = async (id) => { await api.del(`/goals/${id}`); toast.success('Goal removed'); loadGoals(); };

  // ── Recurring task handlers ───────────────────────────
  const createRecur = async (e) => {
    e.preventDefault();
    if (!recurForm.name.trim()) return;
    try {
      await api.post('/habits', recurForm);
      toast.success('Recurring task added');
      setRecurForm(emptyRecurForm); setRecurModal(false); loadHabits();
    } catch (err) { toast.error(err.message); }
  };

  const toggleToday = async (habit) => {
    const { xpAwarded, unlocked } = await api.post(`/habits/${habit.id}/toggle`, {});
    if (xpAwarded) toast.xp(xpAwarded, habit.name);
    unlocked?.forEach((k) => toast.achievement(k.replace(/_/g, ' ')));
    loadHabits();
  };

  const removeHabit = async (id) => { await api.del(`/habits/${id}`); toast.success('Recurring task removed'); loadHabits(); };

  if (loading) return <PageLoader />;

  const TABS = [
    { key: 'goals',     label: 'Goals',            count: goals.length },
    { key: 'recurring', label: 'Recurring Tasks',  count: habits.length },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Goals & Recurring Tasks"
        title={tab === 'goals' ? 'The big picture' : 'Daily commitments'}
        subtitle={tab === 'goals'
          ? 'Break ambitious goals into milestones. Progress is calculated automatically.'
          : 'Tasks that repeat on a schedule — streaks, completion rates, 30-day history.'}
        action={
          tab === 'goals'
            ? <button className="btn-primary" onClick={() => setGoalModal(true)}><Plus size={16}/> New goal</button>
            : <button className="btn-primary" onClick={() => setRecurModal(true)}><Plus size={16}/> New recurring task</button>
        }
      />

      {/* Tab switcher */}
      <div className="flex gap-1 mb-6 bg-white/40 dark:bg-white/[0.04] rounded-2xl p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === t.key
                ? 'bg-white dark:bg-white/10 text-ink dark:text-white shadow-sm'
                : 'text-ink/50 dark:text-white/40 hover:text-ink/80 dark:hover:text-white/60'
            }`}
          >
            {t.label}
            <span className={`text-xs rounded-full px-1.5 py-0.5 ${
              tab === t.key ? 'bg-lavender-100 text-lavender-700' : 'bg-ink/5 text-ink/40 dark:bg-white/5 dark:text-white/30'
            }`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* ── Goals ───────────────────────────────────────── */}
      {tab === 'goals' && (
        goals.length === 0 ? (
          <EmptyState
            icon={Target} title="No goals yet"
            message="Add a goal like 'Get driving license' or 'Build portfolio project'."
            action={<button className="btn-primary mt-2" onClick={() => setGoalModal(true)}><Plus size={16}/> New goal</button>}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {goals.map((g, i) => (
              <GlassCard key={g.id} delay={i * 0.05} className="p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <ProgressRing
                      value={g.progress} size={56} strokeWidth={6}
                      colorFrom={g.status === 'completed' ? '#4CC38A' : '#7C6AF0'}
                      colorTo={g.status === 'completed' ? '#2DA76E' : '#5B47E0'}
                    />
                    <div>
                      <p className="pill bg-lavender-100 text-lavender-700 mb-1">{g.category}</p>
                      <h3 className="font-display font-bold text-ink leading-snug">{g.title}</h3>
                    </div>
                  </div>
                  <button onClick={() => removeGoal(g.id)} className="text-ink/25 hover:text-coral-500 transition shrink-0">
                    <Trash2 size={15}/>
                  </button>
                </div>

                {g.description && <p className="text-sm text-ink/50 mt-3">{g.description}</p>}
                {g.target_date  && <p className="text-xs text-ink/40 mt-1">Target: {g.target_date}</p>}

                {g.milestones.length > 0 && (
                  <div className="mt-4 flex flex-col gap-1.5">
                    {g.milestones.map((m) => (
                      <button key={m.id} onClick={() => toggleMilestone(g, m)}
                        className="flex items-center gap-2 text-left rounded-xl px-2 py-1.5 hover:bg-white/60 transition">
                        {m.done
                          ? <CheckSquare size={16} className="text-sage-500 shrink-0"/>
                          : <Square      size={16} className="text-ink/25 shrink-0"/>}
                        <span className={`text-sm ${m.done ? 'text-ink/40 line-through' : 'text-ink/80'}`}>{m.title}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Auto-calculated progress label */}
                {g.milestones.length > 0 && (
                  <p className="text-xs text-ink/35 mt-2">
                    {g.milestones.filter((m) => m.done).length} / {g.milestones.length} milestones done — {g.progress}% complete
                  </p>
                )}

                <button
                  onClick={() => markComplete(g)}
                  className={`mt-4 w-full rounded-2xl py-2 text-sm font-semibold transition ${
                    g.status === 'completed'
                      ? 'bg-sage-100 text-sage-700'
                      : 'bg-lavender-50 text-lavender-700 hover:bg-lavender-100'
                  }`}
                >
                  {g.status === 'completed' ? '✓ Goal completed' : 'Mark goal as complete'}
                </button>
              </GlassCard>
            ))}
          </div>
        )
      )}

      {/* ── Recurring Tasks ──────────────────────────────── */}
      {tab === 'recurring' && (
        habits.length === 0 ? (
          <EmptyState
            icon={RefreshCw} title="No recurring tasks yet"
            message="Add daily commitments like Exercise, Read 20 pages, or Meditate."
            action={<button className="btn-primary mt-2" onClick={() => setRecurModal(true)}><Plus size={16}/> New recurring task</button>}
          />
        ) : (
          <>
            <div className="flex flex-col gap-4">
              {habits.map((h, i) => {
                const Icon = Icons[h.icon] || Icons.Sparkles;
                const doneDates = new Set(h.last30);
                return (
                  <GlassCard key={h.id} delay={i * 0.04} className="p-5">
                    <div className="flex flex-wrap items-center gap-4 justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-sm" style={{ backgroundColor: h.color }}>
                          <Icon size={19}/>
                        </div>
                        <div>
                          <h3 className="font-display font-bold text-ink">{h.name}</h3>
                          <p className="text-xs text-ink/45">Target: {h.target_per_week}x / week</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="pill bg-coral-500/10 text-coral-500"><Flame size={12}/> {h.streak} day streak</span>
                        <span className="pill bg-lavender-100 text-lavender-700">{h.completionRate}% / 30d</span>
                        <button
                          onClick={() => toggleToday(h)}
                          className={`rounded-2xl px-4 py-2 text-xs font-semibold transition ${
                            h.doneToday ? 'bg-sage-100 text-sage-700' : 'bg-lavender-50 text-lavender-700 hover:bg-lavender-100'
                          }`}
                        >
                          {h.doneToday ? '✓ Done today' : 'Mark done'}
                        </button>
                        <button onClick={() => removeHabit(h.id)} className="text-ink/25 hover:text-coral-500 transition">
                          <Trash2 size={15}/>
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(18px, 1fr))' }}>
                      {dates.map((d) => (
                        <div key={d} title={d} className="aspect-square rounded-md"
                          style={{ backgroundColor: doneDates.has(d) ? h.color : 'rgba(124,106,240,0.08)' }}
                        />
                      ))}
                    </div>
                  </GlassCard>
                );
              })}
            </div>
            <div className="mt-6"><HabitHistory habits={habits}/></div>
          </>
        )
      )}

      {/* ── Goal Modal ───────────────────────────────────── */}
      <Modal open={goalModal} onClose={() => setGoalModal(false)} title="New goal">
        <form onSubmit={createGoal} className="flex flex-col gap-3.5">
          <input className="input-field" placeholder="Goal title, e.g. Finish Python course"
            value={goalForm.title} onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })} autoFocus required />
          <textarea className="input-field" placeholder="Description (optional)" rows={2}
            value={goalForm.description} onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}/>
          <div className="grid grid-cols-2 gap-3">
            <input className="input-field" placeholder="Category"
              value={goalForm.category} onChange={(e) => setGoalForm({ ...goalForm, category: e.target.value })}/>
            <input type="date" className="input-field"
              value={goalForm.target_date} onChange={(e) => setGoalForm({ ...goalForm, target_date: e.target.value })}/>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-ink/50">Milestones (one per line)</label>
              <button type="button" onClick={suggestMilestones} disabled={suggesting}
                className="flex items-center gap-1 text-xs font-semibold text-lavender-600 hover:underline disabled:opacity-50">
                <Icons.Wand2 size={12}/> {suggesting ? 'Thinking…' : 'Suggest with AI'}
              </button>
            </div>
            <textarea className="input-field" rows={4}
              placeholder={'Research the goal\nFinish first sub-task\nGet feedback\nShip it'}
              value={goalForm.milestonesText} onChange={(e) => setGoalForm({ ...goalForm, milestonesText: e.target.value })}/>
          </div>
          <button type="submit" className="btn-primary justify-center mt-1">Create goal</button>
        </form>
      </Modal>

      {/* ── Recurring Task Modal ─────────────────────────── */}
      <Modal open={recurModal} onClose={() => setRecurModal(false)} title="New recurring task">
        <form onSubmit={createRecur} className="flex flex-col gap-3.5">
          <input className="input-field" placeholder="e.g. Exercise, Read 20 pages, Meditate"
            value={recurForm.name} onChange={(e) => setRecurForm({ ...recurForm, name: e.target.value })} autoFocus required/>
          <div>
            <label className="text-xs font-semibold text-ink/50 mb-1.5 block">Icon</label>
            <div className="flex flex-wrap gap-2">
              {ICON_CHOICES.map((iconName) => {
                const Icon = Icons[iconName];
                return (
                  <button type="button" key={iconName} onClick={() => setRecurForm({ ...recurForm, icon: iconName })}
                    className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                      recurForm.icon === iconName ? 'border-lavender-500 bg-lavender-100' : 'border-white/70 bg-white/50'
                    }`}>
                    <Icon size={16}/>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink/50 mb-1.5 block">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_CHOICES.map((c) => (
                <button type="button" key={c} onClick={() => setRecurForm({ ...recurForm, color: c })}
                  className={`h-7 w-7 rounded-full border-2 transition ${recurForm.color === c ? 'border-ink scale-110' : 'border-white'}`}
                  style={{ backgroundColor: c }}/>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink/50 mb-1.5 block">
              Target days / week: {recurForm.target_per_week}
            </label>
            <input type="range" min="1" max="7" value={recurForm.target_per_week}
              onChange={(e) => setRecurForm({ ...recurForm, target_per_week: Number(e.target.value) })}
              className="w-full accent-lavender-600"/>
          </div>
          <button type="submit" className="btn-primary justify-center mt-1">Add recurring task</button>
        </form>
      </Modal>
    </div>
  );
}