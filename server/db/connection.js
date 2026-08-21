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
  // ── CV Builder was missing every section that actually makes a CV a
  //    CV — no professional summary, no work experience, no education.
  //    Only projects/skills/certifications existed, so exported CVs were
  //    structurally sparse next to a real resume. cv_summary/cv_headline
  //    /cv_phone/cv_location live on users (one row per person, same
  //    pattern as the PROFILE_COLS above); experience and education get
  //    their own tables since they're repeatable lists.
  const CV_PROFILE_COLS = ['cv_summary', 'cv_headline', 'cv_phone', 'cv_location'];
  for (const col of CV_PROFILE_COLS) {
    if (!(await hasColumn('users', col))) {
      await db.execute(`ALTER TABLE users ADD COLUMN ${col} TEXT DEFAULT ''`);
    }
  }
  // Optional CV photo — same base64-in-TEXT-column pattern as the
  // account avatar, capped the same way (~300KB) in routes/cv.js.
  if (!(await hasColumn('users', 'cv_photo'))) {
    await db.execute(`ALTER TABLE users ADD COLUMN cv_photo TEXT DEFAULT ''`);
  }
  // A freeform description of how someone likes their Lumi slide decks
  // presented — "lots of charts, minimal text" vs "just clear bullets,
  // no fluff" — read by the slide generation prompt so decks adapt to
  // taste instead of using one fixed layout for everyone.
  if (!(await hasColumn('users', 'slide_style_pref'))) {
    await db.execute(`ALTER TABLE users ADD COLUMN slide_style_pref TEXT DEFAULT NULL`);
  }
  await db.execute(`CREATE TABLE IF NOT EXISTS cv_experience (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL,
    company     TEXT DEFAULT '',
    location    TEXT DEFAULT '',
    start_date  TEXT DEFAULT '',
    end_date    TEXT DEFAULT '',
    is_current  INTEGER NOT NULL DEFAULT 0,
    description TEXT DEFAULT ''
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS cv_education (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school      TEXT NOT NULL,
    degree      TEXT DEFAULT '',
    field       TEXT DEFAULT '',
    start_date  TEXT DEFAULT '',
    end_date    TEXT DEFAULT '',
    description TEXT DEFAULT ''
  )`);
  if (!(await hasColumn('user_premium', 'theme_preset'))) {
    await db.execute(`ALTER TABLE user_premium ADD COLUMN theme_preset TEXT DEFAULT 'purple'`);
  }
  if (!(await hasColumn('user_premium', 'theme_mode'))) {
    await db.execute(`ALTER TABLE user_premium ADD COLUMN theme_mode TEXT DEFAULT 'system'`);
  }
  if (!(await hasColumn('user_premium', 'font_scale'))) {
    await db.execute(`ALTER TABLE user_premium ADD COLUMN font_scale TEXT DEFAULT 'default'`);
  }
  // Real billing isn't wired up yet (payment gateway still pending), so
  // "going premium" today means submitting a plan request that emails
  // the dev directly — plan/requested_at just record what was asked
  // for, not a paid, auto-renewing subscription.
  if (!(await hasColumn('user_premium', 'plan'))) {
    await db.execute(`ALTER TABLE user_premium ADD COLUMN plan TEXT DEFAULT NULL`);
  }
  if (!(await hasColumn('user_premium', 'requested_at'))) {
    await db.execute(`ALTER TABLE user_premium ADD COLUMN requested_at TEXT DEFAULT NULL`);
  }
  // Level-milestone free trial — reaching a certain level unlocks one
  // free 7-day Premium trial. trial_used is permanent (one per account
  // ever, even after the trial period lapses) so it can't be re-claimed
  // by dropping back below the level or waiting it out.
  if (!(await hasColumn('user_premium', 'trial_used'))) {
    await db.execute(`ALTER TABLE user_premium ADD COLUMN trial_used INTEGER DEFAULT 0`);
  }
  if (!(await hasColumn('user_premium', 'trial_expires_at'))) {
    await db.execute(`ALTER TABLE user_premium ADD COLUMN trial_expires_at TEXT DEFAULT NULL`);
  }
  // Daily usage caps for the AI calls that actually cost real money —
  // exam/slide generation and Lumi's Deep Think / Deep Search chat modes
  // were previously unlimited for free accounts. One row per user per
  // feature per day, incremented on each successful (billed) call.
  await db.execute(`CREATE TABLE IF NOT EXISTS feature_usage (
    user_id INTEGER NOT NULL,
    feature TEXT NOT NULL,
    date    TEXT NOT NULL,
    count   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, feature, date)
  )`);
  if (!(await hasColumn('focus_room_tree', 'died_reason'))) {
    await db.execute(`ALTER TABLE focus_room_tree ADD COLUMN died_reason TEXT DEFAULT 'left'`);
  }
  // ── Link Flow focus sessions to real tasks, so time can be logged
  //    against a specific task (e.g. "Studying CA") instead of just a
  //    free-text label, and the task can be marked done once finished.
  if (!(await hasColumn('tasks', 'time_spent_minutes'))) {
    await db.execute(`ALTER TABLE tasks ADD COLUMN time_spent_minutes INTEGER NOT NULL DEFAULT 0`);
  }
  // completed_at gets cleared back to NULL whenever a task is un-done
  // (it only ever reflects the *current* done state), so it can't be
  // used to tell whether XP was already paid out for a task. This
  // column is a one-way flag: set once, on the very first completion,
  // and never cleared — used to stop toggling done → undone → done
  // from farming +20 XP over and over on the same task.
  if (!(await hasColumn('tasks', 'first_completed_at'))) {
    await db.execute(`ALTER TABLE tasks ADD COLUMN first_completed_at TEXT DEFAULT NULL`);
  }
  // Distinguishes tasks the user typed in themselves from ones Nuvora
  // added on its own (currently just the yearly birthday reminder,
  // self-seeded in notifications.js) — lets the client badge them
  // differently without guessing from title/category text.
  if (!(await hasColumn('tasks', 'source'))) {
    await db.execute(`ALTER TABLE tasks ADD COLUMN source TEXT NOT NULL DEFAULT 'user'`);
  }
  if (!(await hasColumn('focus_sessions', 'task_id'))) {
    await db.execute(`ALTER TABLE focus_sessions ADD COLUMN task_id INTEGER DEFAULT NULL`);
  }
  // Optional final-week day planner for goals — off by default (most
  // goals don't need day-level granularity, only ones close to their
  // deadline benefit from it). scheduled_date pins a milestone to a
  // specific day; NULL just means "not scheduled yet", same as before
  // this column existed.
  if (!(await hasColumn('goals', 'day_planner_enabled'))) {
    await db.execute(`ALTER TABLE goals ADD COLUMN day_planner_enabled INTEGER NOT NULL DEFAULT 0`);
  }
  if (!(await hasColumn('milestones', 'scheduled_date'))) {
    await db.execute(`ALTER TABLE milestones ADD COLUMN scheduled_date TEXT DEFAULT NULL`);
  }
  // Which star design someone picked for a finished goal on the Goals
  // page's star-chart poster (StarChartCard.jsx) — NULL means "not
  // completed yet" or "completed before this existed", both of which
  // just render the default gold star.
  if (!(await hasColumn('goals', 'star_style'))) {
    await db.execute(`ALTER TABLE goals ADD COLUMN star_style TEXT DEFAULT NULL`);
  }
  // Tasks generated by "Break into tasks" were only ever distinguishable
  // from regular tasks by category === project title — a loose string
  // match, and the general Tasks page / Dashboard had no way to tell
  // them apart from tasks the person added themselves, so AI-generated
  // project tasks were leaking into both. A real project_id column lets
  // those queries filter them out reliably and keeps them scoped to
  // their project's card only.
  if (!(await hasColumn('tasks', 'project_id'))) {
    await db.execute(`ALTER TABLE tasks ADD COLUMN project_id INTEGER DEFAULT NULL`);
  }
  // Custom "remind before" lead times for the due-soon notification (see
  // notifications.js) — a JSON array of minutes-before-deadline, e.g.
  // [1440, 60, 15] for "1 day, 1 hour, and 15 minutes before". NULL (the
  // default for every existing task, and any new one that doesn't touch
  // this) means "just use the standard 1-hour-before" — nobody has to
  // configure anything to keep getting reminded; this only ever adds
  // *more* reminder points on top of that for tasks that need it.
  if (!(await hasColumn('tasks', 'remind_offsets_min'))) {
    await db.execute(`ALTER TABLE tasks ADD COLUMN remind_offsets_min TEXT DEFAULT NULL`);
  }
  // One-time backfill: tag existing tasks whose category happens to
  // match one of this user's project titles, so tasks created before
  // this column existed get hidden from the general views too. Only
  // touches rows that are still untagged, so it's a no-op after the
  // first run.
  await db.execute(`
    UPDATE tasks
    SET project_id = (
      SELECT p.id FROM projects p
      WHERE p.user_id = tasks.user_id AND p.title = tasks.category
      LIMIT 1
    )
    WHERE project_id IS NULL
      AND EXISTS (
        SELECT 1 FROM projects p
        WHERE p.user_id = tasks.user_id AND p.title = tasks.category
      )
  `);
  // Second pass: some project tasks were generated more than once (e.g.
  // "Break into tasks" run again before the project_id column existed,
  // then again after) — same title, but one copy never got a category
  // that matched the project title exactly, so the pass above missed
  // it. If an untagged task shares its exact title with a sibling task
  // that IS already tagged to a project, it's almost certainly the same
  // generated item — inherit that project_id instead of leaving it to
  // leak onto the general Tasks page and Dashboard.
  await db.execute(`
    UPDATE tasks
    SET project_id = (
      SELECT t2.project_id FROM tasks t2
      WHERE t2.user_id = tasks.user_id
        AND t2.title = tasks.title
        AND t2.project_id IS NOT NULL
      LIMIT 1
    )
    WHERE project_id IS NULL
      AND EXISTS (
        SELECT 1 FROM tasks t2
        WHERE t2.user_id = tasks.user_id
          AND t2.title = tasks.title
          AND t2.project_id IS NOT NULL
      )
  `);
  if (!(await hasColumn('focus_solo_timer', 'task_id'))) {
    await db.execute(`ALTER TABLE focus_solo_timer ADD COLUMN task_id INTEGER DEFAULT NULL`);
  }
  if (!(await hasColumn('planted_trees', 'task_id'))) {
    await db.execute(`ALTER TABLE planted_trees ADD COLUMN task_id INTEGER DEFAULT NULL`);
  }
  // Room-synced sessions used to only reach the site-wide weekly
  // leaderboard if the member's own device was still open when their
  // personal timer crossed zero — if their tab was backgrounded/closed,
  // that report never fired. credited_started_at lets the server credit
  // members itself once a room session naturally finishes, without
  // double-counting anyone whose device *did* self-report normally.
  if (!(await hasColumn('focus_room_members', 'credited_started_at'))) {
    await db.execute(`ALTER TABLE focus_room_members ADD COLUMN credited_started_at TEXT DEFAULT NULL`);
  }
  // Every other Flow number (leaderboard, spotlights) resets each Sunday
  // via week_start — but focus_minutes here was a plain running counter
  // with no time window at all, so a room's "min focused" just kept
  // growing forever. week_start lets routes/focus.js lazily zero a
  // member's count the first time it's touched in a new week.
  if (!(await hasColumn('focus_room_members', 'week_start'))) {
    await db.execute(`ALTER TABLE focus_room_members ADD COLUMN week_start TEXT DEFAULT NULL`);
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
  // User-designed trees — shape + colors + a name they picked
  // themselves. A new design slot unlocks every 1000 XP earned
  // (lifetime, not current balance), so this is one row per slot, not
  // one per account. Originally shipped as a single-row-per-user table
  // (a one-time 1000 XP purchase); migrate any existing design into
  // the new multi-row shape before recreating it.
  const mysticTableInfo = await db.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='user_mystic_tree'`
  );
  if (mysticTableInfo.rows.length > 0 && !(await hasColumn('user_mystic_tree', 'id'))) {
    await db.execute(`ALTER TABLE user_mystic_tree RENAME TO user_mystic_tree_old`);
    await db.execute(`CREATE TABLE user_mystic_tree (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
      shape_key   TEXT NOT NULL,
      color_hex   TEXT NOT NULL,
      glow_hex    TEXT NOT NULL,
      custom_name TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    )`);
    await db.execute(`
      INSERT INTO user_mystic_tree (user_id, shape_key, color_hex, glow_hex, custom_name, created_at, updated_at)
      SELECT user_id, shape_key, color_hex, glow_hex, custom_name, created_at, updated_at FROM user_mystic_tree_old
    `);
    await db.execute(`DROP TABLE user_mystic_tree_old`);
  } else {
    await db.execute(`CREATE TABLE IF NOT EXISTS user_mystic_tree (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
      shape_key   TEXT NOT NULL,
      color_hex   TEXT NOT NULL,
      glow_hex    TEXT NOT NULL,
      custom_name TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    )`);
  }
  // ── Constellation rework: Mystic Trees → Zodiac stars ──────────
  // Replaced the old free-form "design any shape/color" mystic slots
  // with a fixed set of 7 stars per user, tied to their real zodiac
  // sign (derived from birthday) and unlocked one at a time on an
  // escalating XP curve instead of a flat 1000/slot (see lib/zodiac.js
  // and routes/trees.js). Adoption of the old free-form version was
  // low and what existed wasn't well-liked, so on this one deploy only:
  // existing user_mystic_tree rows get cleared and any 'mystic:<id>'
  // equip falls back to 'seedling' — a clean cut rather than trying to
  // force old freeform designs into the new zodiac shape. Guarded by
  // the same hasColumn check as the ALTERs below, so this only ever
  // runs once, on the first boot after this change ships.
  if (!(await hasColumn('user_mystic_tree', 'zodiac_key'))) {
    await db.execute(`DELETE FROM user_mystic_tree`);
    await db.execute(`UPDATE user_equipped_tree SET tree_key = 'seedling' WHERE tree_key LIKE 'mystic:%'`);
    await db.execute(`ALTER TABLE user_mystic_tree ADD COLUMN zodiac_key TEXT DEFAULT NULL`);
    await db.execute(`ALTER TABLE user_mystic_tree ADD COLUMN star_index INTEGER DEFAULT NULL`);
  }
  // planted_trees (the Land history) doesn't store its own shape/color —
  // it looks up 'mystic:<id>' against user_mystic_tree live, every time
  // it's rendered (see routes/focus.js GET /forest). With every old
  // user_mystic_tree row gone as of the Constellation rework above, any
  // 'mystic:<id>' left sitting in planted_trees is now a dead reference
  // that silently degrades into an identical generic 🔮 placeholder
  // instead of actually being cleaned up. Not gated on the block above —
  // this runs every boot, same self-healing shape as the Aurora→Nuvora
  // cleanup below, so it stays correct regardless of deploy ordering and
  // is a harmless no-op once nothing matches anymore.
  await db.execute(`UPDATE planted_trees SET tree_key = 'seedling' WHERE tree_key LIKE 'mystic:%'`);

  // Any account still equipped on the old bare 'mystic' key (from
  // before this became multi-tree) now points at nothing specific —
  // point it at their first design, if they have one, since the new
  // equip key format is 'mystic:<id>'.
  await db.execute(`
    UPDATE user_equipped_tree
    SET tree_key = 'mystic:' || (
      SELECT id FROM user_mystic_tree umt
      WHERE umt.user_id = user_equipped_tree.user_id
      ORDER BY umt.created_at ASC LIMIT 1
    )
    WHERE tree_key = 'mystic'
      AND EXISTS (SELECT 1 FROM user_mystic_tree umt WHERE umt.user_id = user_equipped_tree.user_id)
  `);
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

  // Notifications used to store only a pre-rendered English title/body,
  // so there was no way to show them in Arabic short of re-rendering
  // from scratch. `data` carries the raw interpolation params (task
  // title, a date, a count, etc.) alongside the type, so the client can
  // run both through t() in whichever language is active — same pattern
  // as every other page. Old rows keep NULL here and just fall back to
  // their stored English text (see NotificationBell.jsx).
  if (!(await hasColumn('notifications', 'data'))) {
    await db.execute(`ALTER TABLE notifications ADD COLUMN data TEXT DEFAULT NULL`);
  }

  // One-time owner email change — she asked to switch her Nuvora login
  // from the old Gmail to her Hotmail address. Guarded on the OLD email
  // still existing, so this only actually does anything on the first
  // boot after deploy; every boot after that it's a harmless no-op.
  {
    const OLD_OWNER_EMAIL = 'turkiehhanee16@gmail.com';
    const NEW_OWNER_EMAIL = 'haneenturkieh@hotmail.com';
    try {
      const oldRow = (await db.execute({
        sql: `SELECT id FROM users WHERE email = ? COLLATE NOCASE`, args: [OLD_OWNER_EMAIL],
      })).rows[0];
      if (oldRow) {
        await db.execute({
          sql: `UPDATE users SET email = ? WHERE id = ?`,
          args: [NEW_OWNER_EMAIL, oldRow.id],
        });
        console.log(`✅ Owner email migrated to ${NEW_OWNER_EMAIL}`);
      }
    } catch (err) {
      // Most likely cause: a row with the new email already exists
      // (unique constraint) — log it instead of crashing the whole boot.
      console.error('Owner email migration skipped:', err.message);
    }
  }

  // Free-premium override — these accounts always have Premium, permanently,
  // regardless of trial state, usage caps, or anything toggled elsewhere.
  // Runs on every boot (idempotent) so it self-heals even if someone flips
  // it via the free /premium/toggle route. Add more emails here as needed.
  {
    const FREE_PREMIUM_EMAILS = ['haneenturkieh@hotmail.com', '20tasbeeh06@gmail.com'];
    for (const email of FREE_PREMIUM_EMAILS) {
      const row = (await db.execute({
        sql: `SELECT id FROM users WHERE email = ? COLLATE NOCASE`, args: [email],
      })).rows[0];
      if (row) {
        await db.execute({
          sql: `INSERT INTO user_premium (user_id, is_premium) VALUES (?, 1)
                ON CONFLICT(user_id) DO UPDATE SET is_premium = 1`,
          args: [row.id],
        });
      }
    }
  }

  // ── Missing user_id indexes ─────────────────────────────────
  // Every one of these tables is queried with `WHERE user_id = ?`
  // constantly (most heavily by Lumi's buildSystemPrompt, which fires on
  // every single chat message), but had no index backing that column —
  // meaning a full table scan on every lookup, on every message, for
  // every user, forever. IF NOT EXISTS makes this a fast no-op on every
  // boot after the first.
  const USER_ID_INDEXES = [
    'tasks', 'goals', 'habits', 'xp_log', 'lumi_conversations',
    'lumi_memory', 'learning_items', 'internships', 'projects',
    'cv_experience', 'cv_education', 'notifications',
  ];
  for (const table of USER_ID_INDEXES) {
    await db.execute(
      `CREATE INDEX IF NOT EXISTS idx_${table}_user ON ${table}(user_id)`
    );
  }

  // ── Paddle payment integration ──────────────────────────────
  // Tracks the Paddle-side identifiers for a user's subscription so the
  // webhook handler can look up/update the right row, and so we can call
  // the Paddle API later (e.g. to cancel) without re-deriving these IDs.
  if (!(await hasColumn('user_premium', 'paddle_customer_id'))) {
    await db.execute(`ALTER TABLE user_premium ADD COLUMN paddle_customer_id TEXT DEFAULT NULL`);
  }
  if (!(await hasColumn('user_premium', 'paddle_subscription_id'))) {
    await db.execute(`ALTER TABLE user_premium ADD COLUMN paddle_subscription_id TEXT DEFAULT NULL`);
  }
  if (!(await hasColumn('user_premium', 'paddle_price_id'))) {
    await db.execute(`ALTER TABLE user_premium ADD COLUMN paddle_price_id TEXT DEFAULT NULL`);
  }
  if (!(await hasColumn('user_premium', 'paddle_status'))) {
    await db.execute(`ALTER TABLE user_premium ADD COLUMN paddle_status TEXT DEFAULT NULL`);
  }

  // ── Grace passes (Premium) ───────────────────────────────────
  // A weekly-refilling allowance that auto-saves a Premium user's tree
  // if they pause a focus session past the normal 10s grace window,
  // instead of letting it die. grace_passes_used counts how many of
  // this week's allowance have been spent; grace_passes_week_start
  // marks which week that count belongs to, so a lazy reset (same
  // pattern as focus_room_members.week_start elsewhere) can zero it
  // out the first time it's checked after Sunday rolls over.
  if (!(await hasColumn('user_premium', 'grace_passes_used'))) {
    await db.execute(`ALTER TABLE user_premium ADD COLUMN grace_passes_used INTEGER DEFAULT 0`);
  }
  if (!(await hasColumn('user_premium', 'grace_passes_week_start'))) {
    await db.execute(`ALTER TABLE user_premium ADD COLUMN grace_passes_week_start TEXT DEFAULT NULL`);
  }

  // ── Aurora → Nuvora data cleanup (self-healing, idempotent) ────
  // The rename touched every UI string and new inserts, but rows already
  // sitting in the live DB from before the rename kept the old value —
  // a task's `source` column, and the seeded demo account's email. Both
  // get fixed here automatically on every boot rather than needing a
  // manual one-off script; a no-op once nothing matches anymore.
  await db.execute(`UPDATE tasks SET source = 'nuvora' WHERE source = 'aurora'`);
  await db.execute(`
    UPDATE users SET email = 'demo@nuvora.app'
    WHERE email = 'demo@aurora.app'
      AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'demo@nuvora.app' COLLATE NOCASE)
  `);

  // ── Error logs (owner visibility) ────────────────────────────
  // A lightweight record of user-facing AI-call failures (Lumi chat,
  // anti-procrastination, etc.) so the app owner can actually see when
  // something breaks instead of only finding out if a user happens to
  // mention it. Writing to this table is fire-and-forget from the
  // calling route (see lib/errorLog.js) — logging must never affect the
  // user-facing response, so it's wrapped in its own try/catch there.
  await db.execute(`CREATE TABLE IF NOT EXISTS error_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    source TEXT NOT NULL,
    message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  // Same class of bug as tasks.first_completed_at above: habit_logs rows
  // are deleted on untoggle (every other query in the app — analytics,
  // notifications, dashboard, chat.js — relies on "row exists" meaning
  // "done that day", so that behavior stays as-is), which meant nothing
  // recorded that XP had already been paid for a given (habit, date) —
  // toggle on → off → on → off... farmed +5 XP every single time. This
  // table is a separate, append-only record of which (habit_id, date)
  // pairs have ever been paid out for, so the /toggle route can gate the
  // grant without touching habit_logs' existing delete-on-untoggle shape.
  await db.execute(`CREATE TABLE IF NOT EXISTS habit_xp_grants (
    habit_id INTEGER NOT NULL,
    date     TEXT NOT NULL,
    PRIMARY KEY (habit_id, date)
  )`);

  // Same one-way-flag pattern as tasks.first_completed_at, applied to the
  // same bug in goals: toggling status active → completed → active →
  // completed... used to pay out +100 XP every single time it landed back
  // on "completed", with nothing recording it had already been paid.
  if (!(await hasColumn('goals', 'first_completed_at'))) {
    await db.execute(`ALTER TABLE goals ADD COLUMN first_completed_at TEXT DEFAULT NULL`);
    // Goals already completed at migration time already had their XP paid
    // under the old logic — backfill so they don't re-pay on the next
    // active → completed toggle.
    await db.execute(`UPDATE goals SET first_completed_at = datetime('now') WHERE status = 'completed' AND first_completed_at IS NULL`);
  }

  // The solo Focus timer is explicitly designed to sync across every
  // device/tab on an account (see focus_solo_timer above) — which meant
  // two open tabs that both independently noticed the same countdown hit
  // zero could both call POST /focus/sessions for what is really the same
  // completed round, each awarding its own XP and planting its own tree
  // for one real session. (user_id, started_at) identifies one specific
  // round of the timer (a fresh value is set every time it's started or
  // resumed — see toggleTimer/startTimer in FocusContext.jsx), so it's
  // used here as an idempotency key: the first request to report a given
  // round wins, any later report of that same round is a no-op.
  await db.execute(`CREATE TABLE IF NOT EXISTS focus_session_credits (
    user_id    INTEGER NOT NULL,
    started_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, started_at)
  )`);

  // Email reminders (see routes/cron.js + lib/emailReminders.js) need to
  // convert a task's local wall-clock deadline into a real UTC instant
  // the same way the in-browser notification poll already does via
  // tz_offset — but a cron job has no browser to ask. Piggybacking on
  // GET /notifications (which already receives tz_offset on every poll)
  // to persist the most recent value here means the cron job gets a
  // reasonably fresh timezone for free, no new client work required.
  if (!(await hasColumn('users', 'tz_offset_min'))) {
    await db.execute(`ALTER TABLE users ADD COLUMN tz_offset_min INTEGER DEFAULT NULL`);
  }
  // Tracks whether a given (already-deduped) notification row has been
  // emailed yet, so the cron job can run as often as it likes without
  // ever sending the same reminder twice — same idempotency approach as
  // dedupe_key above, just for the email side-effect instead of the
  // in-app row itself.
  if (!(await hasColumn('notifications', 'email_sent'))) {
    await db.execute(`ALTER TABLE notifications ADD COLUMN email_sent INTEGER DEFAULT 0`);
  }

  // "Someone's birthday" events (Calendar's 🎂 quick-add toggle) were
  // originally identified purely by category==='Birthday' — a free-text
  // field a person could coincidentally type for an unrelated task,
  // which would then silently and permanently lose all of its overdue/
  // due-soon notifications too (same string, same exclusion logic).
  // A dedicated boolean is the actual reliable marker; category stays
  // as a human-readable label but is no longer load-bearing for any
  // notification/recurrence behavior. Backfill covers birthdays already
  // created (by category string) before this column existed, including
  // the self-seeded one from ensureBirthdayTask.
  if (!(await hasColumn('tasks', 'is_birthday'))) {
    await db.execute(`ALTER TABLE tasks ADD COLUMN is_birthday INTEGER DEFAULT 0`);
    await db.execute(`UPDATE tasks SET is_birthday=1 WHERE category='Birthday'`);
  }

  // Real (phone/desktop, app-closed) push notifications — see
  // lib/push.js + routes/push.js + lib/pushReminders.js. One row per
  // browser/device a person has enabled push on (a phone and a laptop
  // both subscribing means two rows) — endpoint is the unique per-
  // device push URL the browser's push service hands back on subscribe,
  // so UNIQUE(user_id, endpoint) can't double-subscribe the same device.
  await db.execute(`CREATE TABLE IF NOT EXISTS push_subscriptions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint   TEXT NOT NULL,
    p256dh     TEXT NOT NULL,
    auth       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, endpoint)
  )`);
  // Independent of email_sent — someone might have push on but email
  // off (or vice versa), and a push send failing shouldn't block/skip
  // the email for the same item or vice versa.
  if (!(await hasColumn('notifications', 'push_sent'))) {
    await db.execute(`ALTER TABLE notifications ADD COLUMN push_sent INTEGER DEFAULT 0`);
  }

  console.log('✅ Database connected and migrations applied.');
}

module.exports = { db, initDb };