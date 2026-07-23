import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ArrowRight, Sparkles, Target, RefreshCw, ListChecks } from 'lucide-react';
import { api } from '../api/client.js';

// ── Persistence ───────────────────────────────────────────────
export function markOnboarded(userId) {
  localStorage.setItem(`aurora_onboarded_${userId}`, '1');
}
export function isOnboarded(userId) {
  if (!userId) return true;
  return !!localStorage.getItem(`aurora_onboarded_${userId}`);
}

// ── Styles ────────────────────────────────────────────────────
const card = {
  background:           'linear-gradient(160deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 100%)',
  backdropFilter:       'blur(40px)',
  WebkitBackdropFilter: 'blur(40px)',
  border:               '1px solid rgba(255,255,255,0.22)',
  boxShadow:            '0 24px 64px rgba(0,0,0,0.18), inset 0 2px 0 rgba(255,255,255,0.50)',
  borderRadius:         '2rem',
};

const inputStyle = {
  background:           'rgba(255,255,255,0.10)',
  border:               '1px solid rgba(255,255,255,0.22)',
  backdropFilter:       'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  borderRadius:         '1rem',
  padding:              '0.75rem 1rem',
  fontSize:             '0.875rem',
  color:                'white',
  width:                '100%',
  outline:              'none',
};

// ── Shared buttons ────────────────────────────────────────────
function PrimaryBtn({ onClick, disabled, children }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-2 w-full rounded-2xl py-3.5 text-sm font-bold text-white disabled:opacity-40 transition-all"
      style={{
        background: 'linear-gradient(135deg, #7C6AF0 0%, #5B47E0 100%)',
        boxShadow:  '0 8px 24px rgba(124,106,240,0.40), inset 0 1px 0 rgba(255,255,255,0.30)',
      }}
    >
      {children}
    </motion.button>
  );
}

function SkipBtn({ onClick }) {
  return (
    <button onClick={onClick}
      className="text-xs text-white/35 hover:text-white/60 transition mt-3">
      Skip for now
    </button>
  );
}

// ── Step 0: Welcome ───────────────────────────────────────────
function WelcomeStep({ name, onNext }) {
  return (
    <div className="flex flex-col items-center text-center gap-6">
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        className="flex h-20 w-20 items-center justify-center rounded-3xl text-white text-4xl"
        style={{ background: 'linear-gradient(135deg,#7C6AF0 0%,#5B47E0 50%,#4634B8 100%)', boxShadow: '0 16px 40px rgba(124,106,240,0.45)' }}
      >
        ✦
      </motion.div>
      <div>
        <h1 className="font-display text-3xl font-bold text-white mb-2">
          Welcome to Aurora, {name} 👋
        </h1>
        <p className="text-white/55 text-sm leading-relaxed max-w-xs mx-auto">
          Your personal productivity OS. Let's set you up in 2 minutes.
        </p>
      </div>
      <div className="flex flex-col gap-3 w-full">
        {[
          { icon: <ListChecks size={16} />, text: 'Smart task management with priorities' },
          { icon: <Target size={16} />,     text: 'Goals broken into milestones'          },
          { icon: <RefreshCw size={16} />,  text: 'Habits that build streaks'             },
          { icon: <Sparkles size={16} />,   text: 'Lumi AI — your productivity assistant' },
        ].map(({ icon, text }) => (
          <div key={text}
            className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-white/70"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}>
            <span className="text-lavender-300 shrink-0">{icon}</span>
            {text}
          </div>
        ))}
      </div>
      <PrimaryBtn onClick={onNext}>
        Get started <ArrowRight size={16} />
      </PrimaryBtn>
    </div>
  );
}

