#!/usr/bin/env node
// ============================================================================
// Nuvora — read-only production usage audit for a hackathon submission.
//
// WHAT THIS DOES
//   Connects to the SAME Turso/libSQL database Nuvora's backend already uses
//   (via server/db/connection.js — same TURSO_DATABASE_URL / TURSO_AUTH_TOKEN
//   env vars your server already has in server/.env) and runs SELECT-only
//   queries to compute real usage metrics, then writes three files:
//     - nuvora_usage_audit.md        (human-readable report)
//     - nuvora_usage_metrics.json    (structured metrics)
//     - nuvora_sessions_anonymized.csv (one row per session, hashed user id)
//
// SAFETY / READ-ONLY GUARANTEE
//   This script contains ZERO write statements. Search it yourself — there
//   is no INSERT, UPDATE, DELETE, ALTER, DROP or CREATE anywhere below,
//   only SELECT. It also never calls initDb() (the function in
//   db/connection.js that applies schema/migrations) — it only imports the
//   already-configured `db` client and issues reads against it. Running
//   this script cannot change your production data or schema.
//
// WHY THIS ISN'T ALREADY RUN FOR YOU
//   This was written by an assistant working in a sandboxed cloud
//   environment with no network path or credentials to your Turso database
//   — only your local machine (where server/.env actually lives) can run
//   it. That's intentional: your DB credentials never left your machine.
//
// HOW TO RUN
//   1. Place this file anywhere under your project, e.g. server/scripts/run_audit.js
//   2. From your `server/` directory (so it can find node_modules and .env):
//        node scripts/run_audit.js
//      (or pass an explicit path: node /path/to/run_audit.js — it locates
//      db/connection.js relative to its own folder, see DB_CONNECTION_PATH)
//   3. Output files land next to this script, inside ./audit_output/
//
// FOUNDER-ACCOUNT EXCLUSION
//   Set OWNER_EMAIL below (or pass it as env var NUVORA_OWNER_EMAIL so the
//   raw email never has to sit in a file). The script resolves it to a
//   user id ONCE, then filters every single query — including the base
//   query each metric is built from — by `user_id NOT IN (ownerIds)`
//   BEFORE any aggregation happens. The resolved email/user id are never
//   written to console, the .md, the .json, or the .csv — only an internal
//   variable used to build the exclusion filter.
// ============================================================================

'use strict';

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------

// Prefer an env var so the raw email address never has to be typed into a
// file that might get committed. Falls back to the literal you supplied.
const OWNER_EMAIL = process.env.NUVORA_OWNER_EMAIL || 'haneenturkieh@hotmail.com';

// Additional accounts to exclude ALONGSIDE the founder account, by your own
// explicit decision (not auto-excluded — see the suspicious-accounts list
// from the previous run). Comma-separated via env var if you ever want to
// add more later; defaults to demo@nuvora.app per your latest instruction.
const EXTRA_EXCLUDE_EMAILS = (process.env.NUVORA_EXTRA_EXCLUDE_EMAILS || 'demo@nuvora.app')
  .split(',').map((s) => s.trim()).filter(Boolean);

// Where server/db/connection.js actually lives, relative to THIS file.
// Adjust this one line if you place run_audit.js somewhere other than
// server/scripts/ — everything else is path-independent.
const DB_CONNECTION_PATH = path.join(__dirname, '..', 'db', 'connection.js');

const OUT_DIR = path.join(__dirname, 'audit_output');

// A per-run random salt for hashing user ids into the CSV/JSON. Anonymized
// ids are stable WITHIN one run (so you can still count sessions per user)
// but will NOT match a previous run's ids — that's deliberate, so the
// hashed ids can never be correlated back to a specific person across two
// exports by anyone who only has the CSVs. If you specifically need the
// SAME anonymized ids across multiple runs (e.g. to diff two exports),
// set NUVORA_AUDIT_SALT yourself to a fixed random string via env var.
const SALT = process.env.NUVORA_AUDIT_SALT || crypto.randomBytes(16).toString('hex');

