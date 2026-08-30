-- Personal Life Dashboard — SQLite schema
-- Keep it simple and readable: every table maps 1:1 to a feature on the UI.
-- Every user-owned table has a user_id column scoping rows to one account.

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Case-insensitive uniqueness on top of the column-level UNIQUE above.
-- "Foo@x.com" and "foo@x.com" must never both exist as separate accounts.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_nocase ON users(email COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,                          -- SHA-256 of the raw token; raw token is NEVER stored
  expires_at  TEXT NOT NULL,
  used_at     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_user ON password_reset_tokens(user_id);

CREATE TABLE IF NOT EXISTS tasks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT DEFAULT '',
  priority      TEXT NOT NULL DEFAULT 'medium',   -- low | medium | high
  category      TEXT NOT NULL DEFAULT 'general',
  deadline      TEXT,                             -- ISO date, nullable
  deadline_time TEXT,                             -- "HH:MM" 24h format, nullable
  status        TEXT NOT NULL DEFAULT 'todo',     -- todo | doing | done
  progress      INTEGER NOT NULL DEFAULT 0,
  position      INTEGER NOT NULL DEFAULT 0,       -- order within a column
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at  TEXT
);

CREATE TABLE IF NOT EXISTS habits (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  icon            TEXT NOT NULL DEFAULT 'Sparkles',
  color           TEXT NOT NULL DEFAULT '#6366F1',
  target_per_week INTEGER NOT NULL DEFAULT 7,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS habit_logs (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  habit_id  INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date      TEXT NOT NULL,                        -- ISO date (YYYY-MM-DD)
  completed INTEGER NOT NULL DEFAULT 1,
  UNIQUE(habit_id, date)
);

-- Append-only record of which (habit_id, date) pairs have ever had XP paid
-- out for them, so toggling a habit on/off repeatedly on the same day
-- can't farm XP — see connection.js migrations for the full explanation.
CREATE TABLE IF NOT EXISTS habit_xp_grants (
  habit_id INTEGER NOT NULL,
  date     TEXT NOT NULL,
  PRIMARY KEY (habit_id, date)
);

CREATE TABLE IF NOT EXISTS goals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT DEFAULT '',
  category    TEXT NOT NULL DEFAULT 'personal',
  target_date TEXT,
  status      TEXT NOT NULL DEFAULT 'active',     -- active | completed
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS milestones (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id   INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title     TEXT NOT NULL,
  done      INTEGER NOT NULL DEFAULT 0,
  position  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS learning_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL DEFAULT 'course',      -- course | book | certification
  title      TEXT NOT NULL,
  provider   TEXT DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'planned',     -- planned | in_progress | completed
  progress   INTEGER NOT NULL DEFAULT 0,
  notes      TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS moods (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date    TEXT NOT NULL,
  mood    INTEGER NOT NULL,                       -- 1..5
  note    TEXT DEFAULT '',
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS internships (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company      TEXT NOT NULL,
  role         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'applied',   -- applied | interview | accepted | rejected
  applied_date TEXT,
  notes        TEXT DEFAULT '',
  link         TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS cv_projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT DEFAULT '',
  tech        TEXT DEFAULT '',
  link        TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS cv_skills (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  level    TEXT NOT NULL DEFAULT 'intermediate',  -- beginner | intermediate | advanced
  category TEXT NOT NULL DEFAULT 'technical'
);

CREATE TABLE IF NOT EXISTS cv_certifications (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title   TEXT NOT NULL,
  issuer  TEXT DEFAULT '',
  date    TEXT,
  link    TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT DEFAULT '',
  stage       TEXT NOT NULL DEFAULT 'idea',       -- idea | design | development | testing | deployment
  progress    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS xp_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount     INTEGER NOT NULL,
  reason     TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Static catalogue of every achievement that exists in the app (not user-specific).
CREATE TABLE IF NOT EXISTS achievements (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  key         TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  icon        TEXT NOT NULL DEFAULT 'Award'
);

-- Which achievements each user has unlocked, and when.
CREATE TABLE IF NOT EXISTS user_achievements (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key          TEXT NOT NULL REFERENCES achievements(key),
  unlocked_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, key)
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- ── Lumi: per-user personality settings ────────────────────────
CREATE TABLE IF NOT EXISTS lumi_settings (
  user_id         INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tone            TEXT NOT NULL DEFAULT 'friendly',
  response_length TEXT NOT NULL DEFAULT 'balanced',
  emoji_level     TEXT NOT NULL DEFAULT 'some',
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Exam Assistant: saved sessions ─────────────────────────────
-- Every generated exam/flashcard/slide set is stored here so it
-- survives refresh and shows in "Past sessions".
CREATE TABLE IF NOT EXISTS exam_sessions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode        TEXT NOT NULL,                       -- mcq | blanks | mixed | flashcards | slides
  difficulty  TEXT NOT NULL DEFAULT 'medium',
  source_name TEXT DEFAULT '',                     -- filename or note snippet
  item_count  INTEGER NOT NULL DEFAULT 0,
  payload     TEXT NOT NULL,                       -- questions/cards/slides as JSON
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_user ON exam_sessions(user_id);

-- ── Forest: trees planted per completed session (Forest-style) ─
-- One row per session: 'alive' when completed, 'dead' when the
-- user quits mid-session.
CREATE TABLE IF NOT EXISTS planted_trees (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tree_key         TEXT NOT NULL DEFAULT 'seedling',
  status           TEXT NOT NULL DEFAULT 'alive',    -- alive | dead
  task_name        TEXT DEFAULT '',
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  planted_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_planted_trees_user ON planted_trees(user_id);

-- Idempotency guard for POST /focus/sessions — see connection.js
-- migrations for the full explanation (two devices open on the same
-- account both reporting the same completed timer round used to double
-- the XP/tree credit for it).
CREATE TABLE IF NOT EXISTS focus_session_credits (
  user_id    INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, started_at)
);

-- ── Premium tier (no payments yet — backend flag + streak freeze)
CREATE TABLE IF NOT EXISTS user_premium (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  is_premium  INTEGER NOT NULL DEFAULT 0,
  freeze_date TEXT                                    -- date excused from streak
);

-- ── Shared room timer (synced Forest-style pomodoro) ───────────
CREATE TABLE IF NOT EXISTS focus_room_timer (
  room_id          INTEGER PRIMARY KEY,
  started_at       TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  mode             TEXT NOT NULL DEFAULT 'focus',
  running          INTEGER NOT NULL DEFAULT 0
);
-- ── Shared room tree (Forest-style, ONE tree for the whole room) ─
-- Reset every time the host starts a new synced session. If any
-- member leaves while the session is running, the tree dies for
-- everyone; if the session completes naturally, it survives.
CREATE TABLE IF NOT EXISTS focus_room_tree (
  room_id      INTEGER PRIMARY KEY,
  tree_key     TEXT NOT NULL DEFAULT 'seedling',
  status       TEXT NOT NULL DEFAULT 'none',      -- none | alive | dead | completed
  died_by_name TEXT,
  started_at   TEXT,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Instructor/Student classroom system ─────────────────────────
-- A channel is one instructor's "class" — students join it with a
-- short code (emailed or shared directly). The channel is read-only
-- for students (see channel_messages): only the owning instructor can
-- post announcements or assign work. Assigned tasks/goals are plain
-- rows in the normal tasks/goals tables (see their assigned_by/
-- channel_id columns, added via migration in connection.js) so they
-- show up in a student's existing Tasks/Calendar/Goals views with zero
-- extra client-side plumbing — the channel is just the label on who
-- created them and where they came from.
CREATE TABLE IF NOT EXISTS channels (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  instructor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  join_code     TEXT NOT NULL UNIQUE,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_channels_instructor ON channels(instructor_id);

CREATE TABLE IF NOT EXISTS channel_members (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(channel_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_channel_members_channel ON channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_student ON channel_members(student_id);

-- Read-only announcement feed — only the instructor (channel owner) is
-- ever allowed to insert here (enforced in routes/channels.js), never
-- students, which is the literal "no one can type but the admins"
-- requirement.
CREATE TABLE IF NOT EXISTS channel_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  sender_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  event_date TEXT DEFAULT NULL,    -- optional "this is about" date, e.g. a deadline the announcement refers to
  event_time TEXT DEFAULT NULL,    -- "HH:MM", only meaningful alongside event_date
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_channel_messages_channel ON channel_messages(channel_id);

-- One Google account connection per instructor — access/refresh tokens
-- for the Sheets sync (see lib/googleSheets.js). expires_at is stored as
-- an epoch-ms INTEGER (not the app's usual TEXT datetime('now') format)
-- specifically so it can be compared directly against JS Date.now() —
-- this app has hit real bugs elsewhere from mixing datetime string
-- formats (see connection.js's forgot-password migration comment); a
-- token refresh check is exactly the kind of precise-instant comparison
-- that format mismatch bites hardest, so this sidesteps it entirely.
-- Real two-way messaging between an instructor and one student in their
-- channel — separate from channel_messages (the read-only broadcast
-- announcement feed above). One thread per (channel, student) pair;
-- student_id always identifies the thread even when sender_id is the
-- instructor, so both sides query the exact same rows.
CREATE TABLE IF NOT EXISTS channel_chat_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id  INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  student_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL,   -- 'instructor' | 'student' — who sent it
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_channel_chat_thread ON channel_chat_messages(channel_id, student_id);

CREATE TABLE IF NOT EXISTS google_sheets_tokens (
  user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  access_token  TEXT NOT NULL,
  refresh_token TEXT,
  expires_at    INTEGER NOT NULL,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);