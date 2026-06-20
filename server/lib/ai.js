// lib/ai.js
// A lightweight, rule-based "AI" engine.
// It ships with zero external dependencies so the app runs fully offline —
// but every function here is a clean drop-in point for a real LLM call later.
// See README.md "Connecting a real AI" for how to swap these for the
// Anthropic API in about 10 lines per function.

const QUOTES = [
    { text: 'Small daily improvements lead to staggering long-term results.', author: 'James Clear' },
    { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
    { text: "Don't watch the clock; do what it does. Keep going.", author: 'Sam Levenson' },
    { text: 'Discipline is choosing between what you want now and what you want most.', author: 'Abraham Lincoln' },
    { text: 'You do not rise to the level of your goals; you fall to the level of your systems.', author: 'James Clear' },
    { text: 'Action is the foundational key to all success.', author: 'Pablo Picasso' },
    { text: 'A year from now you may wish you had started today.', author: 'Karen Lamb' },
  ];
  
  function quoteOfTheDay() {
    const day = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    return QUOTES[day % QUOTES.length];
  }
  
  // ---------- AI Daily Planner ----------
  // Builds an hour-by-hour plan from available hours + energy level,
  // front-loading hard/important tasks when energy is high.
  function buildDailyPlan({ availableHours = 4, energy = 'medium', tasks = [] }) {
    const sorted = [...tasks].sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    });
  
    const blocks = [];
    let hour = 9; // default start time
    let remaining = availableHours;
    const energyBlockLength = energy === 'high' ? 1.5 : energy === 'low' ? 0.75 : 1;
  
    // Deep work first while energy is freshest, if energy is high/medium.
    if (energy !== 'low') {
      blocks.push({ time: `${formatHour(hour)}–${formatHour(hour + energyBlockLength)}`, label: 'Deep work block', detail: sorted[0]?.title || 'Highest priority task', type: 'focus' });
      hour += energyBlockLength; remaining -= energyBlockLength;
    }
  
    blocks.push({ time: `${formatHour(hour)}–${formatHour(hour + 0.25)}`, label: 'Short break', detail: 'Stretch, water, breathe', type: 'break' });
    hour += 0.25;
  
    let taskIdx = energy !== 'low' ? 1 : 0;
    while (remaining > 0.5 && taskIdx < sorted.length) {
      const len = Math.min(1, remaining);
      blocks.push({ time: `${formatHour(hour)}–${formatHour(hour + len)}`, label: sorted[taskIdx].title, detail: `${sorted[taskIdx].category} • ${sorted[taskIdx].priority} priority`, type: 'task' });
      hour += len; remaining -= len; taskIdx += 1;
      if (remaining > 0.5) {
        blocks.push({ time: `${formatHour(hour)}–${formatHour(hour + 0.25)}`, label: 'Quick break', detail: 'Reset before the next block', type: 'break' });
        hour += 0.25;
      }
    }
  
    if (remaining > 0) {
      blocks.push({ time: `${formatHour(hour)}–${formatHour(hour + remaining)}`, label: 'Habits & review', detail: 'Knock out today\'s habits, review tomorrow', type: 'habit' });
    }
  
    const tip = energy === 'low'
      ? 'Energy is low today — lean on short, low-friction blocks and protect a real rest period.'
      : energy === 'high'
        ? 'Energy is high — this is the day to tackle your hardest, most important task first.'
        : 'Steady energy — alternate focus blocks with short breaks to keep momentum.';
  
    return { blocks, tip };
  }
  
  function formatHour(h) {
    const hour = Math.floor(h);
    const min = Math.round((h - hour) * 60);
    const period = hour >= 12 ? 'PM' : 'AM';
    const display = hour % 12 === 0 ? 12 : hour % 12;
    return `${display}:${min.toString().padStart(2, '0')} ${period}`;
  }
  
  // ---------- Goal Breakdown ----------
  function breakdownGoal({ title, weeks = 4 }) {
    const templates = [
      (g) => `Research and define what "done" looks like for ${g}`,
      (g) => `Break ${g} into the 3 biggest sub-tasks`,
      (g) => `Make visible progress on the first sub-task`,
      (g) => `Get feedback from someone further along`,
      (g) => `Push through the hardest remaining piece`,
      (g) => `Polish and tie up loose ends`,
      (g) => `Final review and ship/finish`,
      (g) => `Reflect on what worked and lock in the habit`,
    ];
    const plan = [];
    for (let w = 1; w <= weeks; w++) {
      const idx = Math.min(w - 1, templates.length - 1);
      plan.push({ week: w, focus: templates[idx](title) });
    }
    return plan;
  }
  
  // ---------- Smart Prioritizer ----------
  // Classic Eisenhower-style sort using deadline proximity + stated priority.
  function prioritizeTasks(tasks = []) {
    const today = new Date();
    const buckets = { urgent: [], important: [], optional: [] };
    tasks.forEach((t) => {
      const daysLeft = t.deadline ? Math.ceil((new Date(t.deadline) - today) / 86400000) : null;
      const isSoon = daysLeft !== null && daysLeft <= 2;
      const isHigh = t.priority === 'high';
      if (isSoon && isHigh) buckets.urgent.push(t);
      else if (isHigh || isSoon) buckets.important.push(t);
      else buckets.optional.push(t);
    });
    return buckets;
  }
  
  // ---------- Productivity Coach ----------
  function productivityInsights({ tasksDoneThisWeek, tasksTotalThisWeek, habitCompletionRate, streak, mood }) {
    const insights = [];
    const completionRate = tasksTotalThisWeek > 0 ? Math.round((tasksDoneThisWeek / tasksTotalThisWeek) * 100) : 0;
  
    insights.push(
      completionRate >= 70
        ? `Strong week: you've closed out ${completionRate}% of planned tasks. Keep the momentum — consider raising next week's target slightly.`
        : completionRate >= 40
          ? `You're at ${completionRate}% task completion this week. Try timeboxing your top 3 tasks each morning to push that higher.`
          : `Only ${completionRate}% of tasks closed this week — that's a signal to cut scope, not push harder. Pick 3 must-do tasks tomorrow and ignore the rest.`
    );
  
    insights.push(
      habitCompletionRate >= 80
        ? `Habits are rock solid at ${habitCompletionRate}% completion — this consistency compounds more than any single big effort.`
        : `Habit completion is at ${habitCompletionRate}%. Anchor weaker habits to ones you already do consistently (habit stacking).`
    );
  
    if (streak >= 7) insights.push(`Your ${streak}-day streak is your strongest asset right now — protect it before adding new commitments.`);
    if (mood !== undefined && mood <= 2) insights.push(`Mood's been low lately. Productivity systems work best with rest built in — consider a lighter day before pushing again.`);
  
    return insights;
  }
  
  // ---------- Anti-Procrastination Mode ----------
  function antiProcrastinationVersions(taskTitle) {
    return {
      five_minute: `Spend just 5 minutes opening "${taskTitle}" and writing down the very first physical step. Stop after 5 minutes if you want — momentum often carries you further.`,
      fifteen_minute: `Set a 15-minute timer and make visible progress on "${taskTitle}": draft an outline, write a rough first version, or clear one blocker. Imperfect progress counts.`,
      one_hour: `Block a focused hour for "${taskTitle}": 5 min to plan, 45 min of deep, distraction-free work, 10 min to review what's left and queue the next step.`,
    };
  }
  
  module.exports = {
    quoteOfTheDay, buildDailyPlan, breakdownGoal, prioritizeTasks,
    productivityInsights, antiProcrastinationVersions,
  };