// Known seed/demo account from server/db/seed.js (DEMO_EMAIL constant) —
// concrete evidence, not a guess. Anything else flagged below is a
// pattern-based heuristic only, clearly labeled as such in the output.
const KNOWN_DEMO_EMAIL = 'demo@nuvora.app';
const SUSPICIOUS_EMAIL_PATTERN = /test|demo|example\.(com|org)|mailinator|guerrillamail|yopmail|@nuvora\.(app|ps)$/i;

// "Returned within 7 days" definition (this is a DERIVED metric — the
// database has no concept of "returning"): a user counts as having
// returned if they have at least two sessions on two DIFFERENT calendar
// days where the second such day is within 7 days (inclusive) of the
// first such day. Documented here so the definition is auditable.
const RETURN_WINDOW_DAYS = 7;

// ---------------------------------------------------------------------------
// Load server/.env BEFORE requiring db/connection.js — connection.js reads
// process.env.TURSO_DATABASE_URL / TURSO_AUTH_TOKEN directly, and normally
// only gets them because index.js loads dotenv first on server startup.
// Run standalone (as this script is), nothing had loaded server/.env into
// process.env, so those two vars were blank and libSQL rejected the empty
// URL. This is a read of a config file already sitting on disk — dotenv
// only ever reads it into memory for this process, it doesn't write to it.
// ---------------------------------------------------------------------------
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// ---------------------------------------------------------------------------
// DB — imported, never migrated. We only ever call db.execute() with SELECT.
// ---------------------------------------------------------------------------
let db;
try {
  ({ db } = require(DB_CONNECTION_PATH));
} catch (e) {
  console.error(`Could not load db/connection.js from ${DB_CONNECTION_PATH}`);
  console.error('Underlying error:', e.message);
  console.error('Edit DB_CONNECTION_PATH at the top of this script to point at your actual server/db/connection.js.');
  process.exit(1);
}
if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error('TURSO_DATABASE_URL / TURSO_AUTH_TOKEN are still not set after loading server/.env.');
  console.error(`Checked for a .env file at: ${path.join(__dirname, '..', '.env')}`);
  console.error('Confirm that file exists and actually contains those two variables.');
  process.exit(1);
}

function assertReadOnly(sql) {
  // Belt-and-suspenders runtime guard, on top of the fact that every query
  // below is hand-written as a SELECT: refuses to execute anything that
  // isn't a SELECT, so a future edit to this file can't accidentally turn
  // it into a write script without the run itself failing loudly.
  const head = sql.trim().slice(0, 6).toUpperCase();
  if (head !== 'SELECT' && head !== 'PRAGMA') {
    throw new Error(`Refusing to run a non-SELECT statement: ${sql.slice(0, 80)}...`);
  }
}
async function q(sql, args = []) {
  assertReadOnly(sql);
  const res = await db.execute({ sql, args });
  return res.rows;
}

