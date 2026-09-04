import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ArrowRight, Sparkles, Target, RefreshCw, ListChecks, Gift, Bell, Users, BarChart3 } from 'lucide-react';
import { api } from '../api/client.js';
import { useLanguage } from '../context/LanguageContext.jsx';

export function markOnboarded(userId) {
  localStorage.setItem(`nuvora_onboarded_${userId}`, '1');
  localStorage.removeItem(`aurora_onboarded_${userId}`);
}
export function isOnboarded(userId) {
  if (!userId) return true;
  // Fall back to the pre-rebrand key so nobody who already finished
  // onboarding gets sent through it again after the rename.
  return !!localStorage.getItem(`nuvora_onboarded_${userId}`) || !!localStorage.getItem(`aurora_onboarded_${userId}`);
}

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

function PrimaryBtn({ onClick, disabled, children }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-2 w-full rounded-2xl py-3.5 text-sm font-bold text-white disabled:opacity-40 transition-all"
      style={{
        background: 'linear-gradient(135deg, rgb(var(--accent-500)) 0%, rgb(var(--accent-600)) 100%)',
        boxShadow:  '0 8px 24px rgb(var(--accent-500) / 0.40), inset 0 1px 0 rgba(255,255,255,0.30)',
      }}
    >
      {children}
    </motion.button>
  );
}
function WelcomeStep({ name, isInstructor, onNext }) {
  const { t, isRTL } = useLanguage();
  // Instructor accounts don't have Tasks/Goals/Habits/Flow in their nav
  // at all (see Sidebar.jsx's INSTRUCTOR_NAV_PATHS) — pitching those as
  // "what Nuvora does" in the very first screen they see would just be
  // advertising pages they can't open. Swapped for what their account
  // actually does: run channels/classes.
  const features = isInstructor
    ? [
        { icon: <Users size={16} />,      text: t('onboarding.instFeature1') },
        { icon: <ListChecks size={16} />, text: t('onboarding.instFeature2') },
        { icon: <BarChart3 size={16} />,  text: t('onboarding.instFeature3') },
        { icon: <Sparkles size={16} />,   text: t('onboarding.instFeature4') },
      ]
    : [
        { icon: <ListChecks size={16} />, text: t('onboarding.feature1') },
        { icon: <Target size={16} />,     text: t('onboarding.feature2') },
        { icon: <RefreshCw size={16} />,  text: t('onboarding.feature3') },
        { icon: <Sparkles size={16} />,   text: t('onboarding.feature4') },
      ];
  return (
    <div className="flex flex-col items-center text-center gap-6">
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        className="flex h-20 w-20 items-center justify-center"
      >
        <img src="/icon-192.png" alt="Nuvora" className="h-20 w-20 drop-shadow-lg" />
      </motion.div>
      <div>
        <h1 className="font-display text-3xl font-bold text-white mb-2">
          {t('onboarding.welcomeTitle', { name })}
        </h1>
        <p className="text-white/55 text-sm leading-relaxed max-w-xs mx-auto">
          {t(isInstructor ? 'onboarding.instWelcomeSubtitle' : 'onboarding.welcomeSubtitle')}
        </p>
      </div>
      <div className="flex flex-col gap-3 w-full">
        {features.map(({ icon, text }) => (
          <div key={text}
            className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-white/70"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}>
            <span className="text-lavender-300 shrink-0">{icon}</span>
            {text}
          </div>
        ))}
      </div>
      <PrimaryBtn onClick={onNext}>
        {t('onboarding.getStarted')} <ArrowRight size={16} style={isRTL ? { transform: 'scaleX(-1)' } : undefined} />
      </PrimaryBtn>
    </div>
  );
}

