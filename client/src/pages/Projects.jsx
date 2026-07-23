import React, { useEffect, useState, useCallback } from 'react';
import { Trash2, FolderKanban, Sparkles, CheckCircle2 } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import GlassCard  from '../components/GlassCard.jsx';
import Modal      from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import PageLoader from '../components/Loader.jsx';

const STAGES = [
  { key: 'idea',        title: 'Idea',        accent: 'bg-ink/20',       progress: 10  },
  { key: 'design',      title: 'Design',      accent: 'bg-lavender-400', progress: 30  },
  { key: 'development', title: 'Development', accent: 'bg-sun-500',      progress: 60  },
  { key: 'testing',     title: 'Testing',     accent: 'bg-coral-400',    progress: 85  },
  { key: 'deployment',  title: 'Deployment',  accent: 'bg-sage-500',     progress: 100 },
];

const emptyForm = { title: '', description: '', stage: 'idea', progress: 10 };

export default function Projects({ openTrigger = 0 }) {
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [form,       setForm]       = useState(emptyForm);
  const [breakdown,  setBreakdown]  = useState(null);  // { project, tasks }
  const [breaking,   setBreaking]   = useState(null);  // project id being broken down
  const [creating,   setCreating]   = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    try { setItems(await api.get('/projects')); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (openTrigger > 0) { setForm(emptyForm); setModalOpen(true); }
  }, [openTrigger]); // eslint-disable-line

  const createItem = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    try {
      await api.post('/projects', form);
      toast.success('Project added');
      setForm(emptyForm); setModalOpen(false); load();
    } catch (err) { toast.error(err.message); }
  };

  const setStage = async (item, stage) => {
    const s = STAGES.find((s) => s.key === stage);
    await api.put(`/projects/${item.id}`, { stage, progress: s.progress });
    load();
  };

  const removeItem = async (id) => {
    await api.del(`/projects/${id}`);
    toast.success('Removed'); load();
  };

  // ── AI: break project into tasks ─────────────────────────────
  const breakIntoTasks = async (project) => {
    setBreaking(project.id);
    try {
      const res = await api.post('/chat', {
        messages: [{
          role:    'user',
          content: `Break the project "${project.title}"${project.description ? ` (${project.description})` : ''} into 5-7 concrete, actionable development tasks. Return ONLY a JSON array of objects with keys: title (string), priority (high/medium/low). No explanation, just the JSON array.`,
        }],
      });
      let tasks = [];
      try {
        const clean = res.text.replace(/```json|```/g, '').trim();
        tasks = JSON.parse(clean);
      } catch (_) {
        // Try extracting JSON from response
        const match = res.text.match(/\[[\s\S]*\]/);
        if (match) tasks = JSON.parse(match[0]);
      }
      setBreakdown({ project, tasks });
    } catch (err) { toast.error('Could not generate tasks. Try again.'); }
    finally { setBreaking(null); }
  };

  // ── Create tasks from breakdown ───────────────────────────────
  const createTasksFromBreakdown = async () => {
    if (!breakdown?.tasks?.length) return;
    setCreating(true);
    try {
      await Promise.all(breakdown.tasks.map((t) =>
        api.post('/tasks', {
          title:    t.title,
          priority: t.priority || 'medium',
          category: breakdown.project.title,
          status:   'todo',
        })
      ));
      toast.success(`${breakdown.tasks.length} tasks added to your task list!`);
      setBreakdown(null);
    } catch (err) { toast.error(err.message); }
    finally { setCreating(false); }
  };

  if (loading) return <PageLoader />;

  return (
    <div>
      {items.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Add your first project and let AI break it into tasks automatically."
          features={[
            { icon: '🤖', text: 'AI breaks any project into 5-7 actionable tasks' },
            { icon: '📋', text: 'Tasks appear in your task list instantly' },
            { icon: '📈', text: 'Track progress through 5 stages to deployment' },
          ]}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item, i) => (
            <GlassCard key={item.id} delay={i * 0.04} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-display font-bold text-ink dark:text-white">{item.title}</h3>
                  {item.description && (
                    <p className="text-sm text-ink/50 dark:text-white/40 mt-1">{item.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* AI breakdown button */}
                  <button
                    onClick={() => breakIntoTasks(item)}
                    disabled={breaking === item.id}
                    className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                    style={{
                      background: 'linear-gradient(135deg, rgba(124,106,240,0.12), rgba(91,71,224,0.06))',
                      border:     '1px solid rgba(124,106,240,0.25)',
                      color:      '#7C6AF0',
                    }}
                  >
                    {breaking === item.id ? (
                      <>
                        <div className="h-3 w-3 rounded-full border-2 border-lavender-400 border-t-lavender-600 animate-spin" />
                        Breaking down…
                      </>
                    ) : (
                      <>
                        <Sparkles size={12} /> Break into tasks
                      </>
                    )}
                  </button>
                  <button onClick={() => removeItem(item.id)}
                    className="text-ink/25 hover:text-coral-500 transition">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4 h-2 rounded-full bg-ink/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-lavender-400 to-lavender-600 transition-all duration-500"
                  style={{ width: `${item.progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-ink/30 dark:text-white/25 capitalize">{item.stage}</span>
                <span className="text-[10px] text-ink/30 dark:text-white/25">{item.progress}%</span>
              </div>

              {/* Stage buttons */}
              <div className="flex flex-wrap gap-2 mt-3">
                {STAGES.map((s) => (
                  <button key={s.key} onClick={() => setStage(item, s.key)}
                    className={`flex items-center gap-1.5 rounded-2xl px-3 py-1.5 text-xs font-semibold transition ${
                      item.stage === s.key
                        ? 'bg-lavender-600 text-white shadow-glow'
                        : 'bg-white/60 dark:bg-white/[0.06] text-ink/50 dark:text-white/40 hover:bg-white dark:hover:bg-white/10'
                    }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${item.stage === s.key ? 'bg-white' : s.accent}`} />
                    {s.title}
                  </button>
                ))}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* ── AI Breakdown modal ──────────────────────────────── */}
      <Modal
        open={!!breakdown}
        onClose={() => setBreakdown(null)}
        title={`AI Tasks for "${breakdown?.project?.title}"`}
      >
        {breakdown && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink/50 dark:text-white/40">
              Lumi generated {breakdown.tasks.length} tasks. Review them and add all to your task list.
            </p>
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
              {breakdown.tasks.map((t, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{ background: 'rgba(124,106,240,0.06)', border: '1px solid rgba(124,106,240,0.12)' }}>
                  <CheckCircle2 size={14} className="text-lavender-400 shrink-0" />
                  <span className="text-sm text-ink dark:text-white flex-1">{t.title}</span>
                  <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 capitalize ${
                    t.priority === 'high'   ? 'bg-coral-400/15 text-coral-500' :
                    t.priority === 'medium' ? 'bg-sun-400/15 text-sun-600'     :
                                              'bg-ink/8 text-ink/45'
                  }`}>{t.priority}</span>
                </div>
              ))}
            </div>
            <button
              onClick={createTasksFromBreakdown}
              disabled={creating}
              className="btn-primary justify-center mt-1"
            >
              {creating ? 'Adding tasks…' : `Add ${breakdown.tasks.length} tasks to my list ✓`}
            </button>
          </div>
        )}
      </Modal>

      {/* ── Add project modal ───────────────────────────────── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New project">
        <form onSubmit={createItem} className="flex flex-col gap-3.5">
          <input className="input-field" placeholder="Project title" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus required />
          <textarea className="input-field" placeholder="Description (optional)" rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select className="input-field" value={form.stage}
            onChange={(e) => {
              const s = STAGES.find((s) => s.key === e.target.value);
              setForm({ ...form, stage: e.target.value, progress: s.progress });
            }}>
            {STAGES.map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}
          </select>
          <button type="submit" className="btn-primary justify-center mt-1">Add project</button>
        </form>
      </Modal>
    </div>
  );
}