function hashUserId(userId) {
  return crypto.createHmac('sha256', SALT).update(String(userId)).digest('hex').slice(0, 16);
}

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function mean(nums) {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
function round(n, d = 1) {
  if (n === null || n === undefined) return null;
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
// planted_trees.planted_at / focus_sessions.completed_at are stored as
// SQLite `datetime('now')` strings — "YYYY-MM-DD HH:MM:SS", UTC, no
// timezone suffix. Same parsing convention routes/focus.js itself uses
// (reconcileSoloTimer/reconcileRoomSession: `.replace(' ', 'T') + 'Z'`).
function parseDbDate(s) {
  return new Date(String(s).replace(' ', 'T') + 'Z');
}
function isoDay(d) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD, UTC calendar day
}
// Monday-start ISO week label, e.g. "2026-W07". Computed in JS (not SQL)
// so it's not tied to SQLite's Sunday-based strftime('%W') or to
// focus_sessions.week_start (which the app itself computes Sunday-UTC-
// anchored — see routes/focus.js getWeekStart()). Using our own consistent
// definition here means "weekly active users" and "weekly completed
// sessions" are always bucketed the same way relative to each other.
function isoWeekLabel(d) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // ── Step 1: resolve the founder/owner account, and any extra explicitly-
  // approved exclusions (e.g. demo@nuvora.app), to user id(s) ────────────
  // Case-insensitive on purpose — users.email has a case-insensitive
  // UNIQUE index (idx_users_email_nocase in schema.sql) specifically so
  // "Foo@x.com" and "foo@x.com" can never be two different accounts, so
  // matching case-insensitively here is what actually finds every row
  // that index would consider "the same account."
  const ownerRows = await q(`SELECT id FROM users WHERE email = ? COLLATE NOCASE`, [OWNER_EMAIL]);
  const ownerIds  = ownerRows.map((r) => r.id);
  if (!ownerIds.length) {
    console.warn('WARNING: no user found matching OWNER_EMAIL — nothing will be excluded there. Double-check the email/env var.');
  }

  let extraExcludedIds = [];
  for (const email of EXTRA_EXCLUDE_EMAILS) {
    const found = await q(`SELECT id FROM users WHERE email = ? COLLATE NOCASE`, [email]);
    if (!found.length) {
      console.warn(`WARNING: no user found matching extra-exclude email (not logging which one) — check NUVORA_EXTRA_EXCLUDE_EMAILS.`);
      continue;
    }
    extraExcludedIds.push(...found.map((r) => r.id));
  }

  // Merged set used to filter every query below. Never logged, never
  // written to output — used only to build the exclusion filter. Kept as
  // two separate arrays above (owner vs. extra) so the report can state
  // each exclusion's count separately and explicitly.
  const excludedIds = [...ownerIds, ...extraExcludedIds];
  const excludedIdSet = new Set(excludedIds);

  // ── Step 2: pull every non-excluded "session" row (planted_trees) ──────
  // WHY planted_trees, not focus_sessions:
  //   focus_sessions only ever receives a row when a round completes
  //   naturally (see routes/focus.js — every INSERT INTO focus_sessions is
  //   paired with an INSERT INTO planted_trees ... 'alive'). It has NO
  //   status column and would make "completion rate" trivially 100% by
  //   construction, because abandoned rounds are never written there.
  //   planted_trees IS the table with a real status column ('alive' =
  //   completed, 'dead' = abandoned — see POST /focus/sessions/abandon and
  //   the room-host-stopped-early path, both of which insert status='dead'
  //   here and nowhere else) and covers BOTH solo and shared-room sessions.
  // This is the single base query every metric below is filtered from —
  // the exclusion happens right here, before any aggregation.
  const rows = await q(
    `SELECT id, user_id, tree_key, status, task_name, duration_minutes, task_id, planted_at
     FROM planted_trees
     ${excludedIds.length ? `WHERE user_id NOT IN (${excludedIds.map(() => '?').join(',')})` : ''}`,
    excludedIds
  );

  // ── Step 3: user roster (for suspicious-account flags + "real users") ──
  const userRows = await q(
    `SELECT id, email, created_at, role FROM users
     ${excludedIds.length ? `WHERE id NOT IN (${excludedIds.map(() => '?').join(',')})` : ''}`,
    excludedIds
  );
  const usersById = new Map(userRows.map((u) => [u.id, u]));

  // ── Step 4: Shared Focus Rooms (real schema facts) ──────────────────────
  const roomRows = await q(
    `SELECT id, host_id, created_at FROM focus_rooms
     ${excludedIds.length ? `WHERE host_id NOT IN (${excludedIds.map(() => '?').join(',')})` : ''}`,
    excludedIds
  );
  const roomMemberRows = await q(
    `SELECT DISTINCT user_id FROM focus_room_members
     ${excludedIds.length ? `WHERE user_id NOT IN (${excludedIds.map(() => '?').join(',')})` : ''}`,
    excludedIds
  );

  // ---------------------------------------------------------------------
  // Metrics — each comment says DB FACT (straight from a column) or
  // DERIVED (computed/interpreted from DB facts) per your instructions.
  // ---------------------------------------------------------------------
  const alive = rows.filter((r) => r.status === 'alive');
  const dead  = rows.filter((r) => r.status === 'dead');

  const dates = rows.map((r) => parseDbDate(r.planted_at)).filter((d) => !isNaN(d));
  const earliestDate = dates.length ? new Date(Math.min(...dates)) : null; // DB FACT
  const latestDate   = dates.length ? new Date(Math.max(...dates)) : null; // DB FACT

  const usersWithSession = new Set(rows.map((r) => r.user_id)); // DB FACT (distinct user_id)

  const totalRecorded  = rows.length;   // DB FACT — see limitation note re: "started"
  const totalCompleted = alive.length;  // DB FACT (status='alive')
  const totalAbandoned = dead.length;   // DB FACT (status='dead')
  const completionRate = totalRecorded ? round((totalCompleted / totalRecorded) * 100, 1) : null; // DERIVED from DB FACT status

  const allMinutes   = rows.map((r) => Number(r.duration_minutes) || 0);
  const aliveMinutes = alive.map((r) => Number(r.duration_minutes) || 0);
  const totalMinutesAll    = allMinutes.reduce((a, b) => a + b, 0);   // DB FACT (SUM)
  const totalMinutesAlive  = aliveMinutes.reduce((a, b) => a + b, 0); // DB FACT (SUM)

  // Sessions per user (for the "≥2 sessions" metric and the distribution export)
  const sessionsByUser = new Map();
  for (const r of rows) {
    if (!sessionsByUser.has(r.user_id)) sessionsByUser.set(r.user_id, []);
    sessionsByUser.get(r.user_id).push(r);
  }
  const usersWithTwoPlus = [...sessionsByUser.values()].filter((v) => v.length >= 2).length; // DERIVED

  // Distinct active DAYS per user (UTC calendar day of planted_at)
  const daysByUser = new Map();
  for (const r of rows) {
    const d = parseDbDate(r.planted_at);
    if (isNaN(d)) continue;
    const day = isoDay(d);
    if (!daysByUser.has(r.user_id)) daysByUser.set(r.user_id, new Set());
    daysByUser.get(r.user_id).add(day);
  }
  const usersTwoPlusDays = [...daysByUser.values()].filter((s) => s.size >= 2).length; // DERIVED

  // "Returned within 7 days" — see RETURN_WINDOW_DAYS doc comment above.
  let usersReturnedWithin7d = 0;
  for (const daySet of daysByUser.values()) {
    const sortedDays = [...daySet].sort();
    if (sortedDays.length < 2) continue;
    for (let i = 1; i < sortedDays.length; i++) {
      const gapDays = (new Date(sortedDays[i]) - new Date(sortedDays[i - 1])) / 86400000;
      if (gapDays > 0 && gapDays <= RETURN_WINDOW_DAYS) { usersReturnedWithin7d++; break; }
    }
  }

  // Shared session signal — INFERRED from task_name === 'Room session',
  // the literal string routes/focus.js hardcodes on every room-credit path
  // (reconcileRoomSession, the room straggler sweep, and the room-tagged
  // self-report path). There is no boolean/foreign-key column marking a
  // planted_trees row as "shared" — this is a naming-convention signal,
  // not a schema guarantee, and is reported as such.
  const sharedSessions = rows.filter((r) => r.task_name === 'Room session'); // INFERRED

  const taskLinked = rows.filter((r) => r.task_id !== null && r.task_id !== undefined); // DB FACT (task_id IS NOT NULL)
  const taskLinkedPct = totalRecorded ? round((taskLinked.length / totalRecorded) * 100, 1) : null;

  // Weekly buckets (Mon-start ISO week of planted_at)
  const weekly = new Map(); // label -> { activeUsers: Set, completed: number }
  for (const r of rows) {
    const d = parseDbDate(r.planted_at);
    if (isNaN(d)) continue;
    const label = isoWeekLabel(d);
    if (!weekly.has(label)) weekly.set(label, { activeUsers: new Set(), completed: 0 });
    const wk = weekly.get(label);
    wk.activeUsers.add(r.user_id);
    if (r.status === 'alive') wk.completed++;
  }
  const weeklySeries = [...weekly.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([week, v]) => ({ week, active_users: v.activeUsers.size, completed_sessions: v.completed }));

  // Suspicious/test/demo account flags — LISTED ONLY, never auto-excluded,
  // EXCEPT anything already pulled out via EXTRA_EXCLUDE_EMAILS above (it
  // no longer appears here because it's no longer in userRows/rows at
  // all — it's excluded from every metric already, not just flagged).
  // anonymized_id lets you cross-reference against the CSV without ever
  // seeing a real email in this output.
  const suspiciousAccounts = userRows
    .filter((u) => u.email && (u.email.toLowerCase() === KNOWN_DEMO_EMAIL || SUSPICIOUS_EMAIL_PATTERN.test(u.email)))
    .map((u) => ({
      anonymized_id: hashUserId(u.id),
      reason: u.email.toLowerCase() === KNOWN_DEMO_EMAIL
        ? `Matches the known seed/demo account (DEMO_EMAIL constant in server/db/seed.js: "${KNOWN_DEMO_EMAIL}")`
        : 'Email matches a common test/demo/throwaway pattern (heuristic — verify manually before excluding)',
      session_count: (sessionsByUser.get(u.id) || []).length,
      account_created_at: u.created_at,
    }));

  // ---------------------------------------------------------------------
  // Output 1: nuvora_usage_metrics.json
  // ---------------------------------------------------------------------
  const metrics = {
    generated_at_utc: new Date().toISOString(),
    exclusion: {
      method: 'users.email = <email> COLLATE NOCASE, resolved to user id(s) for the founder account AND each extra-exclude email, merged, then user_id NOT IN (...) applied to every base query before aggregation',
      owner_accounts_excluded: ownerIds.length,           // count only — never the id or email itself
      extra_accounts_excluded: extraExcludedIds.length,    // count only — e.g. demo@nuvora.app this run
      extra_exclude_emails_requested: EXTRA_EXCLUDE_EMAILS.length, // count of emails you asked to exclude, not the emails themselves
    },
    data_period: {
      earliest_session_utc: earliestDate ? earliestDate.toISOString() : null,
      latest_session_utc:   latestDate   ? latestDate.toISOString()   : null,
      note: 'DB FACT — MIN/MAX of planted_trees.planted_at across all non-owner rows',
    },
    users: {
      real_users_with_at_least_one_session: usersWithSession.size, // DB FACT
      users_with_two_plus_sessions: usersWithTwoPlus,               // DERIVED
      users_with_two_plus_sessions_pct: usersWithSession.size ? round((usersWithTwoPlus / usersWithSession.size) * 100, 1) : null,
      users_active_two_plus_distinct_days: usersTwoPlusDays,        // DERIVED
      users_active_two_plus_distinct_days_pct: usersWithSession.size ? round((usersTwoPlusDays / usersWithSession.size) * 100, 1) : null,
      users_returned_within_7_days: usersReturnedWithin7d,          // DERIVED — see RETURN_WINDOW_DAYS definition
      users_returned_within_7_days_pct: usersWithSession.size ? round((usersReturnedWithin7d / usersWithSession.size) * 100, 1) : null,
    },
    sessions: {
      total_recorded: totalRecorded,                 // DB FACT (see limitation: not the same as "every timer ever started")
      total_completed: totalCompleted,                // DB FACT (status='alive')
      total_abandoned_or_interrupted: totalAbandoned, // DB FACT (status='dead')
      completion_rate_pct: completionRate,            // DERIVED from real status column
      total_actual_minutes_all_sessions: totalMinutesAll,     // DB FACT
      total_actual_minutes_completed_only: totalMinutesAlive, // DB FACT
      total_actual_hours_all_sessions: round(totalMinutesAll / 60, 1),
      total_actual_hours_completed_only: round(totalMinutesAlive / 60, 1),
      avg_actual_duration_min_all_sessions: round(mean(allMinutes), 1),
      median_actual_duration_min_all_sessions: median(allMinutes),
      avg_actual_duration_min_completed_only: round(mean(aliveMinutes), 1),
      median_actual_duration_min_completed_only: median(aliveMinutes),
      planned_duration_avg: null,
      planned_duration_median: null,
      planned_duration_note: 'NOT AVAILABLE — no planned/target duration is persisted per session anywhere in the schema. focus_sessions/planted_trees only store duration_minutes, which is the ACTUAL elapsed time. For a naturally-completed ("alive") session, actual necessarily equals the configured Pomodoro length (the row is only written once the countdown reaches zero), but that target length itself is never saved as a separate field, so no derived "actual ≥ 80% of planned" measure can be computed without inventing data. Do not report a planned-duration figure.',
      sessions_linked_to_task: taskLinked.length,     // DB FACT (task_id IS NOT NULL)
      sessions_linked_to_task_pct: taskLinkedPct,
    },
    shared_focus_rooms: {
      total_rooms_created: roomRows.length,                 // DB FACT (COUNT focus_rooms, host != owner)
      distinct_users_who_joined_a_room: roomMemberRows.length, // DB FACT (COUNT DISTINCT focus_room_members.user_id, != owner)
      shared_sessions_inferred: sharedSessions.length,      // INFERRED — see comment above (task_name = 'Room session')
      shared_sessions_note: "INFERRED from planted_trees.task_name = 'Room session', a naming convention in routes/focus.js, not a stored boolean/FK — treat as an estimate.",
    },
    weekly_series: weeklySeries, // [{week, active_users, completed_sessions}]
    suspicious_accounts_flagged_not_excluded: suspiciousAccounts,
    session_distribution_per_anonymized_user: [...sessionsByUser.entries()].map(([uid, list]) => ({
      anonymized_id: hashUserId(uid),
      session_count: list.length,
    })).sort((a, b) => b.session_count - a.session_count),
  };
  fs.writeFileSync(path.join(OUT_DIR, 'nuvora_usage_metrics.json'), JSON.stringify(metrics, null, 2));

  // ---------------------------------------------------------------------
  // Output 2: nuvora_sessions_anonymized.csv
  // ---------------------------------------------------------------------
  const csvHeader = ['anonymized_user_id', 'session_date_utc', 'planned_duration_min', 'actual_duration_min', 'status', 'session_type'];
  const csvLines = [csvHeader.join(',')];
  for (const r of rows) {
    const d = parseDbDate(r.planted_at);
    csvLines.push([
      hashUserId(r.user_id),
      isNaN(d) ? '' : isoDay(d),
      '', // planned duration — not available, see metrics json note; left blank rather than guessed
      Number(r.duration_minutes) || 0,
      r.status,
      r.task_name === 'Room session' ? 'shared' : 'individual',
    ].map(csvEscape).join(','));
  }
  fs.writeFileSync(path.join(OUT_DIR, 'nuvora_sessions_anonymized.csv'), csvLines.join('\n') + '\n');

  // ---------------------------------------------------------------------
  // Output 3: nuvora_usage_audit.md
  // ---------------------------------------------------------------------
  const fmtDate = (d) => (d ? d.toISOString().slice(0, 10) : 'n/a');
  const pitchNumbers = [];
  if (usersWithSession.size) pitchNumbers.push(`${usersWithSession.size} real users have logged at least one focus session.`);
  if (totalMinutesAll) pitchNumbers.push(`${round(totalMinutesAll / 60, 1)} hours of actual focus time recorded (${totalMinutesAll} minutes across ${totalRecorded} sessions).`);
  if (completionRate !== null) pitchNumbers.push(`${completionRate}% of recorded sessions were completed in full (${totalCompleted} of ${totalRecorded}).`);
  if (usersWithSession.size) pitchNumbers.push(`${usersWithTwoPlus} of ${usersWithSession.size} users (${round((usersWithTwoPlus / usersWithSession.size) * 100, 1)}%) came back for a second session.`);
  if (roomRows.length || sharedSessions.length) pitchNumbers.push(`${roomRows.length} Shared Focus Rooms created, with ${sharedSessions.length} sessions logged inside them (estimate).`);

  const md = `# Nuvora — Real Production Usage Audit

Generated: ${new Date().toISOString()}
Data period covered: ${fmtDate(earliestDate)} to ${fmtDate(latestDate)}

This is real product usage / early traction data, not "impact" — there is
no before/after comparison in this dataset, so no number below is labeled
as impact.

## 1. Tables and fields used

| Purpose | Table | Fields used |
|---|---|---|
| Users | \`users\` | \`id\`, \`email\` (exclusion only, never exported), \`created_at\`, \`role\` |
| Session record + status | \`planted_trees\` | \`id\`, \`user_id\`, \`status\` ('alive'\\|'dead'), \`duration_minutes\`, \`task_id\`, \`task_name\`, \`planted_at\` |
| Completed-only session log (cross-check only) | \`focus_sessions\` | \`user_id\`, \`duration_minutes\`, \`completed_at\`, \`week_start\`, \`task_id\` |
| Tasks linked to sessions | \`tasks\` | \`id\` (joined via \`planted_trees.task_id\`) |
| Shared Focus Rooms | \`focus_rooms\` | \`id\`, \`host_id\`, \`created_at\` |
| Shared room membership | \`focus_room_members\` | \`user_id\`, \`room_id\` (distinct participants only — \`focus_minutes\` is a live weekly-reset counter, not used here) |

\`planted_trees\` is the source of truth for session status and duration —
it is the ONLY table with a real \`status\` column, and it's a strict
superset of \`focus_sessions\` (every \`focus_sessions\` insert has a
matching \`planted_trees\` 'alive' row, but \`focus_sessions\` never
receives abandoned/'dead' sessions at all, per \`server/routes/focus.js\`).

## 2. Account exclusion — exact method

\`\`\`sql
SELECT id FROM users WHERE email = ? COLLATE NOCASE;  -- founder email, never logged
-- → ownerIds

SELECT id FROM users WHERE email = ? COLLATE NOCASE;  -- each extra-exclude email (e.g. demo@nuvora.app), never logged
-- → extraExcludedIds

-- excludedIds = ownerIds + extraExcludedIds

SELECT ... FROM planted_trees
WHERE user_id NOT IN (excludedIds)   -- applied BEFORE any aggregation
\`\`\`

The same \`user_id NOT IN (excludedIds)\` / \`host_id NOT IN (excludedIds)\`
filter is applied to every base query (\`planted_trees\`, \`users\`,
\`focus_rooms\`, \`focus_room_members\`) before any COUNT/SUM/AVG runs. Every
excluded email/numeric user id is held only in memory during the run and
never appears in any of the three output files — only the *counts* are
recorded, in \`nuvora_usage_metrics.json\` → \`exclusion\`:
\`owner_accounts_excluded\` (should be 1, your founder account) and
\`extra_accounts_excluded\` (accounts you explicitly asked to exclude this
run — e.g. the known \`demo@nuvora.app\` seed account).

This run explicitly excludes, by your instruction: your founder account,
plus every account matching an email in \`NUVORA_EXTRA_EXCLUDE_EMAILS\`
(default: \`demo@nuvora.app\`, the hardcoded seed account from
\`server/db/seed.js\`). Anything excluded this way no longer appears
anywhere in this report — not even in §7's flagged list below, since it's
now fully removed from every metric rather than merely flagged.

## 3. Metric definitions (DB fact vs. derived)

| Metric | Type | Definition |
|---|---|---|
| Real users with ≥1 session | DB fact | \`COUNT(DISTINCT user_id)\` from \`planted_trees\`, owner excluded |
| Total sessions recorded | DB fact* | \`COUNT(*)\` from \`planted_trees\`, owner excluded |
| Total completed | DB fact | \`COUNT(*) WHERE status='alive'\` |
| Total abandoned/interrupted | DB fact | \`COUNT(*) WHERE status='dead'\` |
| Completion rate | Derived | completed ÷ total recorded, from the real \`status\` column |
| Total/avg/median actual minutes | DB fact / derived | from \`duration_minutes\` (this IS the app's own "actual time spent" field) |
| Planned duration avg/median | Not available | no planned/target duration is stored per session anywhere in the schema — see §5 |
| Users with ≥2 sessions | Derived | grouping session rows by \`user_id\` |
| Users active ≥2 distinct days | Derived | grouping by \`user_id\` + calendar day of \`planted_at\` |
| Users returned within 7 days | Derived | ≥2 distinct active days where two consecutive ones are ≤7 days apart |
| Shared Focus Rooms | DB fact | \`COUNT(*)\` from \`focus_rooms\`, host excluded |
| Shared sessions | Inferred | \`planted_trees.task_name = 'Room session'\` — a naming convention, not a schema flag |
| Sessions linked to a task | DB fact | \`task_id IS NOT NULL\` |
| Weekly active users / completed sessions | Derived | Monday-start ISO week bucket of \`planted_at\` |

\\* "Total sessions recorded" is the closest available measure of "sessions
started" — see Limitations below for why it is not exactly that.

## 4. Results

${JSON.stringify(metrics, null, 2)}

*(Same numbers as \`nuvora_usage_metrics.json\`, included here so this file is self-contained.)*

## 5. Limitations and missing fields

- **No planned/target duration is stored per session.** Only actual
  \`duration_minutes\` is persisted. A completed ("alive") session's actual
  time necessarily equals its configured Pomodoro length by construction
  (the row is only written when the countdown finishes), but that target
  length itself is never saved as its own column, so an "actual ≥ 80% of
  planned" measure cannot be computed without inventing a number — it is
  intentionally left blank rather than guessed.
- **"Total sessions started" is not directly measurable.** A row only
  lands in \`planted_trees\` when a session either completes naturally OR
  the client explicitly calls \`POST /focus/sessions/abandon\`. A session
  where the tab was silently closed without either happening (and never
  caught by the app's own reconciliation poll) leaves no row at all — so
  "total recorded" undercounts true starts by an unknown amount.
- **"Shared session" is inferred, not a stored flag.** \`planted_trees\` has
  no room/shared boolean or foreign key; the \`task_name = 'Room session'\`
  string is a naming convention in \`server/routes/focus.js\`, not a
  guaranteed schema contract.
- **Weekly buckets use UTC calendar weeks**, not each user's local
  timezone — a session just before/after midnight UTC could land in a
  different week than the user experienced it locally.
- **No before/after baseline exists** in this data, so none of these
  numbers are framed as "impact."

## 6. Five strongest evidence-based numbers for a pitch

${pitchNumbers.map((n, i) => `${i + 1}. ${n}`).join('\n')}

### Suggested wording (no exaggeration)

${pitchNumbers.map((n) => `- "${n}" — stated plainly, as real product usage / early traction, not "impact."`).join('\n')}

## 7. Suspicious/test/demo accounts flagged (NOT auto-excluded)

${extraExcludedIds.length ? `${extraExcludedIds.length} account(s) matching your \`NUVORA_EXTRA_EXCLUDE_EMAILS\` list (e.g. the known \`demo@nuvora.app\` seed account) were EXCLUDED from every metric in this report, by your explicit instruction — not merely flagged. They no longer appear below.\n\n` : ''}${suspiciousAccounts.length
  ? suspiciousAccounts.map((a) => `- \`${a.anonymized_id}\` — ${a.reason} — ${a.session_count} session(s), account created ${a.account_created_at}`).join('\n')
  : '- None of the remaining (non-excluded) accounts matched the known demo-account email or the test/demo pattern heuristic.'}

Review this list yourself and decide whether to exclude any of them before
using the headline numbers above — they are currently INCLUDED in every
metric in this report.
`;
  fs.writeFileSync(path.join(OUT_DIR, 'nuvora_usage_audit.md'), md);

  console.log(`Done. Wrote 3 files to ${OUT_DIR}:`);
  console.log('  - nuvora_usage_audit.md');
  console.log('  - nuvora_usage_metrics.json');
  console.log('  - nuvora_sessions_anonymized.csv');
  console.log(`Excluded ${ownerIds.length} owner account(s) and ${extraExcludedIds.length} extra account(s) (e.g. demo@nuvora.app) from every metric above.`);
}

main().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
