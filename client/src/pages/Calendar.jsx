import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, X, Check } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Modal from '../components/Modal.jsx';

const DAYS    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const PRIORITY_COLORS = {
  high:   { bg:'rgba(255,122,99,0.15)', border:'rgba(255,122,99,0.35)', text:'#FF7A63' },
  medium: { bg:'rgba(255,184,77,0.15)', border:'rgba(255,184,77,0.35)', text:'#FFB84D' },
  low:    { bg:'rgba(124,106,240,0.12)', border:'rgba(124,106,240,0.25)', text:'#7C6AF0' },
};

const emptyForm = {
  title: '', priority: 'medium', category: 'General',
  deadline_time: '', description: '',
};

function toDateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

export default function Calendar() {
  const toast = useToast();
  const now   = new Date();

  const [year,       setYear]       = useState(now.getFullYear());
  const [month,      setMonth]      = useState(now.getMonth());
  const [tasks,      setTasks]      = useState([]);
  const [selected,   setSelected]   = useState(null); // clicked day
  const [modalOpen,  setModalOpen]  = useState(false);
  const [form,       setForm]       = useState(emptyForm);
  const [saving,     setSaving]     = useState(false);

  const todayStr = toDateStr(now.getFullYear(), now.getMonth(), now.getDate());

  const load = useCallback(async () => {
    try {
      const data = await api.get('/tasks');
      setTasks(data.filter(t => t.deadline));
    } catch (_) {}
  }, []);

  useEffect(() => { load(); }, [load]);

  // Build calendar grid
  const firstDay  = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev  = new Date(year, month, 0).getDate();

  const cells = [];
  // Previous month padding
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: daysInPrev - i, currentMonth: false, prev: true });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, currentMonth: true });
  }
  // Next month padding
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, currentMonth: false, next: true });
  }

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const getTasksForDay = (cell) => {
    if (!cell.currentMonth) return [];
    const dateStr = toDateStr(year, month, cell.day);
    return tasks.filter(t => t.deadline === dateStr);
  };

  const openAddModal = (dateStr) => {
    setSelected(dateStr);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const submitForm = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await api.post('/tasks', {
        ...form,
        deadline:      selected,
        deadline_time: form.deadline_time || null,
        recurrence:    null,
      });
      toast.success('Task added to calendar!');
      setModalOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const markDone = async (task, e) => {
    e.stopPropagation();
    try {
      await api.put(`/tasks/${task.id}`, { status:'done', progress:100 });
      load();
    } catch (_) {}
  };

  // Selected day tasks panel
  const selectedTasks = selected
    ? tasks.filter(t => t.deadline === selected && t.status !== 'done')
    : [];
  const selectedDoneTasks = selected
    ? tasks.filter(t => t.deadline === selected && t.status === 'done')
    : [];

  const [year2, month2, day2] = (selected || '').split('-').map(Number);
  const selectedLabel = selected
    ? new Date(year2, month2 - 1, day2).toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })
    : '';

  return (
    <div>
      <PageHeader
        eyebrow="Calendar"
        title="Your schedule"
        subtitle="Tasks and deadlines at a glance. Click any day to add or view."
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── Calendar grid ─────────────────────────────────── */}
        <div className="xl:col-span-2">
          <div
            className="rounded-3xl overflow-hidden"
            style={{
              background:           'rgba(255,255,255,0.60)',
              border:               '1px solid rgba(255,255,255,0.70)',
              backdropFilter:       'blur(32px)',
              WebkitBackdropFilter: 'blur(32px)',
              boxShadow:            '0 8px 32px rgba(0,0,0,0.08)',
            }}
          >
            {/* Month header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-ink/5 dark:border-white/8">
              <motion.button
                whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }}
                onClick={prevMonth}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-ink/50 dark:text-white/40 hover:bg-ink/5 dark:hover:bg-white/10 transition"
              >
                <ChevronLeft size={18} />
              </motion.button>

              <div className="text-center">
                <h2 className="font-display font-bold text-ink dark:text-white text-lg">
                  {MONTHS[month]}
                </h2>
                <p className="text-xs text-ink/40 dark:text-white/30">{year}</p>
              </div>

              <motion.button
                whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }}
                onClick={nextMonth}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-ink/50 dark:text-white/40 hover:bg-ink/5 dark:hover:bg-white/10 transition"
              >
                <ChevronRight size={18} />
              </motion.button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-ink/5 dark:border-white/8">
              {DAYS.map(d => (
                <div key={d} className="py-3 text-center text-[11px] font-bold uppercase tracking-widest text-ink/35 dark:text-white/30">
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {cells.map((cell, idx) => {
                const dateStr    = cell.currentMonth ? toDateStr(year, month, cell.day) : null;
                const cellTasks  = getTasksForDay(cell);
                const isToday    = dateStr === todayStr;
                const isSelected = dateStr === selected;
                const isWeekend  = idx % 7 === 0 || idx % 7 === 6;

                return (
                  <motion.div
                    key={idx}
                    whileHover={cell.currentMonth ? { scale: 0.98 } : {}}
                    onClick={() => cell.currentMonth && (isSelected ? setSelected(null) : setSelected(dateStr))}
                    className={`relative min-h-[80px] p-2 border-b border-r border-ink/[0.04] dark:border-white/[0.04] transition-all
                      ${cell.currentMonth ? 'cursor-pointer' : 'opacity-30'}
                      ${isSelected ? 'bg-lavender-500/10 dark:bg-lavender-500/15' : ''}
                      ${isWeekend && cell.currentMonth ? 'bg-ink/[0.015] dark:bg-white/[0.015]' : ''}
                    `}
                    style={isSelected ? { background: 'rgba(124,106,240,0.10)' } : {}}
                  >
                    {/* Day number */}
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all
                          ${isToday
                            ? 'bg-gradient-to-br from-aurora-violet to-aurora-indigo text-white shadow-md'
                            : isSelected
                            ? 'text-lavender-600 dark:text-lavender-300'
                            : 'text-ink/60 dark:text-white/50'
                          }`}
                      >
                        {cell.day}
                      </span>
                      {cell.currentMonth && (
                        <button
                          onClick={(e) => { e.stopPropagation(); openAddModal(dateStr); }}
                          className="opacity-0 hover:opacity-100 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded-lg text-lavender-500 hover:bg-lavender-100 dark:hover:bg-lavender-500/20 transition"
                        >
                          <Plus size={11} />
                        </button>
                      )}
                    </div>

                    {/* Task pills */}
                    <div className="flex flex-col gap-0.5">
                      {cellTasks.slice(0, 3).map(task => {
                        const colors = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.low;
                        return (
                          <div
                            key={task.id}
                            className="truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-tight"
                            style={{ background: colors.bg, color: colors.text }}
                          >
                            {task.title}
                          </div>
                        );
                      })}
                      {cellTasks.length > 3 && (
                        <div className="text-[9px] text-ink/35 dark:text-white/25 px-1">
                          +{cellTasks.length - 3} more
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 px-1">
            {Object.entries(PRIORITY_COLORS).map(([key, colors]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-sm" style={{ background: colors.bg, border: `1px solid ${colors.border}` }} />
                <span className="text-[11px] text-ink/40 dark:text-white/30 capitalize">{key} priority</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Day detail panel ───────────────────────────────── */}
        <div className="xl:col-span-1">
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key={selected}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="rounded-3xl p-5 sticky top-6"
                style={{
                  background:           'rgba(255,255,255,0.60)',
                  border:               '1px solid rgba(255,255,255,0.70)',
                  backdropFilter:       'blur(32px)',
                  WebkitBackdropFilter: 'blur(32px)',
                  boxShadow:            '0 8px 32px rgba(0,0,0,0.08)',
                }}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-display font-bold text-ink dark:text-white">{selectedLabel}</p>
                    <p className="text-xs text-ink/40 dark:text-white/30 mt-0.5">
                      {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''}
                      {selectedDoneTasks.length > 0 ? ` · ${selectedDoneTasks.length} done` : ''}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <motion.button
                      whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                      onClick={() => openAddModal(selected)}
                      className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-lavender-600 dark:text-lavender-300"
                      style={{ background:'rgba(124,106,240,0.10)', border:'1px solid rgba(124,106,240,0.20)' }}
                    >
                      <Plus size={12} /> Add
                    </motion.button>
                    <button onClick={() => setSelected(null)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl text-ink/30 dark:text-white/30 hover:text-ink/60 transition">
                      <X size={14} />
                    </button>
                  </div>
                </div>

                {/* Tasks */}
                {selectedTasks.length === 0 && selectedDoneTasks.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-center">
                    <span className="text-3xl mb-2">📅</span>
                    <p className="text-sm font-medium text-ink/50 dark:text-white/40">Nothing scheduled</p>
                    <p className="text-xs text-ink/30 dark:text-white/25 mt-1">Click + Add to create a task for this day</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {selectedTasks.map(task => {
                      const colors = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.low;
                      return (
                        <div key={task.id}
                          className="flex items-center gap-3 rounded-2xl px-3.5 py-3"
                          style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
                        >
                          <button
                            onClick={(e) => markDone(task, e)}
                            className="shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition hover:bg-white/50"
                            style={{ borderColor: colors.text }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: colors.text }}>
                              {task.title}
                            </p>
                            {task.deadline_time && (
                              <p className="text-[10px] opacity-60 mt-0.5" style={{ color: colors.text }}>
                                {task.deadline_time}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {selectedDoneTasks.length > 0 && (
                      <>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-ink/25 dark:text-white/20 mt-2 mb-1">Done</p>
                        {selectedDoneTasks.map(task => (
                          <div key={task.id}
                            className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 opacity-50"
                            style={{ background:'rgba(76,195,138,0.08)', border:'1px solid rgba(76,195,138,0.15)' }}
                          >
                            <Check size={14} className="text-sage-500 shrink-0" />
                            <p className="text-xs text-ink/50 dark:text-white/40 line-through truncate">{task.title}</p>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-3xl p-6 flex flex-col items-center justify-center text-center sticky top-6"
                style={{
                  background:     'rgba(255,255,255,0.40)',
                  border:         '1px dashed rgba(124,106,240,0.20)',
                  backdropFilter: 'blur(12px)',
                  minHeight:      200,
                }}
              >
                <span className="text-4xl mb-3">📅</span>
                <p className="font-semibold text-ink/50 dark:text-white/40 text-sm">Click any day</p>
                <p className="text-xs text-ink/30 dark:text-white/25 mt-1">to view or add tasks</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Add task modal ─────────────────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selected ? `Add task · ${selectedLabel}` : 'Add task'}
      >
        <form onSubmit={submitForm} className="flex flex-col gap-3.5">
          <input className="input-field" placeholder="Task title"
            value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            autoFocus required />

          <textarea className="input-field resize-none" placeholder="Description (optional)" rows={2}
            value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

          <div className="grid grid-cols-2 gap-3">
            <select className="input-field" value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="high">High priority</option>
              <option value="medium">Medium priority</option>
              <option value="low">Low priority</option>
            </select>
            <input className="input-field" placeholder="Category"
              value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>

          <div className="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium text-ink/60 dark:text-white/50"
            style={{ background:'rgba(124,106,240,0.08)', border:'1px solid rgba(124,106,240,0.15)' }}>
            📅 {selectedLabel}
          </div>

          <input type="time" className="input-field" placeholder="Time (optional)"
            value={form.deadline_time} onChange={(e) => setForm({ ...form, deadline_time: e.target.value })} />

          <button type="submit" disabled={saving} className="btn-primary justify-center mt-1">
            {saving ? 'Adding…' : 'Add to calendar'}
          </button>
        </form>
      </Modal>
    </div>
  );
}