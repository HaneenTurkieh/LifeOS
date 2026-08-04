// utils/timerSync.mjs
export function computeFromServer(d, now = Date.now()) {
  let timeLeft  = d.remaining_seconds;
  let isRunning = false;
  let startedAt = null;
  if (d.running && d.started_at) {
    const elapsed = Math.floor((now - new Date(d.started_at).getTime()) / 1000);
    timeLeft  = Math.max(0, d.remaining_seconds - elapsed);
    isRunning = timeLeft > 0;
    startedAt = isRunning ? new Date(d.started_at) : null;
  }
  return { timeLeft, totalTime: d.duration_seconds, isRunning, startedAt };
}
