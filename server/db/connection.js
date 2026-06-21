// db/connection.js
// Opens (or creates) the SQLite file, applies the schema, and runs small
// migrations so an existing database gets upgraded in place instead of
// breaking. Using better-sqlite3 because it's synchronous and simple —
// no callbacks needed for queries, and synchronous transactions give us
// real atomicity against concurrent request handling (see routes/auth.js).

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'dashboard.sqlite3');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 1. Create any table/index that doesn't exist yet (fresh installs get
//    everything in its final shape straight away). NOTE: schema.sql's
//    CREATE UNIQUE INDEX for case-insensitive email must NOT run until
//    after the quarantine step below, so we strip it out of the bulk
//    exec and run it separately at the end of this file.
const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
const schemaWithoutEmailIndex = schema.replace(
  /CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_nocase[^;]*;/,
  ''
);
db.exec(schemaWithoutEmailIndex);

function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
}

// Migrate existing `tasks` rows that predate the deadline_time column.
if (!hasColumn('tasks', 'deadline_time')) {
  db.exec(`ALTER TABLE tasks ADD COLUMN deadline_time TEXT`);
}

// 2. Migrate tables that already existed before the auth system was
//    added — they're missing a user_id column.
const USER_SCOPED_TABLES = [
  'tasks', 'habits', 'goals', 'learning_items', 'internships',
  'cv_projects', 'cv_skills', 'cv_certifications', 'projects', 'xp_log',
];

db.transaction(() => {
  USER_SCOPED_TABLES.forEach((table) => {
    if (!hasColumn(table, 'user_id')) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN user_id INTEGER`);
    }
  });

  if (!hasColumn('moods', 'user_id')) {
    db.exec(`
      ALTER TABLE moods RENAME TO moods_old;

      CREATE TABLE moods (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        date    TEXT NOT NULL,
        mood    INTEGER NOT NULL,
        note    TEXT DEFAULT '',
        UNIQUE(user_id, date)
      );

      INSERT INTO moods (id, user_id, date, mood, note)
        SELECT id, NULL, date, mood, note FROM moods_old;

      DROP TABLE moods_old;
    `);
  }
})();

// 3. AUTH FIX — case-insensitive email uniqueness.
//    SQLite's default column-level UNIQUE is case-sensitive, so
//    "Foo@x.com" and "foo@x.com" could previously exist as two separate
//    accounts. Before adding a case-insensitive unique index, we must
//    make sure no such duplicates already exist, or CREATE INDEX itself
//    will fail and the server won't start.
//
//    Strategy: NEVER delete user data. Any case-duplicate beyond the
//    first (oldest, by id) gets its email quarantined to a clearly-
//    marked placeholder so the account and all its data are preserved,
//    and a loud warning is logged so an admin can manually merge or
//    contact the affected user.
const duplicateGroups = db.prepare(`
  SELECT LOWER(email) AS lemail, COUNT(*) AS c, GROUP_CONCAT(id) AS ids
  FROM users
  GROUP BY LOWER(email)
  HAVING c > 1
`).all();

if (duplicateGroups.length > 0) {
  console.warn(
    `⚠️  Found ${duplicateGroups.length} email address(es) with case-duplicate accounts. ` +
    `Quarantining the newer duplicate(s) so the app can enforce uniqueness going forward. ` +
    `No data was deleted — review and merge manually if needed.`
  );

  const quarantine = db.prepare(`UPDATE users SET email = ? WHERE id = ?`);
  db.transaction(() => {
    duplicateGroups.forEach((group) => {
      const ids = group.ids.split(',').map(Number).sort((a, b) => a - b);
      const [keepId, ...duplicateIds] = ids; // keep the oldest account using the real email
      duplicateIds.forEach((id) => {
        const quarantinedEmail = `quarantined+dup${id}_${Date.now()}@${group.lemail.split('@')[1] || 'invalid.local'}`;
        quarantine.run(quarantinedEmail, id);
        console.warn(`   → user id ${id} (duplicate of "${group.lemail}", kept id ${keepId} as primary) renamed to: ${quarantinedEmail}`);
      });
    });
  })();
}

db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_nocase ON users(email COLLATE NOCASE)`);

module.exports = db;
