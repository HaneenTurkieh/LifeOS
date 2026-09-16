import { useEffect, useRef } from 'react';

const CHECK_INTERVAL_MS = 60 * 1000; // background tabs throttle this further — fine, worst case a few extra minutes before it notices
const todayLocal = () => new Date().toLocaleDateString('en-CA');

// Real bug this fixes: "Nuvora doesn't refresh for the next day until I
// refresh it manually." Every "today" in this app is computed client-side
// with `new Date().toLocaleDateString('en-CA')` (Dashboard, Focus, AITools,
// the mood picker, ...), but only at the moment each piece of data is
// fetched — Dashboard's own `load()`, for instance, only ever runs once via
// `useEffect(() => { load(); }, [load])` with `load`'s own deps frozen at
// `[]`. Leave a tab open (or just close the laptop overnight, which is the
// far more common real case) across local midnight and every page keeps
// showing yesterday's tasks/mood/streaks until something remounts it — a
// manual refresh, or navigating away and back. Patching every individual
// page's fetch logic to re-run on a date change would mean threading a
// shared "today" value through Dashboard, Focus, AITools, and anything
// added later; reloading the whole SPA the moment the local calendar date
// actually changes gets the same result — every page's mount-time "today"
// logic reruns fresh — without needing each page to know this exists.
//
// Two separate triggers, not one, because "tab stays open and awake right
// through midnight" is actually the RARER case for how people use a
// laptop — most real days start with the lid having been closed overnight
// (JS timers don't run while asleep), so the tab wakes up already sitting
// on the wrong day with no midnight moment having ever fired inside it.
// visibilitychange catches that the instant she looks at the tab again;
// the interval is the fallback for the tab genuinely staying open and
// visible straight through midnight.
export default function useDateRollover({ isRunning } = {}) {
  const lastDateRef = useRef(todayLocal());
  // Mirrors the latest `isRunning` into a ref the effect can read without
  // needing it in its dependency array — re-running the effect (tearing
  // down and re-adding the listeners) every time a Flow session starts or
  // stops would be pointless churn for something that only matters at the
  // one moment a reload is actually being considered.
  const isRunningRef = useRef(isRunning);
  isRunningRef.current = isRunning;

  useEffect(() => {
    const checkAndReload = () => {
      const current = todayLocal();
      if (current === lastDateRef.current) return;
      // Don't yank the page out from under an active Flow/Pomodoro session
      // — it may be a room synced with other people, not just her own
      // timer — or while she's mid-typing something. Leave lastDateRef
      // stale in either case so the very next check (next minute, or the
      // next time the tab becomes visible) tries again instead of
      // silently giving up on ever refreshing.
      if (isRunningRef.current) return;
      const active = document.activeElement;
      const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
      if (isTyping) return;
      lastDateRef.current = current;
      window.location.reload();
    };

    const onVisible = () => { if (document.visibilityState === 'visible') checkAndReload(); };
    document.addEventListener('visibilitychange', onVisible);
    const interval = setInterval(checkAndReload, CHECK_INTERVAL_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
  }, []);
}
