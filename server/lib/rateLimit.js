// lib/rateLimit.js
// Minimal in-memory sliding-window rate limiter. No Redis dependency —
// fine for a single-instance deployment (Render free tier, etc.). If you
// scale to multiple instances, swap this for a shared store (Redis).

const hits = new Map(); // key -> array of timestamps (ms)

// Periodically clear out stale entries so this Map doesn't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of hits.entries()) {
    const fresh = timestamps.filter((t) => now - t < 60 * 60 * 1000);
    if (fresh.length === 0) hits.delete(key);
    else hits.set(key, fresh);
  }
}, 10 * 60 * 1000).unref();

/**
 * Checks one or more rate-limit keys against their configured rules and
 * records a hit for each. Returns true if ANY of the keys is over its limit.
 *
 * @param {string[]} keys - distinct keys to check together (e.g. per-IP and per-email)
 * @param {Record<string, {max:number, windowMs:number}>} rulesByPrefix - matched by key prefix
 */
function rateLimit(keys, rulesByPrefix) {
  const now = Date.now();
  let limited = false;

  for (const key of keys) {
    const prefix = Object.keys(rulesByPrefix).find((p) => key.startsWith(p));
    const rule = prefix ? rulesByPrefix[prefix] : null;
    if (!rule) continue;

    const existing = hits.get(key) || [];
    const withinWindow = existing.filter((t) => now - t < rule.windowMs);

    if (withinWindow.length >= rule.max) {
      limited = true;
      hits.set(key, withinWindow); // don't record this attempt, it's already over
      continue;
    }

    withinWindow.push(now);
    hits.set(key, withinWindow);
  }

  return limited;
}

module.exports = { rateLimit };