// Hoisted to module scope on purpose — this used to be defined INSIDE
// QuickSetupStep's function body. That meant every keystroke (which
// re-renders QuickSetupStep via setTask/setGoal/setHabit) created a
// brand-new `Row` function identity, and React treats a new component
// identity as a different component type — so it unmounted and remounted
// the underlying <input> DOM node on every single character typed. That
// remount drops focus, so fast typing looked like the field was "chopping
// off" what people typed: keystrokes fired after the DOM node was replaced
// never reached the (new, unfocused) input. A stable, module-level
// component reference fixes it — same `Row` element identity across
// re-renders, so the <input> node persists and keeps focus while typing.
function Row({ icon, placeholder, value, onChange, onSubmit, done, presets }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <div className="flex items-center gap-2 flex-1 rounded-xl px-3 py-2.5" style={{ ...inputStyle, padding: undefined }}>
          <span className="text-white/40 shrink-0">{icon}</span>
          <input
            className="bg-transparent outline-none text-sm text-white w-full placeholder:text-white/30"
            placeholder={placeholder} value={value} onChange={onChange} disabled={done}
            onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          />
        </div>
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={() => onSubmit()} disabled={done || !value.trim()}
          className="rounded-xl px-4 text-xs font-semibold disabled:opacity-30 shrink-0 flex items-center justify-center"
          style={done
            ? { background: 'rgba(74,222,128,0.20)', border: '1px solid rgba(74,222,128,0.4)', color: '#4ADE80' }
            : { background: 'rgb(var(--accent-500) / 0.25)', border: '1px solid rgb(var(--accent-500) / 0.5)', color: 'white' }}>
          {done ? <CheckCircle2 size={14} /> : t('onboarding.add')}
        </motion.button>
      </div>
      {presets && !done && (
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button key={p} onClick={() => onSubmit(p.split(' ')[0])}
              className="rounded-full px-2.5 py-1 text-[11px] text-white/55 hover:text-white transition"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Combines what used to be three separate full-screen steps (task,
// goal, habit — each its own page-flip with a "Skip for now" link)
// into one screen with three compact quick-add rows. Same actions,
// a third of the taps: this was the biggest single contributor to
// onboarding feeling "too long" since most people skipped at least
// one of the three anyway.
function QuickSetupStep({ onNext }) {
  const { t, isRTL } = useLanguage();
  const [task,  setTask]  = useState('');
  const [goal,  setGoal]  = useState('');
  const [habit, setHabit] = useState('');
  const [doneTask,  setDoneTask]  = useState(false);
  const [doneGoal,  setDoneGoal]  = useState(false);
  const [doneHabit, setDoneHabit] = useState(false);

  const addTask = async () => {
    if (!task.trim() || doneTask) return;
    setDoneTask(true); // optimistic — this is a low-stakes quick-add, not worth blocking the row on
    try { await api.post('/tasks', { title: task.trim(), priority: 'high', category: 'general' }); }
    catch (_) { setDoneTask(false); }
  };
  const addGoal = async () => {
    if (!goal.trim() || doneGoal) return;
    setDoneGoal(true);
    try { await api.post('/goals', { title: goal.trim(), category: 'Personal' }); }
    catch (_) { setDoneGoal(false); }
  };
  const addHabit = async (presetName) => {
    const n = (presetName || habit).trim();
    if (!n || doneHabit) return;
    setDoneHabit(true);
    try { await api.post('/habits', { name: n, icon: 'Sparkles', color: '#7C6AF0', target_per_week: 7 }); }
    catch (_) { setDoneHabit(false); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <div className="text-3xl mb-2">⚡</div>
        <h2 className="font-display text-xl font-bold text-white">{t('onboarding.setupTitle')}</h2>
        <p className="text-white/50 text-sm mt-1">{t('onboarding.setupSubtitle')}</p>
      </div>
      <Row icon={<ListChecks size={15} />} placeholder={t('onboarding.taskPlaceholder')} value={task}
        onChange={(e) => setTask(e.target.value)} onSubmit={addTask} done={doneTask} />
      <Row icon={<Target size={15} />} placeholder={t('onboarding.goalPlaceholder')} value={goal}
        onChange={(e) => setGoal(e.target.value)} onSubmit={addGoal} done={doneGoal} />
      <Row icon={<RefreshCw size={15} />} placeholder={t('onboarding.habitPlaceholder')} value={habit}
        onChange={(e) => setHabit(e.target.value)} onSubmit={addHabit} done={doneHabit}
        presets={[t('onboarding.presetExercise'), t('onboarding.presetRead'), t('onboarding.presetMeditate'), t('onboarding.presetStudy')]} />
      <PrimaryBtn onClick={onNext}>
        {t('onboarding.continue')} <ArrowRight size={16} style={isRTL ? { transform: 'scaleX(-1)' } : undefined} />
      </PrimaryBtn>
    </div>
  );
}

// Instructor's version of QuickSetupStep above — task/goal/habit
// quick-add makes no sense here (an instructor account has no Tasks/
// Goals/Habits pages to ever see those rows again on — QuickSetupStep
// used to run for instructor signups too, silently creating orphaned
// rows nobody could ever open or delete). One real action instead: spin
// up their first channel, which they land on right after — same "get
// them to one genuinely useful thing fast" goal, just the thing that's
// actually theirs to use.
function ChannelSetupStep({ onNext }) {
  const { t, isRTL } = useLanguage();
  const [name, setName] = useState('');
  const [done, setDone] = useState(false);
  const createChannel = async () => {
    if (!name.trim() || done) return;
    setDone(true); // optimistic, same low-stakes reasoning as QuickSetupStep's rows
    try { await api.post('/channels', { name: name.trim() }); }
    catch (_) { setDone(false); }
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <div className="text-3xl mb-2">🏫</div>
        <h2 className="font-display text-xl font-bold text-white">{t('onboarding.instSetupTitle')}</h2>
        <p className="text-white/50 text-sm mt-1">{t('onboarding.instSetupSubtitle')}</p>
      </div>
      <Row icon={<Users size={15} />} placeholder={t('onboarding.channelPlaceholder')} value={name}
        onChange={(e) => setName(e.target.value)} onSubmit={createChannel} done={done} />
      <PrimaryBtn onClick={onNext}>
        {t('onboarding.continue')} <ArrowRight size={16} style={isRTL ? { transform: 'scaleX(-1)' } : undefined} />
      </PrimaryBtn>
    </div>
  );
}

// Merges what used to be two separate steps (Lumi intro+shortcuts,
// then a whole other screen just for XP/levels) into one. Shortcuts
// stay as the detailed grid since that's reference material worth
// keeping; XP/levels is condensed to a single line since it's
// contextual flavor, not something anyone needs to study here.
function LumiStep({ onNext, isInstructor }) {
  const { t, isRTL } = useLanguage();
  const isMac = navigator.platform?.includes('Mac');
  // Only D/L/search/? actually go anywhere for an instructor account —
  // T (Tasks), F (Flow), and N (New task) all point at pages that
  // aren't in their nav at all, so listing them here would just be
  // teaching a shortcut to a dead end.
  const shortcuts = isInstructor
    ? [
        { key: isMac ? '⌘K' : 'Ctrl+K', desc: t('onboarding.shortcutSearch')    },
        { key: 'D',                      desc: t('onboarding.shortcutDashboard') },
        { key: 'L',                      desc: t('nav.lumi')                    },
        { key: '?',                      desc: t('onboarding.shortcutAll')       },
      ]
    : [
        { key: isMac ? '⌘K' : 'Ctrl+K', desc: t('onboarding.shortcutSearch')    },
        { key: 'D',                      desc: t('onboarding.shortcutDashboard') },
        { key: 'T',                      desc: t('onboarding.shortcutTasks')     },
        { key: 'F',                      desc: t('onboarding.shortcutFlow')      },
        { key: 'N',                      desc: t('onboarding.shortcutNewTask')   },
        { key: '?',                      desc: t('onboarding.shortcutAll')       },
      ];
  return (
    <div className="flex flex-col items-center text-center gap-4">
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="flex h-16 w-16 items-center justify-center rounded-3xl text-3xl text-white"
        style={{ background: 'linear-gradient(135deg,#A855F7 0%,#7C3AED 100%)', boxShadow: '0 16px 40px rgba(168,85,247,0.40)' }}>
        ✦
      </motion.div>
      <div>
        <h2 className="font-display text-2xl font-bold text-white mb-2">{t('onboarding.lumiTitle')}</h2>
        <p className="text-white/55 text-sm leading-relaxed max-w-xs mx-auto">
          {t(isInstructor ? 'onboarding.instLumiSubtitle' : 'onboarding.lumiSubtitle')}
        </p>
      </div>
      <div className="w-full rounded-2xl p-4"
        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
        <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">{t('onboarding.shortcutsLabel')}</p>
        <div className="grid grid-cols-2 gap-1.5 text-start">
          {shortcuts.map(({ key, desc }) => (
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
      {/* Provider names, not exact model/tier strings — those get swapped
          under the hood as pricing/availability changes (see comments in
          server/lib/openrouter.js and server/lib/gemini.js, already
          revised more than once), so this stays accurate without needing
          an onboarding-copy update every time that happens. */}
      <p className="text-[10px] text-white/30">{t('onboarding.poweredBy')}</p>
      {/* XP/leveling is earned by completing tasks/goals/habits — none of
          which an instructor account has — so the "level up to unlock a
          trial" pitch doesn't hold for this role. Left out entirely
          rather than shown with a caveat. */}
      {!isInstructor && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-2.5 w-full text-start"
          style={{ background: 'rgba(255,184,77,0.10)', border: '1px solid rgba(255,184,77,0.22)' }}>
          <span className="text-sun-300 shrink-0"><Gift size={16} /></span>
          <p className="text-xs text-white/65 leading-snug">
            {t('onboarding.xpHint')}
          </p>
        </div>
      )}
      <PrimaryBtn onClick={onNext}>
        {t('onboarding.letsGo')} <ArrowRight size={16} style={isRTL ? { transform: 'scaleX(-1)' } : undefined} />
      </PrimaryBtn>
    </div>
  );
}

// New step, on purpose — Flow (a live focus timer that grows a tree while
// you work) is arguably the most distinctive thing in the app, but before
// this it had zero explanation anywhere in onboarding — just one line in
// the LumiStep keyboard-shortcuts grid ("F → Flow"), which explains the
// hotkey to someone who already knows what Flow is, not what it actually
// does. This gives it its own beat, the same weight as the Lumi intro.
function FlowStep({ onNext }) {
  const { t, isRTL } = useLanguage();
  return (
    <div className="flex flex-col items-center text-center gap-4">
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="flex h-16 w-16 items-center justify-center rounded-3xl text-3xl"
        style={{ background: 'linear-gradient(135deg,#4ADE80 0%,#22C55E 100%)', boxShadow: '0 16px 40px rgba(34,197,94,0.40)' }}>
        🌱
      </motion.div>
      <div>
        <h2 className="font-display text-2xl font-bold text-white mb-2">{t('onboarding.flowTitle')}</h2>
        <p className="text-white/55 text-sm leading-relaxed max-w-xs mx-auto">
          {t('onboarding.flowSubtitle')}
        </p>
      </div>
      <div className="flex flex-col gap-2.5 w-full">
        {[
          { icon: '⏱️', text: t('onboarding.flowPoint1') },
          { icon: '🌳', text: t('onboarding.flowPoint2') },
          { icon: '📱', text: t('onboarding.flowPoint3') },
        ].map(({ icon, text }) => (
          <div key={text}
            className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-start text-sm text-white/70"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}>
            <span className="shrink-0">{icon}</span>
            {text}
          </div>
        ))}
      </div>
      <PrimaryBtn onClick={onNext}>
        {t('onboarding.continue')} <ArrowRight size={16} style={isRTL ? { transform: 'scaleX(-1)' } : undefined} />
      </PrimaryBtn>
    </div>
  );
}

// iOS-only. Android/desktop Chrome fires its own `beforeinstallprompt`
// banner unprompted, but Safari on iOS never does — there's no native
// "install this" nudge at all there, so without walking someone through
// the manual Share-sheet steps here, most iOS users would just never
// discover Nuvora can live on their home screen full-screen like a real
// app. Only shown when actually useful: real iOS, and not already
// running installed (checked in Onboarding below) — showing install
// instructions to someone who already installed it would just be noise.
function InstallStep({ onNext }) {
  const { t, isRTL } = useLanguage();
  return (
    <div className="flex flex-col items-center text-center gap-4">
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="flex h-16 w-16 items-center justify-center rounded-3xl text-3xl"
        style={{ background: 'linear-gradient(135deg,#60A5FA 0%,#3B82F6 100%)', boxShadow: '0 16px 40px rgba(59,130,246,0.40)' }}>
        📲
      </motion.div>
      <div>
        <h2 className="font-display text-2xl font-bold text-white mb-2">{t('onboarding.installTitle')}</h2>
        <p className="text-white/55 text-sm leading-relaxed max-w-xs mx-auto">
          {t('onboarding.installSubtitle')}
        </p>
      </div>
      <div className="flex flex-col gap-2.5 w-full">
        {[
          { n: '1', text: t('onboarding.installStep1') },
          { n: '2', text: t('onboarding.installStep2') },
          { n: '3', text: t('onboarding.installStep3') },
        ].map(({ n, text }) => (
          <div key={n}
            className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-start text-sm text-white/70"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ background: 'rgba(96,165,250,0.45)' }}>
              {n}
            </span>
            {text}
          </div>
        ))}
      </div>
      <PrimaryBtn onClick={onNext}>
        {t('onboarding.continue')} <ArrowRight size={16} style={isRTL ? { transform: 'scaleX(-1)' } : undefined} />
      </PrimaryBtn>
    </div>
  );
}

function DoneStep({ name, isInstructor, onFinish }) {
  const { t } = useLanguage();
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
          {t('onboarding.doneTitle', { name })}
        </h2>
        <p className="text-white/55 text-sm leading-relaxed max-w-xs mx-auto">
          {t(isInstructor ? 'onboarding.instDoneSubtitle' : 'onboarding.doneSubtitle')}
        </p>
      </div>
      {/* Easy to miss otherwise — the bell only ever shows up once something's
          actually due, and push needs an explicit opt-in in Settings, so
          without a line here most people would never discover either exists
          until they'd already missed something. Instructor variant talks
          about student activity instead of task/deadline reminders — see
          GET /notifications, which no longer generates the latter for
          this role at all (nothing to point at). */}
      <div className="flex items-center gap-3 rounded-xl px-4 py-2.5 w-full text-start"
        style={{ background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.22)' }}>
        <span className="text-accent-300 shrink-0"><Bell size={16} /></span>
        <p className="text-xs text-white/65 leading-snug">
          {t(isInstructor ? 'onboarding.instNotifHint' : 'onboarding.notifHint')}
        </p>
      </div>
      <PrimaryBtn onClick={onFinish}>
        {t('onboarding.openApp')}
      </PrimaryBtn>
    </div>
  );
}

export default function Onboarding({ user, onComplete }) {
  const [step, setStep]       = useState(0);
  const [closing, setClosing] = useState(false);
  const name = user?.name?.split(' ')[0] || 'there';
  const isInstructor = user?.role === 'instructor';
  const next = () => setStep((s) => s + 1);

  // Real iOS device, opened in the regular Safari browser tab rather than
  // already running as the installed home-screen app. `navigator.standalone`
  // is Safari's own (non-standard, iOS-only) flag for exactly that second
  // check — `display-mode: standalone` alone isn't reliable on iOS Safari.
  // Computed once per mount (onboarding only ever runs once per account
  // anyway) rather than kept reactive — nobody installs the PWA mid-flow.
  const isIOSInstallable = (() => {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent || '') && !window.MSStream;
    const isStandalone = window.navigator.standalone === true
      || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    return isIOS && !isStandalone;
  })();

  // "Refold" — instead of dismissing instantly, fold the card back
  // shut (mirror of the entrance fold) and only unmount once that
  // animation has actually finished playing.
  const finish = () => {
    markOnboarded(user?.id);
    setClosing(true);
    setTimeout(onComplete, 620);
  };

  // Instructor accounts skip QuickSetupStep (task/goal/habit — none of
  // which they have a page to ever see again) in favor of ChannelSetupStep,
  // and skip FlowStep entirely (no Flow access at all — see Sidebar.jsx's
  // INSTRUCTOR_NAV_PATHS). Every other step just renders its own
  // isInstructor-aware copy. totalSteps/showDots below are already
  // derived from stepContent.length, so a 4-step vs. 5-step flow needs
  // no other changes anywhere in this component.
  const stepContent = isInstructor
    ? [
        <WelcomeStep      key="welcome" name={name} isInstructor onNext={next} />,
        <ChannelSetupStep key="setup"   onNext={next} />,
        <LumiStep         key="lumi"    isInstructor onNext={next} />,
        ...(isIOSInstallable ? [<InstallStep key="install" onNext={next} />] : []),
        <DoneStep         key="done"    name={name} isInstructor onFinish={finish} />,
      ]
    : [
        <WelcomeStep    key="welcome" name={name} onNext={next} />,
        <QuickSetupStep key="setup"   onNext={next} />,
        <LumiStep       key="lumi"    onNext={next} />,
        <FlowStep       key="flow"    onNext={next} />,
        ...(isIOSInstallable ? [<InstallStep key="install" onNext={next} />] : []),
        <DoneStep       key="done"    name={name}   onFinish={finish} />,
      ];
  const totalSteps = stepContent.length - 2;
  const showDots   = step > 0 && step < stepContent.length - 1 && !closing;
  const isWelcome  = step === 0;

  return (
    // The card already fades/folds itself shut on finish() (see
    // `closing` below), but this outer backdrop — the dark blurred
    // scrim behind it — used to just vanish in one frame the instant
    // the parent unmounts it (setTimeout(onComplete, 620) in finish()
    // below). The card was gone smoothly by then, but that opaque
    // rgba(7,11,20,0.85)+blur layer cutting to nothing in a single
    // frame is exactly what read as a "flash" straight into the
    // dashboard. Animating this div's own opacity down in step with
    // the card's fold means the whole overlay — scrim included —
    // dissolves together instead of the background hard-cutting out
    // from under an already-faded card.
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: 'rgba(7,11,20,0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: closing ? 0 : 1 }}
      transition={{ duration: closing ? 0.6 : 0.35, ease: closing ? [0.7, 0, 0.84, 0] : 'easeOut' }}
    >
      <div className="w-full max-w-sm" style={{ perspective: 1200 }}>
        <AnimatePresence mode="wait">
          {closing ? (
            // Refold-and-dismiss — mirrors the fold-in entrance in
            // reverse: the current (final) card collapses flat and
            // fades, like a letter being folded shut. No blur on
            // this outer layer, same Safari-safety reason as below.
            <motion.div
              key="closing"
              initial={{ opacity: 1, rotateX: 0, scaleY: 1 }}
              animate={{ opacity: 0, rotateX: 70, scaleY: 0.05 }}
              transition={{ duration: 0.6, ease: [0.7, 0, 0.84, 0] }}
              style={{ transformOrigin: 'top center', transformStyle: 'preserve-3d' }}
            >
              <div className="p-8" style={card}>
                {stepContent[step]}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={step}
              // Step 0: rich unfold-in (fold + rise). Steps 1-4:
              // a page-turn flap (rotateY) between each "feature."
              initial={ isWelcome
                ? { opacity: 0, rotateX: -75, y: -60, scaleY: 0.08 }
                : { opacity: 0, rotateY: 90 } }
              animate={ isWelcome
                ? { opacity: 1, rotateX: 0, y: 0, scaleY: 1 }
                : { opacity: 1, rotateY: 0 } }
              exit={{ opacity: 0, rotateY: -90 }}
              transition={ isWelcome
                ? {
                    opacity: { duration: 0.3 },
                    y:       { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
                    rotateX: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
                    scaleY:  { type: 'spring', stiffness: 180, damping: 14, delay: 0.08 },
                  }
                : { type: 'spring', stiffness: 260, damping: 22 } }
              style={{
                transformOrigin: isWelcome ? 'top center' : 'left center',
                transformStyle:  'preserve-3d',
              }}
            >
              {/* Inner layer holds all blur/glass styling — kept
                  separate from the 3D-transformed outer layer, since
                  Safari silently flattens 3D transforms on any
                  element that also has backdrop-filter. */}
              <motion.div
                className="p-8"
                style={card}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: isWelcome ? 0.45 : 0.15, duration: 0.3 }}
              >
                {stepContent[step]}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        {showDots && (
          <div className="flex justify-center gap-2 mt-5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width:  i === step - 1 ? 20 : 6,
                  height: 6,
                  background: i === step - 1
                    ? 'rgb(var(--accent-500) / 0.90)'
                    : i < step - 1
                    ? 'rgb(var(--accent-500) / 0.40)'
                    : 'rgba(255,255,255,0.15)',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}