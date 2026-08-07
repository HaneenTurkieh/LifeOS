import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, FolderKanban, Sparkles, CheckCircle2, CheckSquare, Square, Pencil, ChevronDown } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import GlassCard    from '../components/GlassCard.jsx';
import Modal        from '../components/Modal.jsx';
import EmptyState   from '../components/EmptyState.jsx';
import PageLoader   from '../components/Loader.jsx';
import PriorityPill from '../components/PriorityPill.jsx';

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
  const [contextFor, setContextFor] = useState(null);   // project waiting on the "tell Lumi more" step
  const [extraNote,  setExtraNote]  = useState('');
  // Tasks generated for a project (or added to it any other way) only
  // ever showed up on the separate Tasks page, disconnected from the
  // project itself. Loading the full task list here and grouping it by
  // category (== project title) lets each project card show — and
  // check off — its own tasks in place, same tick-to-complete pattern
  // as Goals' milestones.
  const [allTasks,   setAllTasks]   = useState([]);
  // Task lists get long once a project has several stages worth of AI
  // breakdowns, and doubly so with multiple project cards on the page —
  // let each card's task list be collapsed independently.
  const [collapsedProjects, setCollapsedProjects] = useState(() => new Set());
  const [editingProjectTask, setEditingProjectTask] = useState(null); // task being edited
  const [taskEditForm, setTaskEditForm] = useState({ title: '', description: '', priority: 'medium' });
  const toast = useToast();

  const load = useCallback(async () => {
    try { setItems(await api.get('/projects')); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []); // eslint-disable-line

  const loadTasks = useCallback(async () => {
    try { setAllTasks(await api.get('/tasks')); }
    catch (_) {}
  }, []);

  useEffect(() => { load(); loadTasks(); }, [load, loadTasks]);

  useEffect(() => {
    if (openTrigger > 0) { setForm(emptyForm); setModalOpen(true); }
  }, [openTrigger]); // eslint-disable-line

  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
  const tasksFor = (project) => allTasks
    .filter((t) => t.category === project.title)
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1));

  const toggleProjectTask = async (task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    // Optimistic update — the checkbox should flip immediately, not
    // after a round trip.
    setAllTasks((list) => list.map((t) => t.id === task.id ? { ...t, status: newStatus } : t));
    try {
      await api.put(`/tasks/${task.id}`, { status: newStatus });
    } catch (err) {
      toast.error(err.message);
      loadTasks(); // revert to server truth if the update failed
    }
  };

  const toggleTasksCollapsed = (projectId) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      next.has(projectId) ? next.delete(projectId) : next.add(projectId);
      return next;
    });
  };

  const openEditProjectTask = (task) => {
    setEditingProjectTask(task);
    setTaskEditForm({
      title: task.title || '',
      description: task.description || '',
      priority: (task.priority || 'medium').toLowerCase(),
    });
  };

  const saveProjectTaskEdit = async (e) => {
    e.preventDefault();
    if (!taskEditForm.title.trim()) return;
    try {
      await api.put(`/tasks/${editingProjectTask.id}`, taskEditForm);
      setAllTasks((list) => list.map((t) =>
        t.id === editingProjectTask.id ? { ...t, ...taskEditForm } : t
      ));
      toast.success('Task updated');
      setEditingProjectTask(null);
    } catch (err) { toast.error(err.message); }
  };

  const deleteProjectTask = async (task) => {
    setAllTasks((list) => list.filter((t) => t.id !== task.id)); // optimistic
    try {
      await api.del(`/tasks/${task.id}`);
      toast.success('Task deleted');
    } catch (err) {
      toast.error(err.message);
      loadTasks(); // revert if it failed server-side
    }
  };

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
  // Stage + existing-task titles ground the AI in roughly where a
  // project stands, but a 5-stage label is still a coarse guess — it
  // can't know what's actually built, what's broken, or what you
  // specifically want out of this round. Rather than trying to make it
  // interrogate you turn-by-turn (which would need a real chat thread,
  // not this one-shot generator), extraNote is an optional freeform box
  // you fill in first — "auth is done, focus on the payments flow" —
  // so you can hand it whatever specific context actually matters
  // instead of it guessing from a stage name alone.
  const breakIntoTasks = async (project, extraNote = '') => {
    setBreaking(project.id);
    try {
      const stageLabel = STAGES.find((s) => s.key === project.stage)?.title || project.stage;
      let existingTitles = [];
      try {
        const allTasks = await api.get('/tasks');
        existingTitles = (allTasks || [])
          .filter((t) => t.category === project.title)
          .map((t) => `${t.title}${t.status === 'done' ? ' (done)' : ''}`);
      } catch (_) {}

      const res = await api.post('/chat', {
        messages: [{
          role:    'user',
          content: `Break the project "${project.title}"${project.description ? ` (${project.description})` : ''} into 5-7 concrete, actionable tasks.

Current stage: ${stageLabel} (${project.progress}% complete).
${existingTitles.length ? `Tasks already planned or done for this project — do NOT repeat any of these, only suggest new next steps:\n${existingTitles.map((t) => `- ${t}`).join('\n')}` : "No tasks exist for this project yet."}
${extraNote.trim() ? `\nAdditional context from the person building it — treat this as the most reliable signal of what's actually needed:\n${extraNote.trim()}` : ''}

The tasks must fit where the project actually is right now. Idea/Design stage: focus on planning, scoping, and design tasks — not building. Development stage: focus on building the remaining pieces. Testing stage: focus on QA, bug-fixing, and polish. Deployment stage: focus on launch, release, and ops tasks. Do not suggest core build-from-scratch work for a project that's already past that stage.

Return ONLY a JSON array of objects with keys: title (string), priority (high/medium/low). No explanation, just the JSON array.`,
        }],
        no_history: true, // internal tool call, not a real Lumi conversation — keep it out of the chat history
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
      toast.success(`${breakdown.tasks.length} tasks added — you'll see them right on this project's card.`);
      setBreakdown(null);
      loadTasks();
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
                    onClick={() => { setExtraNote(''); setContextFor(item); }}
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

              {/* Stage buttons — click any to move this project along the pipeline */}
              <p className="text-[10px] font-bold uppercase tracking-widest text-ink/25 dark:text-white/20 mt-4 mb-1.5">
                Move to stage
              </p>
              <div className="flex flex-wrap gap-2">
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

              {/* Tasks tied to this project — tick them off right here,
                  same pattern as Goals' milestones, instead of having
                  to jump to the separate Tasks page to find them. */}
              {tasksFor(item).length > 0 && (
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(30,34,51,0.06)' }}>
                  <button
                    onClick={() => toggleTasksCollapsed(item.id)}
                    className="flex items-center justify-between w-full mb-1.5 group"
                  >
                    <span className="flex items-center gap-1.5">
                      <ChevronDown
                        size={12}
                        className={`text-ink/30 dark:text-white/25 transition-transform duration-300 ease-in-out ${
                          collapsedProjects.has(item.id) ? '-rotate-90' : ''
                        }`}
                      />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-ink/25 dark:text-white/20 group-hover:text-ink/40">
                        Tasks
                      </span>
                    </span>
                    <span className="text-[10px] text-ink/30 dark:text-white/25">
                      {tasksFor(item).filter((t) => t.status === 'done').length}/{tasksFor(item).length} done
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {!collapsedProjects.has(item.id) && (
                      <motion.div
                        key="tasks"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div className="flex flex-col gap-1 pt-0.5">
                          {tasksFor(item).map((t) => (
                            <div key={t.id}
                              className="flex items-center gap-1.5 rounded-xl px-2 py-1.5 hover:bg-ink/[0.03] dark:hover:bg-white/[0.04] transition group">
                              <button onClick={() => toggleProjectTask(t)}
                                className="flex items-center gap-2.5 text-start flex-1 min-w-0">
                                {t.status === 'done'
                                  ? <CheckSquare size={16} className="text-sage-500 shrink-0" />
                                  : <Square size={16} className="text-ink/25 dark:text-white/20 shrink-0" />}
                                <span className={`flex-1 min-w-0 truncate text-sm ${
                                  t.status === 'done'
                                    ? 'text-ink/35 dark:text-white/30 line-through'
                                    : 'text-ink/75 dark:text-white/65'
                                }`}>
                                  {t.title}
                                </span>
                              </button>
                              <PriorityPill priority={t.priority} />
                              <button onClick={() => openEditProjectTask(t)}
                                className="shrink-0 opacity-0 group-hover:opacity-100 transition text-ink/25 hover:text-lavender-600 dark:text-white/25 dark:hover:text-lavender-400 p-1">
                                <Pencil size={12} />
                              </button>
                              <button onClick={() => deleteProjectTask(t)}
                                className="shrink-0 opacity-0 group-hover:opacity-100 transition text-ink/25 hover:text-coral-500 dark:text-white/25 dark:hover:text-coral-400 p-1">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}

      {/* ── Optional context before generating ──────────────── */}
      <Modal
        open={!!contextFor}
        onClose={() => setContextFor(null)}
        title={`Anything Lumi should know about "${contextFor?.title}"?`}
      >
        {contextFor && (
          <div className="flex flex-col gap-3.5">
            <p className="text-sm text-ink/50 dark:text-white/40">
              Stage and existing tasks are used automatically. This is optional — add anything specific that matters right now, e.g. "auth and the dashboard are done, focus on the payments flow" or "this is a school report, not code."
            </p>
            <textarea
              className="input-field"
              rows={3}
              placeholder="Optional context (leave blank to skip)"
              value={extraNote}
              onChange={(e) => setExtraNote(e.target.value)}
              autoFocus
            />
            <button
              className="btn-primary justify-center mt-1"
              onClick={() => { const p = contextFor; setContextFor(null); breakIntoTasks(p, extraNote); }}
            >
              <Sparkles size={14} /> Generate tasks
            </button>
          </div>
        )}
      </Modal>

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

      {/* ── Edit project task modal ─────────────────────────── */}
      <Modal
        open={!!editingProjectTask}
        onClose={() => setEditingProjectTask(null)}
        title="Edit task"
      >
        {editingProjectTask && (
          <form onSubmit={saveProjectTaskEdit} className="flex flex-col gap-3.5">
            <input className="input-field" placeholder="Task title" value={taskEditForm.title}
              onChange={(e) => setTaskEditForm({ ...taskEditForm, title: e.target.value })} autoFocus required />
            <textarea className="input-field" placeholder="Description (optional)" rows={2}
              value={taskEditForm.description}
              onChange={(e) => setTaskEditForm({ ...taskEditForm, description: e.target.value })} />
            <select className="input-field" value={taskEditForm.priority}
              onChange={(e) => setTaskEditForm({ ...taskEditForm, priority: e.target.value })}>
              <option value="high">High priority</option>
              <option value="medium">Medium priority</option>
              <option value="low">Low priority</option>
            </select>
            <button type="submit" className="btn-primary justify-center mt-1">Save changes</button>
          </form>
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
          <div>
            <label className="block text-xs font-semibold text-ink/50 dark:text-white/40 mb-1.5">
              Where is this project right now?
            </label>
            <select className="input-field" value={form.stage}
              onChange={(e) => {
                const s = STAGES.find((s) => s.key === e.target.value);
                setForm({ ...form, stage: e.target.value, progress: s.progress });
              }}>
              {STAGES.map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}
            </select>
            <p className="text-xs text-ink/35 dark:text-white/30 mt-1.5">
              Just its starting point — you can move it through the pipeline anytime from its card.
            </p>
          </div>
          <button type="submit" className="btn-primary justify-center mt-1">Add project</button>
        </form>
      </Modal>
    </div>
  );
}