// Tiny Web Audio "ding" sounds — no audio files needed, generated on the
// fly. Browsers block audio before any user interaction, so failures are
// expected and silently ignored (e.g. on first page load before a click).
function playTone(frequency, duration, volume = 0.15) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = frequency;
    osc.type = 'sine';
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio blocked or unsupported — fail silently, not critical.
  }
}

export function playReminderSound() {
  playTone(880, 0.4);
}

// A quick rising two-note "ding-ding" for task completion — more
// celebratory than the single reminder tone.
export function playCompletionSound() {
  playTone(660, 0.15);
  setTimeout(() => playTone(990, 0.25), 120);
}
