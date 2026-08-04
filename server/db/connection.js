// db/connection.js
const { createClient } = require('@libsql/client');
const fs   = require('fs');
const path = require('path');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const db = createClient({
  url:       process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function hasColumn(table, column) {
  const result = await db.execute(`PRAGMA table_info(${table})`);
  return result.rows.some((c) => c.name === column);
}

async function initDb() {
  await db.execute('PRAGMA foreign_keys = ON');

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  const schemaWithoutEmailIndex = schema.replace(
    /CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_nocase[^;]*;/,
    ''
  );
  await db.executeMultiple(schemaWithoutEmailIndex);

  if (!(await hasColumn('tasks', 'deadline_time'))) {
    await db.execute('ALTER TABLE tasks ADD COLUMN deadline_time TEXT');
  }
  const USER_SCOPED_TABLES = [
    'tasks', 'habits', 'goals', 'learning_items', 'internships',
    'cv_projects', 'cv_skills', 'cv_certifications', 'projects', 'xp_log',
  ];
  for (const table of USER_SCOPED_TABLES) {
    if (!(await hasColumn(table, 'user_id'))) {
      await db.execute(`ALTER TABLE ${table} ADD COLUMN user_id INTEGER`);
    }
  }
  if (!(await hasColumn('tasks', 'recurrence'))) {
    await db.execute(`ALTER TABLE tasks ADD COLUMN recurrence TEXT DEFAULT NULL`);
  }
  const PROFILE_COLS = ['avatar', 'gender', 'birthday', 'bio'];
  for (const col of PROFILE_COLS) {
    if (!(await hasColumn('users', col))) {
      await db.execute(`ALTER TABLE users ADD COLUMN ${col} TEXT DEFAULT NULL`);
    }
  }
  if (!(await hasColumn('user_premium', 'theme_preset'))) {
    await db.execute(`ALTER TABLE user_premium ADD COLUMN theme_preset TEXT DEFAULT 'purple'`);
  }
  if (!(await hasColumn('user_premium', 'theme_mode'))) {
    await db.execute(`ALTER TABLE user_premium ADD COLUMN theme_mode TEXT DEFAULT 'system'`);
  }
  if (!(await hasColumn('user_premium', 'font_scale'))) {
    await db.execute(`ALTER TABLE user_premium ADD COLUMN font_scale TEXT DEFAULT 'default'`);
  }
  if (!(await hasColumn('focus_room_tree', 'died_reason'))) {
    await db.execute(`ALTER TABLE focus_room_tree ADD COLUMN died_reason TEXT DEFAULT 'left'`);
  }

  if (!(await hasColumn('moods', 'user_id'))) {
    await db.batch([
      { sql: 'ALTER TABLE moods RENAME TO moods_old' },
      {
        sql: `CREATE TABLE moods (
          id      INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          date    TEXT NOT NULL,
          mood    INTEGER NOT NULL,
          note    TEXT DEFAULT '',
          UNIQUE(user_id, date)
        )`,
      },
      {
        sql: `INSERT INTO moods (id, user_id, date, mood, note)
              SELECT id, NULL, date, mood, note FROM moods_old`,
      },
      { sql: 'DROP TABLE moods_old' },
    ], 'write');
  }

  const dupResult = await db.execute(`
    SELECT LOWER(email) AS lemail, COUNT(*) AS c, GROUP_CONCAT(id) AS ids
    FROM users
    GROUP BY LOWER(email)
    HAVING c > 1
  `);
  if (dupResult.rows.length > 0) {
    console.warn(`⚠️  Found ${dupResult.rows.length} email address(es) with case-duplicate accounts.`);
    for (const group of dupResult.rows) {
      const ids = String(group.ids).split(',').map(Number).sort((a, b) => a - b);
      const [keepId, ...duplicateIds] = ids;
      for (const id of duplicateIds) {
        const domain = String(group.lemail).split('@')[1] || 'invalid.local';
        const quarantinedEmail = `quarantined+dup${id}_${Date.now()}@${domain}`;
        await db.execute({ sql: 'UPDATE users SET email = ? WHERE id = ?', args: [quarantinedEmail, id] });
        console.warn(`   → user id ${id} (dup of "${group.lemail}", kept id ${keepId}) → ${quarantinedEmail}`);
      }
    }
  }
  await db.execute(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_nocase ON users(email COLLATE NOCASE)'
  );

  await db.execute(`CREATE TABLE IF NOT EXISTS focus_sessions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER REFERENCES users(id) ON DELETE CASCADE,
    task_name        TEXT    DEFAULT 'Focus Session',
    duration_minutes INTEGER NOT NULL,
    completed_at     TEXT    DEFAULT (datetime('now')),
    week_start       TEXT    NOT NULL
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS focus_rooms (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    code          TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    host_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at    TEXT DEFAULT (datetime('now'))
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS focus_room_members (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id      INTEGER REFERENCES focus_rooms(id) ON DELETE CASCADE,
    user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
    display_name TEXT,
    focus_minutes INTEGER DEFAULT 0,
    last_seen    TEXT DEFAULT (datetime('now')),
    is_focusing  INTEGER DEFAULT 0,
    UNIQUE(room_id, user_id)
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS focus_solo_timer (
    user_id           INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    mode              TEXT NOT NULL DEFAULT 'focus',
    custom_min        TEXT NOT NULL DEFAULT '{"focus":25,"short":5,"long":15}',
    duration_seconds  INTEGER NOT NULL DEFAULT 1500,
    remaining_seconds INTEGER NOT NULL DEFAULT 1500,
    started_at        TEXT,
    running           INTEGER NOT NULL DEFAULT 0,
    task_name         TEXT NOT NULL DEFAULT '',
    dots              INTEGER NOT NULL DEFAULT 0,
    version           INTEGER NOT NULL DEFAULT 0,
    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS lumi_conversations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT NOT NULL DEFAULT 'New conversation',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS lumi_messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER REFERENCES lumi_conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL,
    content         TEXT NOT NULL,
    actions_json    TEXT DEFAULT '[]',
    created_at      TEXT DEFAULT (datetime('now'))
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS lumi_memory (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
    key        TEXT NOT NULL,
    value      TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, key)
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS user_trees (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
    tree_key    TEXT NOT NULL,
    unlocked_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, tree_key)
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS user_equipped_tree (
    user_id  INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    tree_key TEXT NOT NULL DEFAULT 'seedling'
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS notifications (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type       TEXT NOT NULL,
    title      TEXT NOT NULL,
    body       TEXT NOT NULL,
    link       TEXT DEFAULT NULL,
    read       INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  // ── Notification dedup hardening ────────────────────────────
  // The previous "check if it exists, then insert" logic had a real
  // race condition: if generateNotifications() ran twice at nearly
  // the same moment (multiple tabs open, the bell polling, a page
  // load — all hitting GET /notifications close together), every one
  // of those overlapping calls could see "nothing exists yet" before
  // any of them finished inserting, so several would all insert their
  // own copy. That's how the 8-duplicate bug happened. Fixed with a
  // real UNIQUE constraint + INSERT...ON CONFLICT DO NOTHING, which
  // is atomic at the database level and immune to this race no matter
  // how many requests overlap.
  if (!(await hasColumn('notifications', 'dedupe_key'))) {
    await db.execute(`ALTER TABLE notifications ADD COLUMN dedupe_key TEXT`);
  }
  {
    const { buildDedupeKey } = require('../lib/notificationDedupe');
    const toBackfill = await db.execute(
      `SELECT id, type, link, date(created_at) day FROM notifications WHERE dedupe_key IS NULL`
    );
    for (const row of toBackfill.rows) {
      const key = buildDedupeKey(row.type, row.link, row.day);
      await db.execute({ sql: `UPDATE notifications SET dedupe_key = ? WHERE id = ?`, args: [key, row.id] });
    }
    await db.execute(`
      DELETE FROM notifications
      WHERE id NOT IN (
        SELECT MIN(id) FROM notifications GROUP BY user_id, dedupe_key
      )
    `);
    await db.execute(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_user_dedupe ON notifications(user_id, dedupe_key)`
    );
  }

  console.log('✅ Database connected and migrations applied.');
}

module.exports = { db, initDb };