// ── Step 1: Task ──────────────────────────────────────────────
function TaskStep({ onNext, onSkip }) {
  const [title,    setTitle]    = useState('');
  const [priority, setPriority] = useState('high');
  const [done,     setDone]     = useState(false);
  const [loading,  setLoading]  = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      await api.post('/tasks', { title: title.trim(), priority, category: 'General' });
      setDone(true);
      setTimeout(onNext, 900);
    } catch (_) { setLoading(false); }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <div className="text-3xl mb-2">✅</div>
        <h2 className="font-display text-xl font-bold text-white">Add your first task</h2>
        <p className="text-white/50 text-sm mt-1">What's the one thing you need to get done?</p>
      </div>
      <div className="flex flex-col gap-3">
        <input style={inputStyle} placeholder="e.g. Finish project proposal"
          value={title} onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()} autoFocus />
        <div className="flex gap-2">
          {['low','medium','high'].map((p) => (
            <button key={p} onClick={() => setPriority(p)}
              className="flex-1 rounded-xl py-2 text-xs font-semibold capitalize transition-all"
              style={priority === p ? {
                background: p === 'high' ? 'rgba(239,68,68,0.25)' : p === 'medium' ? 'rgba(245,158,11,0.25)' : 'rgba(124,106,240,0.25)',
                border:     `1px solid ${p === 'high' ? 'rgba(239,68,68,0.5)' : p === 'medium' ? 'rgba(245,158,11,0.5)' : 'rgba(124,106,240,0.5)'}`,
                color:      p === 'high' ? '#FCA5A5' : p === 'medium' ? '#FCD34D' : '#C4B5FD',
              } : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.40)' }}>
              {p}
            </button>
          ))}
        </div>
      </div>
      {done ? (
        <div className="flex items-center justify-center gap-2 text-green-400 font-semibold py-3">
          <CheckCircle2 size={20} /> Task created!
        </div>
      ) : (
        <PrimaryBtn onClick={submit} disabled={!title.trim() || loading}>
          {loading ? 'Creating…' : 'Create task'} <ArrowRight size={16} />
        </PrimaryBtn>
      )}
      <div className="text-center"><SkipBtn onClick={onSkip} /></div>
    </div>
  );
}

// ── Step 2: Goal ──────────────────────────────────────────────
function GoalStep({ onNext, onSkip }) {
  const [title,   setTitle]   = useState('');
  const [done,    setDone]    = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      await api.post('/goals', { title: title.trim(), category: 'Personal' });
      setDone(true);
      setTimeout(onNext, 900);
    } catch (_) { setLoading(false); }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <div className="text-3xl mb-2">🎯</div>
        <h2 className="font-display text-xl font-bold text-white">Set a goal</h2>
        <p className="text-white/50 text-sm mt-1">What's something meaningful you want to achieve?</p>
      </div>
      <div className="flex flex-col gap-3">
        <input style={inputStyle} placeholder="e.g. Get internship at a top tech company"
          value={title} onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()} autoFocus />
        <p className="text-xs text-white/30 text-center">
          Add milestones and let Lumi break it down after setup.
        </p>
      </div>
      {done ? (
        <div className="flex items-center justify-center gap-2 text-green-400 font-semibold py-3">
          <CheckCircle2 size={20} /> Goal created!
        </div>
      ) : (
        <PrimaryBtn onClick={submit} disabled={!title.trim() || loading}>
          {loading ? 'Creating…' : 'Set goal'} <ArrowRight size={16} />
        </PrimaryBtn>
      )}
      <div className="text-center"><SkipBtn onClick={onSkip} /></div>
    </div>
  );
}

// ── Step 3: Habit ─────────────────────────────────────────────
function HabitStep({ onNext, onSkip }) {
  const PRESETS = ['Exercise 💪', 'Read 📖', 'Meditate 🧘', 'Code 💻', 'Drink water 💧', 'Study 📚'];
  const [name,    setName]    = useState('');
  const [done,    setDone]    = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (habitName) => {
    const n = (habitName || name).trim();
    if (!n) return;
    setLoading(true);
    try {
      await api.post('/habits', { name: n, icon: 'Sparkles', color: '#7C6AF0', target_per_week: 7 });
      setDone(true);
      setTimeout(onNext, 900);
    } catch (_) { setLoading(false); }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <div className="text-3xl mb-2">🔁</div>
        <h2 className="font-display text-xl font-bold text-white">Build a daily habit</h2>
        <p className="text-white/50 text-sm mt-1">Pick one thing to do every day. Small wins compound.</p>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {PRESETS.map((p) => (
          <button key={p} onClick={() => submit(p.split(' ')[0])}
            className="rounded-2xl px-4 py-2 text-sm font-medium text-white/65 hover:text-white transition-all"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)' }}>
            {p}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.10)' }} />
        <span className="text-xs text-white/30">or type your own</span>
        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.10)' }} />
      </div>
      <div className="flex gap-2">
        <input
          style={{ ...inputStyle, flex: 1 }}
          placeholder="Custom habit…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <motion.button
          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
          onClick={() => submit()} disabled={!name.trim() || loading}
          className="rounded-2xl px-5 text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,#7C6AF0 0%,#5B47E0 100%)', boxShadow: '0 4px 14px rgba(124,106,240,0.35)' }}>
          Add
        </motion.button>
      </div>
      {done && (
        <div className="flex items-center justify-center gap-2 text-green-400 font-semibold py-2">
          <CheckCircle2 size={20} /> Habit added!
        </div>
      )}
      <div className="text-center"><SkipBtn onClick={onSkip} /></div>
    </div>
  );
}

