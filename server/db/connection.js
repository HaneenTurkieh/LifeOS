// db/connection.js
// Opens (or creates) the SQLite file, applies the schema, and runs small
// migrations so an existing (pre-auth) dashboard.sqlite3 gets upgraded
// in place instead of breaking. Using better-sqlite3 because it's
// synchronous and simple — no callbacks needed for queries.

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'dashboard.sqlite3');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 1. Create any table that doesn't exist yet (fresh installs get
//    everything in its final shape straight away).
const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
db.exec(schema);

// 2. Migrate tables that already existed before the auth system was
//    added — they're missing a user_id column. CREATE TABLE IF NOT EXISTS
//    above silently skips tables that already exist, so we patch them here.
function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
}

const USER_SCOPED_TABLES = [
  'tasks', 'habits', 'goals', 'learning_items', 'internships',
  'cv_projects', 'cv_skills', 'cv_certifications', 'projects', 'xp_log',
];

db.transaction(() => {
  USER_SCOPED_TABLES.forEach((table) => {
    if (!hasColumn(table, 'user_id')) {
      // SQLite can't add a column with a REFERENCES constraint via a
      // simple ALTER TABLE ADD COLUMN in older versions, so we add a
      // plain nullable column — the foreign key relationship is still
      // enforced logically by every route, just not by SQLite itself.
      db.exec(`ALTER TABLE ${table} ADD COLUMN user_id INTEGER`);
    }
  });

  // moods needs a full rebuild: its old UNIQUE(date) constraint must
  // become UNIQUE(user_id, date) so multiple users can each have a
  // mood entry for the same day. SQLite can't alter constraints in
  // place, so we recreate the table and copy the data across.
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

module.exports = db;