const { db }        = require('../db/connection');
const { isPremium } = require('./premium');

// Daily caps for the AI calls that actually cost money to run, sized to
// roughly match relative cost rather than being a flat number everywhere:
//   - exam_generate: one Haiku call, but up to 8192 output tokens — the
//     core hook feature, so it gets the most generous free allowance.
//   - deep_think:    extended thinking (4000 token budget) on top of a
//     6000-token cap — several times pricier than a plain chat turn.
//   - deep_search:   the web_search tool carries its own per-search fee
//     on top of tokens, and a single question can trigger multiple
//     searches across the tool-use loop — the priciest single action in
//     the app, so it gets the tightest cap.
// Regular chat is deliberately not in this list — it's cheap and it's
// the daily-habit feature, so it stays unlimited for everyone.
//   - ai_review:     'review' mode on /chat — the CV Builder review and
//     Projects "break into tasks" both reuse the chat endpoint with
//     forced 'high' reasoning effort (see chat.js). This used to have NO
//     limit at all: 'review' isn't a mode either of those pages' own UI
//     ever exposes a picker for, but the /chat endpoint itself can't tell
//     an internal call from any other authenticated request with
//     mode:'review' in the body — so it was a free, unmetered path to
//     forced extended reasoning for anyone who knew to send it directly.
//   - file_extract:  /exam/extract's PDF and image branches call Gemini
//     directly (up to 8192 output tokens) — real AI cost with no cap
//     before this. Its txt/docx/pptx branches parse locally with no AI
//     call at all, so those stay ungated; only the two Gemini-calling
//     paths count against this.
//   - anti_proc:     /ai/anti-procrastination — cheap and meant to be
//     low-volume (one click on one stuck task), but had zero limit at
//     all, unlike every other real AI-cost route in the app.
//   - study_chat:    /exam/chat — same cheap DeepSeek model as exam_generate,
//     but re-sends the full source material (up to ~20k chars) on every
//     single turn since there's no server-side session to hold it, so a
//     back-and-forth conversation costs meaningfully more overall than one
//     exam_generate call. Still meant to be used repeatedly through an
//     actual study session (that's the point of a chat), so it gets a much
//     higher daily count than exam_generate rather than the same cap.
const LIMITS = {
  exam_generate: 5,
  deep_think:    4,
  deep_search:   2,
  ai_review:     6,
  file_extract:  8,
  anti_proc:     15,
  study_chat:    30,
};

const FEATURE_LABEL = {
  exam_generate: 'exam and slide generation',
  deep_think:    'Deep Think',
  deep_search:   'Deep Search',
  ai_review:     'AI review',
  file_extract:  'file extraction',
  anti_proc:     "feeling stuck? suggestions",
  study_chat:    'study chat',
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// New-account grace period — a brand-new user's first days are when they
// explore hardest to decide if the app is worth keeping. Hitting a usage
// cap right then, before anything's been proven to them, is the single
// worst moment for it to happen. So caps simply don't apply yet for the
// first GRACE_PERIOD_DAYS after signup — the meter only starts once
// someone's actually stuck around a little.
const GRACE_PERIOD_DAYS = 5;

async function isInGracePeriod(userId) {
  const row = (await db.execute({
    sql: `SELECT created_at FROM users WHERE id = ?`, args: [userId],
  })).rows[0];
  if (!row?.created_at) return false;
  // SQLite's datetime('now') default gives "YYYY-MM-DD HH:MM:SS" in UTC
  // with no timezone marker — new Date() on that raw string parses
  // inconsistently across engines, so it's converted to a proper ISO
  // string first.
  const createdAt = new Date(row.created_at.replace(' ', 'T') + 'Z');
  if (Number.isNaN(createdAt.getTime())) return false;
  const ageMs = Date.now() - createdAt.getTime();
  return ageMs < GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
}

// Read-only — call before doing the expensive work, to decide whether to
// let the request through at all.
async function checkLimit(userId, feature) {
  const limit = LIMITS[feature];
  if (!limit) return { allowed: true, remaining: Infinity, limit: Infinity };
  if (await isPremium(userId)) return { allowed: true, remaining: Infinity, limit: Infinity };
  if (await isInGracePeriod(userId)) return { allowed: true, remaining: Infinity, limit: Infinity };
  const row = (await db.execute({
    sql:  `SELECT count FROM feature_usage WHERE user_id = ? AND feature = ? AND date = ?`,
    args: [userId, feature, todayIso()],
  })).rows[0];
  const used = Number(row?.count || 0);
  return { allowed: used < limit, remaining: Math.max(0, limit - used), limit };
}

// Only call after the AI request actually succeeded — a failed
// generation shouldn't burn part of someone's daily allowance.
async function recordUsage(userId, feature) {
  if (!LIMITS[feature]) return;
  if (await isPremium(userId)) return;
  await db.execute({
    sql:  `INSERT INTO feature_usage (user_id, feature, date, count) VALUES (?, ?, ?, 1)
           ON CONFLICT(user_id, feature, date) DO UPDATE SET count = count + 1`,
    args: [userId, feature, todayIso()],
  });
}

function limitMessage(feature, limit) {
  return `You've used all ${limit} free ${FEATURE_LABEL[feature] || feature} requests for today. Upgrade to Premium for unlimited access, or come back tomorrow.`;
}

module.exports = { LIMITS, checkLimit, recordUsage, limitMessage, isInGracePeriod, GRACE_PERIOD_DAYS };
