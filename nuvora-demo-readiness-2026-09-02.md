# Nuvora — Demo Readiness Review (Sept 2, 2026)

Full pass over the live site (instructor account) plus a code review of every page, done as if I were a judge/recruiter clicking around for the first time. Everything below marked **Fixed** is already changed in the repo but not yet deployed — push before the demo.

## Fixed this pass

**Instructor bell kept spamming "log your mood" every few hours.** The notification-filtering fix from earlier only covered the interactive bell (`GET /notifications`) — the two background cron jobs (email + push reminders) call the same generator directly, once per user, with no role check of their own. Moved the instructor check into the generator itself so every current and future caller is covered. Cleared the stale notifications off the live instructor account.

**A stale browser tab could hard-crash on navigation.** Every page is lazy-loaded by a content-hashed chunk file. If a deploy lands while someone already has the app open, clicking into any page whose chunk changed throws "Failed to fetch dynamically imported module" straight to the crash screen — reproduced this live, it's what the "Something went wrong" screen was from earlier today. Now auto-reloads once, silently, instead of showing an error. This is a real risk if you push anything mid-demo.

**Points form: the Reason field was functionally unusable.** In "Give or deduct points," the Amount input was stretching to fill almost the entire row and Reason was squeezed to ~30px — unreadable, untypeable. Root cause: the shared input class already sets `w-full`, which silently wins over a narrower width class placed after it in Tailwind's generated stylesheet, regardless of source order. Same bug was hiding in two more places (join-by-code field, announcement date/time fields) — fixed all three.

**Premium tab: instructor accounts still saw "reach level 5 to unlock a trial."** The earlier instructor Premium curation (perks/pricing/streak) missed this one banner. Instructors don't do the XP-earning actions leveling is built on, so this was permanently-almost-true noise. Dropped it for instructor accounts, same treatment as the onboarding XP hint.

**Corner buddy (Nova) showing a wrong-day mood.** Covered separately — timezone mismatch between the server's UTC "today" and the browser's local "today," fixed in `App.jsx` / `mood.js`.

## Needs a decision, not a code fix

**A whole feature is built and invisible.** `Learning.jsx` — a Courses/Books/Certifications tracker — has a complete backend (`/api/learning`, DB schema, seed data) and a polished, bug-fixed frontend component, but no route or nav item points to it anywhere. Nobody can reach it. Either it's worth surfacing (a legitimate extra feature to show judges) or it's intentionally shelved — worth a conscious call either way rather than leaving it as dead code a judge could stumble on by guessing a URL.

## Worth knowing about, lower stakes

**Instructor Dashboard is sparse.** After the welcome card and one channel card, the rest of the page is empty space. Not broken, just a thin first impression if a judge's first click is the instructor view.

**Channels page stacks a lot above the tabs.** The Students list + Invite-by-email card sit above the tab bar on every tab, so on a normal laptop screen the Chat composer (and other tab content) needs a scroll to reach. Not broken, just tight — worth a look if you want Chat to feel snappier to demo.

**i18n audit came back clean.** Ran a full EN/AR key-parity check — every key that exists in one language exists in the other, 1053/1053. No raw translation-key leaks to worry about.

## Verified solid

- Instructor onboarding (Welcome → Create channel → Lumi shortcuts → Done) — correct copy, no orphaned data, no dead-end shortcuts.
- Channel-scoped Flow leaderboard — genuinely scoped, clearly distinguished from the app-wide rankings link.
- Channel Analytics — Total XP and Channel Points now separate, sensible columns.
- Instructor Premium perks — correctly down to just Unlimited AI + Custom Themes, pricing untouched.
- Paddle checkout — confirmed (again) it's their account approval queue, not your code.

## Suggested order before judges see it

1. Push everything above, redeploy, hard-refresh to confirm the chunk-crash fix and points-form fix actually render right.
2. Decide on Learning — surface it or leave it out on purpose.
3. Quick look at the two "worth knowing" polish items if there's time.
