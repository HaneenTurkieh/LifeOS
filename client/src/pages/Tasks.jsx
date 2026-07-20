import React, { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Trash2, Pencil, Calendar, Clock, ListChecks, Circle, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import PriorityPill from '../components/PriorityPill.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import PageLoader from '../components/Loader.jsx';

// high → medium → low
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getOffsetDateStr(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatTime(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const [y, mo, d] = dateStr.split('-');
  return `${d}/${mo}/${y}`;
}

// Sort high → medium → low, then by time ascending within same priority
function sortByPriority(tasks) {
  return [...tasks].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 1;
    const pb = PRIORITY_ORDER[b.priority] ?? 1;
    if (pa !== pb) return pa - pb;
    if (a.deadline_time && b.deadline_time) return a.deadline_time.localeCompare(b.deadline_time);
    if (a.deadline_time) return -1;
    if (b.deadline_time) return 1;
    return 0;
  });
}

const emptyForm = {
  title: '', description: '', priority: 'medium',
  category: 'General', deadline: '', deadline_time: '',
};

export default function Tasks() {
  const [tasks, setTasks]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modalOpen, setModalOpen]   = useState(false);
  const [form, setForm]             = useState(emptyForm);
  const [editingTask, setEditingTask] = useState(null);
  const [completedOpen, setCompletedOpen] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const data = await api.get('/tasks');
      setTasks(data.map((t) => ({ ...t, priority: (t.priority || 'medium').toLowerCase() })));
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const today    = getTodayStr();
  const tomorrow = getOffsetDateStr(1);
  const in7Days  = getOffsetDateStr(7);

  const active    = tasks.filter((t) => t.status !== 'done');
  const completed = tasks.filter((t) => t.status === 'done');

  // Date groups — tasks with no deadline go into Today
  const groups = {
    today:    sortByPriority(active.filter((t) => !t.deadline || t.deadline === today)),
    tomorrow: sortByPriority(active.filter((t) => t.deadline === tomorrow)),
    week:     sortByPriority(active.filter((t) => t.deadline && t.deadline > tomorrow && t.deadline <= in7Days)),
    later:    sortByPriority(active.filter((t) => t.deadline && t.deadline > in7Days)),
  };

  const markDone = async (task) => {
    // Optimistic
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: 'done', progress: 100 } : t));
    try {
      const { xpAwarded, unlocked } = await api.put(`/tasks/${task.id}`, { status: 'done', progress: 100 });
      if (xpAwarded) toast.xp(xpAwarded, task.title);
      unlocked?.forEach((k) => toast.achievement(k.replace(/_/g, ' ')));
    } catch (err) {
      toast.error(err.message);
      load(); // revert on failure
    }
  };

  const markUndone = async (task) => {
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: 'todo', progress: 0 } : t));
    try {
      await api.put(`/tasks/${task.id}`, { status: 'todo', progress: 0 });
    } catch (err) {
      toast.error(err.message);
      load();
    }
  };

  const openCreateModal = () => { setEditingTask(null); setForm(emptyForm); setModalOpen(true); };

  const openEditModal = (task) => {
    setEditingTask(task);
    setForm({
      title:         task.title,
      description:   task.description || '',
      priority:      (task.priority || 'medium').toLowerCase(),
      category:      task.category,
      deadline:      task.deadline || '',
      deadline_time: task.deadline_time || '',
    });
    setModalOpen(true);
  };

  const submitForm = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    try {
      if (editingTask) {
        await api.put(`/tasks/${editingTask.id}`, { ...form, deadline: form.deadline || null });
        toast.success('Task updated');
      } else {
        await api.post('/tasks', { ...form, deadline: form.deadline || null });
        toast.success('Task added');
      }
      setForm(emptyForm);
      setEditingTask(null);
      setModalOpen(false);
      load();
    } catch (err) { toast.error(err.message); }
  };

  const removeTask = async (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await api.del(`/tasks/${id}`);
      toast.success('Task deleted');
    } catch (err) { toast.error(err.message); load(); }
  };

  if (loading) return <PageLoader />;

  const isEmpty = active.length === 0 && completed.length === 0;

  return (
    <div>
      <PageHeader
        eyebrow="Task Manager"
        title="Your tasks"
        subtitle="Sorted by priority — high first, then time."
        action={<button className="btn-primary" onClick={openCreateModal}><Plus size={16} /> New task</button>}
      />

      {isEmpty ? (
        <EmptyState
          icon={ListChecks}
          title="No tasks yet"
          message="Add your first task to get started."
          action={<button className="btn-primary mt-2" onClick={openCreateModal}><Plus size={16} /> New task</button>}
        />
      ) : (
        <div className="flex flex-col gap-8">

          <TaskGroup
            label="Today"
            tasks={groups.today}
            onEdit={openEditModal}
            onDelete={removeTask}
            onMarkDone={markDone}
          />
          <TaskGroup
            label="Tomorrow"
            tasks={groups.tomorrow}
            onEdit={openEditModal}
            onDelete={removeTask}
            onMarkDone={markDone}
          />
          <TaskGroup
            label="Next 7 Days"
            tasks={groups.week}
            onEdit={openEditModal}
            onDelete={removeTask}
            onMarkDone={markDone}
          />
          <TaskGroup
            label="Later"
            tasks={groups.later}
            onEdit={openEditModal}
            onDelete={removeTask}
            onMarkDone={markDone}
          />

          {/* Completed — collapsed by default */}
          {completed.length > 0 && (
            <div>
              <button
                onClick={() => setCompletedOpen((o) => !o)}
                className="flex items-center gap-2 text-sm font-medium text-ink/50 dark:text-white/40
                           hover:text-ink/70 dark:hover:text-white/60 transition mb-3"
              >
                {completedOpen
                  ? <ChevronDown size={15} />
                  : <ChevronRight size={15} />}
                Show completed ({completed.length})
              </button>

              <AnimatePresence>
                {completedOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col gap-2">
                      {sortByPriority(completed).map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onEdit={openEditModal}
                          onDelete={removeTask}
                          onMarkUndone={markUndone}
                          done
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTask ? 'Edit task' : 'New task'}
      >
        <form onSubmit={submitForm} className="flex flex-col gap-3.5">
          <input
            className="input-field"
            placeholder="Task title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            autoFocus required
          />
          <textarea
            className="input-field"
            placeholder="Description (optional)"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              className="input-field"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              <option value="high">High priority</option>
              <option value="medium">Medium priority</option>
              <option value="low">Low priority</option>
            </select>
            <input
              className="input-field"
              placeholder="Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              className="input-field"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            />
            <input
              type="time"
              className="input-field"
              value={form.deadline_time}
              onChange={(e) => setForm({ ...form, deadline_time: e.target.value })}
            />
          </div>
          <button type="submit" className="btn-primary justify-center mt-1">
            {editingTask ? 'Save changes' : 'Add task'}
          </button>
        </form>
      </Modal>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function TaskGroup({ label, tasks, onEdit, onDelete, onMarkDone }) {
  if (tasks.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <h2 className="font-display font-semibold text-xs text-ink/50 dark:text-white/40 uppercase tracking-widest">
          {label}
        </h2>
        <span className="text-xs text-ink/30 dark:text-white/25 bg-white/50 dark:bg-white/5 rounded-full px-2 py-0.5">
          {tasks.length}
        </span>
        <div className="flex-1 h-px bg-ink/5 dark:bg-white/5" />
      </div>
      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onEdit={onEdit} onDelete={onDelete} onMarkDone={onMarkDone} />
        ))}
      </div>
    </div>
  );
}

function TaskCard({ task, onEdit, onDelete, onMarkDone, onMarkUndone, done = false }) {
  const time = formatTime(task.deadline_time);
  const date = formatDate(task.deadline);

  return (
    <div className={`group flex items-start gap-3 rounded-2xl border border-white/70 bg-white/70
                     p-3.5 shadow-sm transition hover:bg-white/90 ${done ? 'opacity-50' : ''}`}>

      {/* Check / uncheck */}
      <button
        onClick={() => done ? onMarkUndone(task) : onMarkDone(task)}
        className="mt-0.5 shrink-0 transition"
      >
        {done
          ? <CheckCircle2 size={18} className="text-sage-500" />
          : <Circle size={18} className="text-ink/25 hover:text-lavender-500" />}
      </button>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-medium text-ink leading-snug
                         ${done ? 'line-through text-ink/40' : ''}`}>
            {task.title}
          </p>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
            {!done && (
              <button onClick={() => onEdit(task)} className="text-ink/30 hover:text-lavender-600">
                <Pencil size={14} />
              </button>
            )}
            <button onClick={() => onDelete(task.id)} className="text-ink/30 hover:text-coral-500">
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {task.description && (
          <p className="text-xs text-ink/45 mt-0.5 line-clamp-1">{task.description}</p>
        )}

        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <PriorityPill priority={task.priority} />
          {date && (
            <span className="flex items-center gap-1 text-[11px] text-ink/40">
              <Calendar size={10} /> {date}
            </span>
          )}
          {time && (
            <span className="flex items-center gap-1 text-[11px] text-ink/40">
              <Clock size={10} /> {time}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}