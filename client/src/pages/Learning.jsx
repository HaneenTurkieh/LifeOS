import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, BookOpen, GraduationCap, Award } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import GlassCard from '../components/GlassCard.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import PageLoader from '../components/Loader.jsx';

const TYPES = [
  { key: 'course', label: 'Courses', icon: GraduationCap },
  { key: 'book', label: 'Books', icon: BookOpen },
  { key: 'certification', label: 'Certifications', icon: Award },
];

const STATUS_STYLES = {
  planned: 'bg-ink/5 text-ink/50',
  in_progress: 'bg-sun-500/15 text-sun-600',
  completed: 'bg-sage-500/15 text-sage-600',
};

const emptyForm = { type: 'course', title: '', provider: '', status: 'planned', progress: 0, notes: '' };

export default function Learning() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const toast = useToast();

  const load = useCallback(async () => {
    try { setItems(await api.get('/learning')); } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const createItem = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    try {
      await api.post('/learning', form);
      toast.success('Added to your learning list');
      setForm(emptyForm);
      setModalOpen(false);
      load();
    } catch (err) { toast.error(err.message); }
  };

  const updateProgress = async (item, progress) => {
    const status = progress >= 100 ? 'completed' : progress > 0 ? 'in_progress' : 'planned';
    await api.put(`/learning/${item.id}`, { progress, status });
    load();
  };

  const removeItem = async (id) => { await api.del(`/learning/${id}`); toast.success('Removed'); load(); };

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        eyebrow="Learning Tracker"
        title="Keep growing"
        subtitle="Courses, books and certifications — all in one place."
        action={<button className="btn-primary" onClick={() => setModalOpen(true)}><Plus size={16}/> Add item</button>}
      />

      {items.length === 0 ? (
        <EmptyState icon={BookOpen} title="Nothing tracked yet" message="Add a course, book, or certification you're working on." action={<button className="btn-primary mt-2" onClick={() => setModalOpen(true)}><Plus size={16}/> Add item</button>} />
      ) : (
        <div className="flex flex-col gap-8">
          {TYPES.map(({ key, label, icon: Icon }) => {
            const group = items.filter((it) => it.type === key);
            if (group.length === 0) return null;
            return (
              <div key={key}>
                <h2 className="font-display font-bold text-ink flex items-center gap-2 mb-3"><Icon size={18} className="text-lavender-600" /> {label}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {group.map((item, i) => (
                    <GlassCard key={item.id} delay={i * 0.04} className="p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-ink text-sm leading-snug truncate">{item.title}</h3>
                          {item.provider && <p className="text-xs text-ink/45 mt-0.5">{item.provider}</p>}
                        </div>
                        <button onClick={() => removeItem(item.id)} className="text-ink/25 hover:text-coral-500 transition shrink-0"><Trash2 size={14} /></button>
                      </div>
                      <span className={`pill mt-3 ${STATUS_STYLES[item.status]} capitalize`}>{item.status.replace('_', ' ')}</span>
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-ink/45 mb-1">
                          <span>Progress</span><span>{item.progress}%</span>
                        </div>
                        <input
                          type="range" min="0" max="100" value={item.progress}
                          onChange={(e) => updateProgress(item, Number(e.target.value))}
                          className="w-full accent-lavender-600"
                        />
                      </div>
                      {item.notes && <p className="text-xs text-ink/40 mt-2">{item.notes}</p>}
                    </GlassCard>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add learning item">
        <form onSubmit={createItem} className="flex flex-col gap-3.5">
          <select className="input-field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="course">Course</option>
            <option value="book">Book</option>
            <option value="certification">Certification</option>
          </select>
          <input className="input-field" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus required />
          <input className="input-field" placeholder="Provider / author (optional)" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} />
          <textarea className="input-field" placeholder="Notes (optional)" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <button type="submit" className="btn-primary justify-center mt-1">Add</button>
        </form>
      </Modal>
    </div>
  );
}