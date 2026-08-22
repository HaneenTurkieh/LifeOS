import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, X } from 'lucide-react';
import { useFocus, MODES } from '../context/FocusContext.jsx';

export default function FocusBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const focus    = useFocus();

  if (!focus) return null;

  const { mode, timeLeft, totalTime, isRunning, taskName, toggleTimer, resetTimer } = focus;

  // Only show when timer has been started and user is NOT on the flow page.
  // Also suppressed on /ai: Lumi's chat composer is a full-width, bottom-
  // docked bar with its own Send button in the exact same corner this
  // pill docks in — on a narrow phone screen there's no room for both,
  // and this pill's own tap target (navigate to Flow) was landing right
  // on top of Send, blocking it. Nothing lost by hiding it here since
  // you're not going to start typing a message AND jump to the Flow page
  // in the same breath.
  const isOnFlowPage = location.pathname === '/learning' || location.pathname === '/ai';
  const hasStarted   = totalTime > timeLeft || isRunning;

  if (isOnFlowPage || !hasStarted) return null;

  const mm         = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const ss         = String(timeLeft % 60).padStart(2, '0');
  const progress   = totalTime > 0 ? (totalTime - timeLeft) / totalTime : 0;
  // Defensive fallback — MODES[mode] should always exist now that
  // FocusContext validates `mode` on load, but this is the same
  // unguarded-lookup crash pattern that broke the whole app, so it gets
  // a fallback here too rather than trusting every future caller.
  const modeColor  = MODES[mode]?.color || MODES.focus.color;
  const R          = 13, CIRC = 2 * Math.PI * R;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className="fixed bottom-20 lg:bottom-6 right-4 lg:right-6 z-[80] flex items-center gap-3 rounded-2xl px-4 py-2.5 cursor-pointer"
        style={{
          background:           'linear-gradient(145deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.12) 100%)',
          backdropFilter:       'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          border:               `1px solid ${modeColor}44`,
          boxShadow:            `0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(255,255,255,0.5) inset, 0 2px 0 rgba(255,255,255,0.6) inset`,
          // Same fixed + backdrop-filter combination MobileNav.jsx just
          // got fixed for (WebKit can leave a blurred `position: fixed`
          // element rendering at a stale scroll offset for a frame or
          // two). willChange (not a literal transform, unlike
          // MobileNav's plain <nav>) — this is a motion.div already
          // animating its own x/y/opacity via Framer Motion, which owns
          // the `transform` property directly; willChange just hints
          // the browser to give it its own GPU layer without fighting
          // Framer's own transform management.
          willChange:           'transform',
        }}
        onClick={() => navigate('/learning')}
      >
        {/* Mini ring */}
        <div className="relative shrink-0" style={{ width: 34, height: 34 }}>
          <svg width="34" height="34">
            <circle cx="17" cy="17" r={R} fill="none" stroke="rgba(255,255,255,0.20)" strokeWidth="2.5" />
            <circle cx="17" cy="17" r={R} fill="none"
              stroke={modeColor} strokeWidth="2.5" strokeLinecap="round"
              strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - progress)}
              transform="rotate(-90 17 17)"
              style={{ transition: 'stroke-dashoffset 0.8s ease', filter: `drop-shadow(0 0 3px ${modeColor}88)` }}
            />
          </svg>
          {isRunning && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: modeColor }} />
            </span>
          )}
        </div>

        {/* Time + task */}
        <div className="flex flex-col min-w-0" onClick={(e) => e.stopPropagation()}>
          <span className="font-mono font-bold text-sm text-ink dark:text-white tabular-nums leading-none">
            {mm}:{ss}
          </span>
          <span className="text-[10px] text-ink/45 dark:text-white/35 truncate max-w-[100px]">
  {taskName.trim() ? taskName.trim() : `${MODES[mode]?.emoji || MODES.focus.emoji} ${MODES[mode]?.label || MODES.focus.label}`}
</span>
        </div>

        {/* Play/Pause */}
        <button
          onClick={(e) => { e.stopPropagation(); toggleTimer(); }}
          className="flex h-7 w-7 items-center justify-center rounded-xl text-white shrink-0"
          style={{
            background:   `linear-gradient(145deg, ${modeColor}DD 0%, ${modeColor}99 100%)`,
            boxShadow:    `0 3px 10px ${modeColor}44, inset 0 1px 0 rgba(255,255,255,0.40)`,
          }}>
          {isRunning
            ? <Pause size={11} className="text-white" />
            : <Play  size={11} className="text-white ml-0.5" />}
        </button>

        {/* Close / reset */}
        <button
          onClick={(e) => { e.stopPropagation(); resetTimer(); }}
          className="flex h-7 w-7 items-center justify-center rounded-xl shrink-0"
          style={{ background: 'rgba(0,0,0,0.06)' }}>
          <X size={11} className="text-ink/40 dark:text-white/40" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}