// ── Step 4: Lumi + Shortcuts ──────────────────────────────────
function LumiStep({ onNext }) {
  const isMac = navigator.platform?.includes('Mac');

  return (
    <div className="flex flex-col items-center text-center gap-5">
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="flex h-20 w-20 items-center justify-center rounded-3xl text-4xl text-white"
        style={{ background: 'linear-gradient(135deg,#A855F7 0%,#7C3AED 100%)', boxShadow: '0 16px 40px rgba(168,85,247,0.40)' }}>
        ✦
      </motion.div>

      <div>
        <h2 className="font-display text-2xl font-bold text-white mb-2">Meet Lumi + shortcuts</h2>
        <p className="text-white/55 text-sm leading-relaxed max-w-xs mx-auto">
          Lumi knows your tasks, goals, and habits. Ask her anything — and navigate Aurora instantly with keyboard shortcuts.
        </p>
      </div>

      {/* Lumi examples */}
      <div className="flex flex-col gap-2 w-full">
        {[
          '"How productive was I this week?"',
          '"Plan my day — I have 3 hours"',
          '"When do I focus best?"',
        ].map((q) => (
          <div key={q}
            className="rounded-xl px-4 py-2.5 text-xs text-white/55 text-left font-mono"
            style={{ background: 'rgba(168,85,247,0.10)', border: '1px solid rgba(168,85,247,0.20)' }}>
            {q}
          </div>
        ))}
      </div>

      {/* Shortcuts grid */}
      <div className="w-full rounded-2xl p-4"
        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
        <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">Quick shortcuts</p>
        <div className="grid grid-cols-2 gap-1.5 text-left">
          {[
            { key: isMac ? '⌘K' : 'Ctrl+K', desc: 'Search'       },
            { key: 'D',                      desc: 'Dashboard'     },
            { key: 'T',                      desc: 'Tasks'         },
            { key: 'F',                      desc: 'Flow timer'    },
            { key: 'N',                      desc: 'New task'      },
            { key: '?',                      desc: 'All shortcuts' },
          ].map(({ key, desc }) => (
            <div key={key}
              className="flex items-center justify-between px-3 py-1.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.05)' }}>
              <span className="text-xs text-white/50">{desc}</span>
              <kbd
                className="text-[10px] font-bold text-white/35 font-mono px-2 py-0.5 rounded-md"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </div>

      <PrimaryBtn onClick={onNext}>
        Let's go <ArrowRight size={16} />
      </PrimaryBtn>
    </div>
  );
}

// ── Step 5: Done ──────────────────────────────────────────────
function DoneStep({ name, onFinish }) {
  return (
    <div className="flex flex-col items-center text-center gap-6">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="text-7xl"
      >
        🎉
      </motion.div>
      <div>
        <h2 className="font-display text-2xl font-bold text-white mb-2">
          You're all set, {name}!
        </h2>
        <p className="text-white/55 text-sm leading-relaxed max-w-xs mx-auto">
          Aurora is ready. Your dashboard is live, Lumi is waiting, and your first task is already logged.
        </p>
      </div>
      <PrimaryBtn onClick={onFinish}>
        Open Aurora ✦
      </PrimaryBtn>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function Onboarding({ user, onComplete }) {
  const [step, setStep] = useState(0);

  const name = user?.name?.split(' ')[0] || 'there';
  const next = () => setStep((s) => s + 1);

  const finish = () => {
    markOnboarded(user?.id);
    onComplete();
  };

  const stepContent = [
    <WelcomeStep key="welcome" name={name} onNext={next} />,
    <TaskStep    key="task"    onNext={next} onSkip={next} />,
    <GoalStep    key="goal"    onNext={next} onSkip={next} />,
    <HabitStep   key="habit"   onNext={next} onSkip={next} />,
    <LumiStep    key="lumi"    onNext={next} />,
    <DoneStep    key="done"    name={name}   onFinish={finish} />,
  ];

  const totalSteps = stepContent.length - 2;
  const showDots   = step > 0 && step < stepContent.length - 1;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: 'rgba(7,11,20,0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
    >
      <div className="w-full max-w-sm">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 24,  scale: 0.97 }}
            animate={{ opacity: 1, y: 0,   scale: 1    }}
            exit={{    opacity: 0, y: -16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            className="p-8"
            style={card}
          >
            {stepContent[step]}
          </motion.div>
        </AnimatePresence>

        {/* Progress dots */}
        {showDots && (
          <div className="flex justify-center gap-2 mt-5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width:  i === step - 1 ? 20 : 6,
                  height: 6,
                  background: i === step - 1
                    ? 'rgba(124,106,240,0.90)'
                    : i < step - 1
                    ? 'rgba(124,106,240,0.40)'
                    : 'rgba(255,255,255,0.15)',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}