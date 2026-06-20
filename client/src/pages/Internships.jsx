import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Briefcase, Link as LinkIcon } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import GlassCard from '../components/GlassCard.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import PageLoader from '../components/Loader.jsx';

const COLUMNS = [
  { key: 'applied', title: 'Applied', accent: 'bg-lavender-400' },
  { key: 'interview', title: 'Interview', accent: 'bg-sun-500' },
  { key: 'accepted', title: 'Accepted', accent: 'bg-sage-500' },
  { key: 'rejected', title: 'Rejected', accent: 'bg-coral-500' },
];

const emptyForm = { company: '', role: '', status: 'applied', applied_date: '', notes: '', link: '' };

export default function Internships() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const toast = useToast();

  const load = useCallback(async () => {
    try { setItems(await api.get('/internships')); } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const createItem = async (e) => {
    e.preventDefault();
    if (!form.company.trim() || !form.role.trim()) return;
    try {
      await api.post('/internships', { ...form, applied_date: form.applied_date || null });
      toast.success('Application added');
      setForm(emptyForm);
      setModalOpen(false);
      load();
    } catch (err) { toast.error(err.message); }
  };

  const setStatus = async (item, status) => { await api.put(`/internships/${item.id}`, { status }); load(); };
  const removeItem = async (id) => { await api.del(`/internships/${id}`); toast.success('Removed'); load(); };

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        eyebrow="Internship Tracker"
        title="Land the role"
        subtitle="Track every application from first click to offer."
        action={<button className="btn-primary" onClick={() => setModalOpen(true)}><Plus size={16}/> Add application</button>}
      />

      {items.length === 0 ? (
        <EmptyState icon={Briefcase} title="No applications yet" message="Add the first internship you're applying to." action={<button className="btn-primary mt-2" onClick={() => setModalOpen(true)}><Plus size={16}/> Add application</button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {COLUMNS.map((col) => (
            <div key={col.key} className="glass-panel rounded-3xl p-4 min-h-[200px]">
              <div className="flex items-center gap-2 px-1 mb-3">
                <span className={`h-2 w-2 rounded-full ${col.accent}`} />
                <h3 className="font-display font-semibold text-sm text-ink">{col.title}</h3>
                <span className="ml-auto text-xs text-ink/40 bg-white/60 rounded-full px-2 py-0.5">
                  {items.filter((i) => i.status === col.key).length}
                </span>
              </div>
              <div className="flex flex-col gap-2.5">
                {items.filter((i) => i.status === col.key).map((item, idx) => (
                  <GlassCard key={item.id} delay={idx * 0.03} className="p-3.5 bg-white/70">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink truncate">{item.company}</p>
                        <p className="text-xs text-ink/50 truncate">{item.role}</p>
                      </div>
                      <button onClick={() => removeItem(item.id)} className="text-ink/25 hover:text-coral-500 transition shrink-0"><Trash2 size={13} /></button>
                    </div>
                    {item.applied_date && <p className="text-[11px] text-ink/40 mt-1.5">Applied {item.applied_date}</p>}
                    {item.notes && <p className="text-xs text-ink/45 mt-1.5">{item.notes}</p>}
                    {item.link && <a href={item.link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] text-lavender-600 hover:underline mt-1.5"><LinkIcon size={10}/> Listing</a>}
                    <select
                      value={item.status}
                      onChange={(e) => setStatus(item, e.target.value)}
                      className="mt-2.5 w-full rounded-xl border border-white/70 bg-white/60 px-2 py-1.5 text-xs"
                    >
                      {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.title}</option>)}
                    </select>
                  </GlassCard>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add application">
        <form onSubmit={createItem} className="flex flex-col gap-3.5">
          <input className="input-field" placeholder="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} autoFocus required />
          <input className="input-field" placeholder="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} required />
          <div className="grid grid-cols-2 gap-3">
            <select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.title}</option>)}
            </select>
            <input type="date" className="input-field" value={form.applied_date} onChange={(e) => setForm({ ...form, applied_date: e.target.value })} />
          </div>
          <input className="input-field" placeholder="Listing link (optional)" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
          <textarea className="input-field" placeholder="Notes (optional)" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <button type="submit" className="btn-primary justify-center mt-1">Add application</button>
        </form>
      </Modal>
    </div>
  );
}