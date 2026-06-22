// db/connection.js
// Replaced better-sqlite3 (sync, local file) with @libsql/client (async, Turso cloud).
// db         → the libsql client, imported by every route file
// initDb()   → async startup function called once in server/index.js before app.listen()

const { createClient } = require('@libsql/client');
const fs   = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// ─── 1. Create the Turso client ───────────────────────────────────────────────
// No local file path — credentials come from environment variables.
// Set these in Render's Environment tab (and in a local .env for dev).
const db = createClient({
  url:       process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// ─── 2. hasColumn — async version of the old sync helper ─────────────────────
async function hasColumn(table, column) {
  const result = await db.execute(`PRAGMA table_info(${table})`);
  return result.rows.some((c) => c.name === column);
}

// ─── 3. initDb — runs once at server startup before app.listen() ──────────────
// Everything that was at module top-level in the old file moves in here,
// because it all needs to be awaited now.
async function initDb() {

  // WAL pragma is a no-op on Turso (it uses its own storage engine),
  // but foreign_keys is still respected.
  await db.execute('PRAGMA foreign_keys = ON');

  // Apply schema — strip the email index so we can run it last (same
  // reason as before: quarantine must happen first).
  // executeMultiple() handles a whole SQL file with many statements.
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  const schemaWithoutEmailIndex = schema.replace(
    /CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_nocase[^;]*;/,
    ''
  );
  await db.executeMultiple(schemaWithoutEmailIndex);

  // Migration: deadline_time column on tasks
  if (!(await hasColumn('tasks', 'deadline_time'))) {
    await db.execute('ALTER TABLE tasks ADD COLUMN deadline_time TEXT');
  }

  // Migration: user_id columns on all user-scoped tables
  const USER_SCOPED_TABLES = [
    'tasks', 'habits', 'goals', 'learning_items', 'internships',
    'cv_projects', 'cv_skills', 'cv_certifications', 'projects', 'xp_log',
  ];

  for (const table of USER_SCOPED_TABLES) {
    if (!(await hasColumn(table, 'user_id'))) {
      await db.execute(`ALTER TABLE ${table} ADD COLUMN user_id INTEGER`);
    }
  }

  // Migration: moods table rebuild (needs to be atomic — use batch)
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
    ], 'write'); // 'write' = runs the batch inside a transaction
  }

  // Auth fix: quarantine case-duplicate emails before creating the index
  const dupResult = await db.execute(`
    SELECT LOWER(email) AS lemail, COUNT(*) AS c, GROUP_CONCAT(id) AS ids
    FROM users
    GROUP BY LOWER(email)
    HAVING c > 1
  `);

  if (dupResult.rows.length > 0) {
    console.warn(
      `⚠️  Found ${dupResult.rows.length} email address(es) with case-duplicate accounts. ` +
      `Quarantining the newer duplicate(s). No data deleted — merge manually if needed.`
    );

    for (const group of dupResult.rows) {
      const ids = String(group.ids).split(',').map(Number).sort((a, b) => a - b);
      const [keepId, ...duplicateIds] = ids;
      for (const id of duplicateIds) {
        const domain = String(group.lemail).split('@')[1] || 'invalid.local';
        const quarantinedEmail = `quarantined+dup${id}_${Date.now()}@${domain}`;
        await db.execute({
          sql:  'UPDATE users SET email = ? WHERE id = ?',
          args: [quarantinedEmail, id],
        });
        console.warn(`   → user id ${id} (dup of "${group.lemail}", kept id ${keepId}) → ${quarantinedEmail}`);
      }
    }
  }

  // Now safe to create the case-insensitive unique index
  await db.execute(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_nocase ON users(email COLLATE NOCASE)'
  );

  console.log('✅ Database connected and migrations applied.');
}

module.exports = { db, initDb };