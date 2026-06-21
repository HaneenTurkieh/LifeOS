import React, { useEffect, useState, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { motion } from 'framer-motion';
import { Plus, Trash2, Pencil, Calendar, ListChecks } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import PriorityPill from '../components/PriorityPill.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import PageLoader from '../components/Loader.jsx';

const COLUMNS = [
  { key: 'todo', title: 'To Do', accent: 'bg-lavender-400' },
  { key: 'doing', title: 'Doing', accent: 'bg-sun-500' },
  { key: 'done', title: 'Done', accent: 'bg-sage-500' },
];

const emptyForm = { title: '', description: '', priority: 'medium', category: 'General', deadline: '' };

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  // null = creating a new task; otherwise holds the task being edited so
  // we know to PUT instead of POST, and which row to refresh visually.
  const [editingTask, setEditingTask] = useState(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try { setTasks(await api.get('/tasks')); } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const grouped = COLUMNS.reduce((acc, c) => {
    acc[c.key] = tasks.filter((t) => t.status === c.key).sort((a, b) => a.position - b.position);
    return acc;
  }, {});

  const onDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const newTasks = tasks.map((t) => ({ ...t }));
    const moved = newTasks.find((t) => String(t.id) === draggableId);
    moved.status = destination.droppableId;

    const colTasks = newTasks.filter((t) => t.status === destination.droppableId && t.id !== moved.id);
    colTasks.splice(destination.index, 0, moved);
    colTasks.forEach((t, idx) => { t.position = idx; });
    setTasks(newTasks);

    const wasDone = source.droppableId === 'done';
    const isNowDone = destination.droppableId === 'done';

    await api.post('/tasks/reorder', { tasks: colTasks.map((t) => ({ id: t.id, status: t.status, position: t.position })) });
    if (!wasDone && isNowDone) {
      const { xpAwarded, unlocked } = await api.put(`/tasks/${moved.id}`, { status: 'done', progress: 100 });
      if (xpAwarded) toast.xp(xpAwarded, moved.title);
      unlocked?.forEach((k) => toast.achievement(k.replace(/_/g, ' ')));
    }
    load();
  };

  const openCreateModal = () => {
    setEditingTask(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEditModal = (task) => {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      category: task.category,
      deadline: task.deadline || '',
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
    await api.del(`/tasks/${id}`);
    toast.success('Task deleted');
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        eyebrow="Task Manager"
        title="Drag, drop, get it done"
        subtitle="Organize everything you need to do across To Do, Doing and Done."
        action={<button className="btn-primary" onClick={openCreateModal}><Plus size={16}/> New task</button>}
      />

      {tasks.length === 0 ? (
        <EmptyState icon={ListChecks} title="No tasks yet" message="Add your first task to get started." action={<button className="btn-primary mt-2" onClick={openCreateModal}><Plus size={16}/> New task</button>} />
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {COLUMNS.map((col) => (
              <div key={col.key} className="glass-panel rounded-3xl p-4 min-h-[420px] flex flex-col">
                <div className="flex items-center gap-2 px-2 mb-3">
                  <span className={`h-2 w-2 rounded-full ${col.accent}`} />
                  <h3 className="font-display font-semibold text-sm text-ink">{col.title}</h3>
                  <span className="ml-auto text-xs text-ink/40 bg-white/60 rounded-full px-2 py-0.5">{grouped[col.key].length}</span>
                </div>
                <Droppable droppableId={col.key}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef} {...provided.droppableProps}
                      className={`flex-1 flex flex-col gap-2.5 rounded-2xl p-1.5 transition-colors ${snapshot.isDraggingOver ? 'bg-lavender-100/50' : ''}`}
                    >
                      {grouped[col.key].map((task, index) => (
                        <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                          {(dragProvided, dragSnapshot) => (
                            <motion.div
                              ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps}
                              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                              className={`group rounded-2xl border border-white/70 bg-white/70 p-3.5 shadow-sm transition ${dragSnapshot.isDragging ? 'shadow-glass-lg scale-[1.03]' : 'hover:bg-white/90'}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className={`text-sm font-medium text-ink leading-snug ${task.status === 'done' ? 'line-through text-ink/40' : ''}`}>{task.title}</p>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                                  <button onClick={() => openEditModal(task)} className="text-ink/30 hover:text-lavender-600">
                                    <Pencil size={14} />
                                  </button>
                                  <button onClick={() => removeTask(task.id)} className="text-ink/30 hover:text-coral-500">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                              {task.description && <p className="text-xs text-ink/45 mt-1 line-clamp-2">{task.description}</p>}
                              <div className="flex items-center justify-between mt-3">
                                <PriorityPill priority={task.priority} />
                                {task.deadline && (
                                  <span className="flex items-center gap-1 text-[11px] text-ink/40"><Calendar size={11}/> {task.deadline}</span>
                                )}
                              </div>
                              <div className="mt-2 h-1.5 rounded-full bg-ink/5 overflow-hidden">
                                <div className="h-full rounded-full bg-gradient-to-r from-lavender-400 to-lavender-600" style={{ width: `${task.progress}%` }} />
                              </div>
                            </motion.div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingTask ? 'Edit task' : 'New task'}>
        <form onSubmit={submitForm} className="flex flex-col gap-3.5">
          <input className="input-field" placeholder="Task title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus required />
          <textarea className="input-field" placeholder="Description (optional)" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <select className="input-field" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="low">Low priority</option>
              <option value="medium">Medium priority</option>
              <option value="high">High priority</option>
            </select>
            <input className="input-field" placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <input type="date" className="input-field" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          <button type="submit" className="btn-primary justify-center mt-1">{editingTask ? 'Save changes' : 'Add task'}</button>
        </form>
      </Modal>
    </div>
  );
}
