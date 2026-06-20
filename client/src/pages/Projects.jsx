import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, FolderKanban } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import GlassCard from '../components/GlassCard.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import PageLoader from '../components/Loader.jsx';

const STAGES = [
  { key: 'idea', title: 'Idea', accent: 'bg-ink/20', progress: 10 },
  { key: 'design', title: 'Design', accent: 'bg-lavender-400', progress: 30 },
  { key: 'development', title: 'Development', accent: 'bg-sun-500', progress: 60 },
  { key: 'testing', title: 'Testing', accent: 'bg-coral-400', progress: 85 },
  { key: 'deployment', title: 'Deployment', accent: 'bg-sage-500', progress: 100 },
];

const emptyForm = { title: '', description: '', stage: 'idea', progress: 10 };

export default function Projects() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const toast = useToast();

  const load = useCallback(async () => {
    try { setItems(await api.get('/projects')); } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const createItem = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    try {
      await api.post('/projects', form);
      toast.success('Project added');
      setForm(emptyForm);
      setModalOpen(false);
      load();
    } catch (err) { toast.error(err.message); }
  };

  const setStage = async (item, stage) => {
    const stageInfo = STAGES.find((s) => s.key === stage);
    await api.put(`/projects/${item.id}`, { stage, progress: stageInfo.progress });
    load();
  };

  const removeItem = async (id) => { await api.del(`/projects/${id}`); toast.success('Removed'); load(); };

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        eyebrow="Project Tracker"
        title="From idea to deployed"
        subtitle="Track every side project through its full lifecycle."
        action={<button className="btn-primary" onClick={() => setModalOpen(true)}><Plus size={16}/> New project</button>}
      />

      {items.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects yet" message="Add the first project you're building." action={<button className="btn-primary mt-2" onClick={() => setModalOpen(true)}><Plus size={16}/> New project</button>} />
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item, i) => (
            <GlassCard key={item.id} delay={i * 0.04} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display font-bold text-ink">{item.title}</h3>
                  {item.description && <p className="text-sm text-ink/50 mt-1">{item.description}</p>}
                </div>
                <button onClick={() => removeItem(item.id)} className="text-ink/25 hover:text-coral-500 transition shrink-0"><Trash2 size={15} /></button>
              </div>

              <div className="mt-4 h-2 rounded-full bg-ink/5 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-lavender-400 to-lavender-600 transition-all duration-500" style={{ width: `${item.progress}%` }} />
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                {STAGES.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setStage(item, s.key)}
                    className={`flex items-center gap-1.5 rounded-2xl px-3 py-1.5 text-xs font-semibold transition ${
                      item.stage === s.key ? 'bg-lavender-600 text-white shadow-glow' : 'bg-white/60 text-ink/50 hover:bg-white'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${item.stage === s.key ? 'bg-white' : s.accent}`} />
                    {s.title}
                  </button>
                ))}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New project">
        <form onSubmit={createItem} className="flex flex-col gap-3.5">
          <input className="input-field" placeholder="Project title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus required />
          <textarea className="input-field" placeholder="Description (optional)" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select
            className="input-field"
            value={form.stage}
            onChange={(e) => {
              const stageInfo = STAGES.find((s) => s.key === e.target.value);
              setForm({ ...form, stage: e.target.value, progress: stageInfo.progress });
            }}
          >
            {STAGES.map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}
          </select>
          <button type="submit" className="btn-primary justify-center mt-1">Add project</button>
        </form>
      </Modal>
    </div>
  );
}