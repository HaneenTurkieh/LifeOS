// db/seed.js
// Populates the database with a demo account and realistic sample data so
// the app feels alive the first time it's opened. Safe to re-run: it wipes
// existing rows first. Run with `npm run seed` from the server/ folder.
//
// Demo login created by this script:
//   email:    demo@aurora.app
//   password: password123

const bcrypt = require('bcryptjs');
const db = require('./connection');

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function isoDaysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const DEMO_EMAIL = 'demo@aurora.app';
const DEMO_PASSWORD = 'password123';

// Child tables first, 'users' last, so a clean re-seed always starts empty.
const tables = [
  'xp_log', 'user_achievements', 'habit_logs', 'milestones',
  'tasks', 'habits', 'goals', 'learning_items', 'moods', 'internships',
  'cv_projects', 'cv_skills', 'cv_certifications', 'projects',
  'achievements', 'settings', 'users',
];

const seed = db.transaction(() => {
  tables.forEach((t) => db.prepare(`DELETE FROM ${t}`).run());

  // ---------- Demo user ----------
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const userInfo = db.prepare(`INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)`)
    .run('Sami', DEMO_EMAIL, passwordHash);
  const userId = userInfo.lastInsertRowid;

  // ---------- Tasks ----------
  const insertTask = db.prepare(`
    INSERT INTO tasks (user_id, title, description, priority, category, deadline, status, progress, position, completed_at)
    VALUES (@user_id, @title, @description, @priority, @category, @deadline, @status, @progress, @position, @completed_at)
  `);
  const tasks = [
    { title: 'Finish Python OOP module', description: 'Classes, inheritance, polymorphism exercises', priority: 'high', category: 'Learning', deadline: isoDaysFromNow(1), status: 'doing', progress: 60, position: 0, completed_at: null },
    { title: 'Submit internship application — DataCore', description: 'Tailor resume, write cover letter', priority: 'high', category: 'Career', deadline: isoDaysFromNow(0), status: 'todo', progress: 0, position: 0, completed_at: null },
    { title: 'Gym — leg day', description: '', priority: 'medium', category: 'Health', deadline: isoDaysFromNow(0), status: 'todo', progress: 0, position: 1, completed_at: null },
    { title: 'Read 20 pages of "Atomic Habits"', description: '', priority: 'low', category: 'Personal', deadline: isoDaysFromNow(0), status: 'todo', progress: 0, position: 2, completed_at: null },
    { title: 'Portfolio site — hero section', description: 'Build responsive hero with Tailwind', priority: 'medium', category: 'Project', deadline: isoDaysFromNow(3), status: 'doing', progress: 35, position: 1, completed_at: null },
    { title: 'Driving theory practice test', description: 'Score 90%+ on mock exam', priority: 'medium', category: 'Personal', deadline: isoDaysFromNow(5), status: 'todo', progress: 0, position: 3, completed_at: null },
    { title: 'Linear Algebra problem set 4', description: '', priority: 'high', category: 'Learning', deadline: isoDaysAgo(0), status: 'done', progress: 100, position: 0, completed_at: isoDaysAgo(1) },
    { title: 'Email professor about recommendation letter', description: '', priority: 'medium', category: 'Career', deadline: isoDaysAgo(1), status: 'done', progress: 100, position: 1, completed_at: isoDaysAgo(2) },
    { title: 'Clean up GitHub repo READMEs', description: '', priority: 'low', category: 'Project', deadline: isoDaysFromNow(7), status: 'todo', progress: 0, position: 4, completed_at: null },
  ];
  tasks.forEach((t) => insertTask.run({ ...t, user_id: userId }));

  // ---------- Habits ----------
  const insertHabit = db.prepare(`
    INSERT INTO habits (id, user_id, name, icon, color, target_per_week) VALUES (@id, @user_id, @name, @icon, @color, @target_per_week)
  `);
  const habits = [
    { id: 1, name: 'Exercise', icon: 'Dumbbell', color: '#F97316', target_per_week: 5 },
    { id: 2, name: 'Reading', icon: 'BookOpen', color: '#6366F1', target_per_week: 7 },
    { id: 3, name: 'Drink Water', icon: 'Droplets', color: '#06B6D4', target_per_week: 7 },
    { id: 4, name: 'Coding Practice', icon: 'Code2', color: '#22C55E', target_per_week: 6 },
    { id: 5, name: 'Meditate', icon: 'Wind', color: '#A855F7', target_per_week: 4 },
  ];
  habits.forEach((h) => insertHabit.run({ ...h, user_id: userId }));

  const insertLog = db.prepare(`INSERT OR IGNORE INTO habit_logs (habit_id, date, completed) VALUES (?, ?, 1)`);
  // Build the last 30 days of logs per habit with a realistic, slightly imperfect streak.
  const skipPattern = {
    1: [2, 9, 15, 21],       // exercise: misses a few days
    2: [5],                  // reading: very consistent
    3: [],                   // water: perfect
    4: [3, 10, 11, 18, 24],  // coding: a bit patchy
    5: [1, 4, 6, 8, 12, 14, 16, 19, 22, 25, 27], // meditate: ~4x/week
  };
  for (let i = 0; i < 30; i++) {
    const date = isoDaysAgo(i);
    habits.forEach((h) => {
      if (!skipPattern[h.id].includes(i)) insertLog.run(h.id, date);
    });
  }

  // ---------- Goals + milestones ----------
  const insertGoal = db.prepare(`
    INSERT INTO goals (id, user_id, title, description, category, target_date, status)
    VALUES (@id, @user_id, @title, @description, @category, @target_date, @status)
  `);
  const goals = [
    { id: 1, title: 'Get driving license', description: 'Pass theory + practical exam', category: 'Personal', target_date: isoDaysFromNow(45), status: 'active' },
    { id: 2, title: 'Finish Python course', description: 'Complete the full curriculum on CS50P', category: 'Learning', target_date: isoDaysFromNow(20), status: 'active' },
    { id: 3, title: 'Build portfolio project', description: 'Ship a full-stack project to show recruiters', category: 'Career', target_date: isoDaysFromNow(30), status: 'active' },
    { id: 4, title: 'Run a 5K', description: 'Train up from couch to 5K', category: 'Health', target_date: isoDaysAgo(10), status: 'completed' },
  ];
  goals.forEach((g) => insertGoal.run({ ...g, user_id: userId }));

  const insertMilestone = db.prepare(`INSERT INTO milestones (goal_id, title, done, position) VALUES (?, ?, ?, ?)`);
  const milestones = [
    [1, 'Book theory exam', 1, 0], [1, 'Pass theory exam', 1, 1], [1, 'Complete 10 driving lessons', 0, 2], [1, 'Book practical exam', 0, 3],
    [2, 'Finish chapters 1-4', 1, 0], [2, 'Finish chapters 5-8', 1, 1], [2, 'Build final project', 0, 2], [2, 'Get certificate', 0, 3],
    [3, 'Pick tech stack', 1, 0], [3, 'Design wireframes', 1, 1], [3, 'Build MVP', 0, 2], [3, 'Deploy live', 0, 3],
    [4, 'Run 1K without stopping', 1, 0], [4, 'Run 3K', 1, 1], [4, 'Run 5K', 1, 2],
  ];
  milestones.forEach((m) => insertMilestone.run(...m));

  // ---------- Learning tracker ----------
  const insertLearning = db.prepare(`
    INSERT INTO learning_items (user_id, type, title, provider, status, progress, notes)
    VALUES (@user_id, @type, @title, @provider, @status, @progress, @notes)
  `);
  const learning = [
    { type: 'course', title: 'CS50: Introduction to Python', provider: 'Harvard / edX', status: 'in_progress', progress: 65, notes: 'On problem set 6' },
    { type: 'course', title: 'React — The Complete Guide', provider: 'Udemy', status: 'in_progress', progress: 30, notes: '' },
    { type: 'book', title: 'Atomic Habits', provider: 'James Clear', status: 'in_progress', progress: 45, notes: '' },
    { type: 'book', title: 'Deep Work', provider: 'Cal Newport', status: 'planned', progress: 0, notes: '' },
    { type: 'certification', title: 'AWS Cloud Practitioner', provider: 'AWS', status: 'planned', progress: 0, notes: 'Targeting next semester' },
    { type: 'certification', title: 'Google UX Design', provider: 'Coursera', status: 'completed', progress: 100, notes: 'Finished last month' },
  ];
  learning.forEach((l) => insertLearning.run({ ...l, user_id: userId }));

  // ---------- Mood (last 14 days) ----------
  const insertMood = db.prepare(`INSERT INTO moods (user_id, date, mood, note) VALUES (?, ?, ?, ?)`);
  const moodPattern = [4, 3, 5, 4, 2, 3, 4, 5, 4, 4, 3, 5, 4, 4];
  moodPattern.forEach((m, i) => insertMood.run(userId, isoDaysAgo(13 - i), m, ''));

  // ---------- Internship tracker ----------
  const insertInternship = db.prepare(`
    INSERT INTO internships (user_id, company, role, status, applied_date, notes, link)
    VALUES (@user_id, @company, @role, @status, @applied_date, @notes, @link)
  `);
  const internships = [
    { company: 'DataCore Analytics', role: 'Data Science Intern', status: 'interview', applied_date: isoDaysAgo(10), notes: 'Technical interview scheduled', link: '' },
    { company: 'Nimbus Software', role: 'Frontend Engineering Intern', status: 'applied', applied_date: isoDaysAgo(3), notes: '', link: '' },
    { company: 'Brightline Robotics', role: 'Software Intern', status: 'rejected', applied_date: isoDaysAgo(25), notes: 'Good feedback, reapply next cycle', link: '' },
    { company: 'Aurora Health Tech', role: 'Backend Intern', status: 'accepted', applied_date: isoDaysAgo(40), notes: 'Starts in summer', link: '' },
  ];
  internships.forEach((i) => insertInternship.run({ ...i, user_id: userId }));

  // ---------- CV builder ----------
  db.prepare(`INSERT INTO cv_projects (user_id, title, description, tech, link) VALUES (?, ?, ?, ?, ?)`).run(
    userId, 'Personal Life Dashboard', 'A second-brain productivity app with AI-assisted planning', 'React, Express, SQLite, Tailwind', ''
  );
  db.prepare(`INSERT INTO cv_projects (user_id, title, description, tech, link) VALUES (?, ?, ?, ?, ?)`).run(
    userId, 'Campus Event Finder', 'Map-based app to discover student events nearby', 'React Native, Firebase', ''
  );
  const insertSkill = db.prepare(`INSERT INTO cv_skills (user_id, name, level, category) VALUES (?, ?, ?, ?)`);
  [['JavaScript', 'advanced', 'technical'], ['Python', 'advanced', 'technical'], ['React', 'intermediate', 'technical'],
   ['SQL', 'intermediate', 'technical'], ['Public Speaking', 'intermediate', 'soft'], ['Team Leadership', 'beginner', 'soft']]
    .forEach((s) => insertSkill.run(userId, ...s));
  db.prepare(`INSERT INTO cv_certifications (user_id, title, issuer, date, link) VALUES (?, ?, ?, ?, ?)`).run(
    userId, 'Google UX Design Certificate', 'Coursera', isoDaysAgo(30), ''
  );

  // ---------- Project tracker ----------
  const insertProject = db.prepare(`INSERT INTO projects (user_id, title, description, stage, progress) VALUES (?, ?, ?, ?, ?)`);
  [
    ['Personal Life Dashboard', 'Second-brain app for students', 'development', 55],
    ['Recipe Recommender', 'ML model that suggests recipes from fridge contents', 'design', 20],
    ['Study Buddy Bot', 'Discord bot for study group accountability', 'idea', 5],
    ['Campus Event Finder', 'Map-based event discovery app', 'deployment', 90],
  ].forEach((p) => insertProject.run(userId, ...p));

  // ---------- XP log ----------
  const insertXp = db.prepare(`INSERT INTO xp_log (user_id, amount, reason, created_at) VALUES (?, ?, ?, ?)`);
  for (let i = 12; i >= 0; i--) {
    insertXp.run(userId, 20, 'Completed a task', `${isoDaysAgo(i)} 09:00:00`);
    if (i % 2 === 0) insertXp.run(userId, 5, 'Completed a habit', `${isoDaysAgo(i)} 18:00:00`);
  }
  insertXp.run(userId, 100, 'Finished goal: Run a 5K', `${isoDaysAgo(10)} 20:00:00`);

  // ---------- Achievements catalogue (global, not user-specific) ----------
  const insertAch = db.prepare(`
    INSERT INTO achievements (key, title, description, icon) VALUES (@key, @title, @description, @icon)
  `);
  const achievements = [
    { key: 'first_task', title: 'First Step', description: 'Complete your first task', icon: 'Footprints' },
    { key: 'week_streak', title: 'First Week Streak', description: 'Keep any habit going for 7 days straight', icon: 'Flame' },
    { key: 'hundred_tasks', title: '100 Tasks Completed', description: 'Complete 100 tasks total', icon: 'Trophy' },
    { key: 'no_missed_30', title: 'No Missed Habits — 30 Days', description: 'Perfect habit completion for 30 days', icon: 'ShieldCheck' },
    { key: 'goal_finisher', title: 'Goal Getter', description: 'Complete your first goal', icon: 'Target' },
    { key: 'early_bird', title: 'Early Bird', description: 'Complete a task before 9am', icon: 'Sunrise' },
  ];
  achievements.forEach((a) => insertAch.run(a));

  // Unlock a few achievements for the demo user, matching the sample data above.
  const insertUserAch = db.prepare(`INSERT INTO user_achievements (user_id, key, unlocked_at) VALUES (?, ?, ?)`);
  insertUserAch.run(userId, 'first_task', `${isoDaysAgo(12)} 10:00:00`);
  insertUserAch.run(userId, 'week_streak', `${isoDaysAgo(5)} 10:00:00`);
  insertUserAch.run(userId, 'goal_finisher', `${isoDaysAgo(10)} 20:00:00`);
  insertUserAch.run(userId, 'early_bird', `${isoDaysAgo(8)} 08:30:00`);

  // ---------- Settings ----------
  db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)`).run('seeded_at', new Date().toISOString());
});

seed();
console.log('✅ Database seeded with sample data.');
console.log(`   Demo login → email: ${DEMO_EMAIL}  password: ${DEMO_PASSWORD}`);