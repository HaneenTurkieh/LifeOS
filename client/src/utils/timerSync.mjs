// utils/timerSync.mjs
export function computeFromServer(d, now = Date.now()) {
  let timeLeft  = d.remaining_seconds;
  let isRunning = false;
  let startedAt = null;
  if (d.running && d.started_at) {
    // started_at comes straight from SQLite's datetime('now') — a
    // zone-less "YYYY-MM-DD HH:MM:SS" string that's always UTC, but with
    // nothing in it to tell `new Date(...)` that. Without the T/Z fix
    // below, JS parses it as *local* time instead — for anyone east of
    // UTC (this app's audience skews UTC+2/+3), that makes `elapsed` come
    // out negative-ish-huge, which instantly clamps timeLeft to 0 and
    // isRunning to false. On a page reload or new tab mid-session, the
    // timer would just silently die with zero credit and no error shown —
    // this was very likely the still-unresolved "flow has an error"
    // report. Same fix already applied everywhere else in the app that
    // parses one of these datetime('now') strings.
    const startedAtMs = d.started_at.includes('T')
      ? new Date(d.started_at).getTime()
      : new Date(d.started_at.replace(' ', 'T') + 'Z').getTime();
    const elapsed = Math.floor((now - startedAtMs) / 1000);
    timeLeft  = Math.max(0, d.remaining_seconds - elapsed);
    isRunning = timeLeft > 0;
    startedAt = isRunning ? new Date(startedAtMs) : null;
  }
  return { timeLeft, totalTime: d.duration_seconds, isRunning, startedAt };
}
