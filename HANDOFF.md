# Handoff: Aurora / Life OS — full-stack productivity app

> Resume by reading this whole file before taking any action. Do not repeat
> approaches listed under "Tried and failed" below.

## TL;DR

Aurora is a solo-built (Haneen Turkieh, 19, CS student at An-Najah National
University, Nablus) full-stack productivity app — React/Vite client on Vercel,
Node/Express server on Render, Turso libSQL DB, Claude Haiku for AI features.
This was a long, thorough bugfix + polish session. **Everything reported this
session is fixed and pushed.** The two real open threads are: (1) picking and
integrating a real payment gateway (in progress — researching Arab Bank's
merchant gateway, since Stripe/PayPal both exclude Palestine-based merchants),
and (2) whether/when to buy a domain (recommended: buy now, connect later).
Next session should start by asking the user for a status update on both.

## 1. Goal

- **Objective:** Keep building out and fixing Aurora, a productivity app with
  tasks/goals/habits/calendar, a gamified Pomodoro ("Flow" — trees die if you
  quit early, shared study rooms), an AI assistant ("Lumi"), an AI exam/study
  generator, analytics, and a CV/launchpad builder. Full English/Arabic (RTL)
  localization throughout.
- **Why it matters / success looks like:** The app should work correctly
  across devices (sync), not spam/annoy users (notifications), feel warm and
  supportive where it matters (Lumi's tone), and eventually generate real
  revenue via a Premium tier — currently a free-preview toggle with **no real
  payment processing wired up yet**.
- **Constraints:** User is not a professional dev — explain fixes in plain
  language, always give exact terminal/push commands, never assume prior
  git/Node knowledge. Regional constraint: Nablus, West Bank — Stripe does not
  support Palestine-based merchants; PayPal also excludes Palestinian
  merchant accounts (confirmed via search this session).

## 2. Decisions, attempts, and learnings

- **Decided: monorepo, not two repos.** `client/` and `server/` are two
  folders inside ONE git repo (`github.com/HaneenTurkieh/LifeOS`), with the
  single `.git` living at the parent `lifeDashboard/` folder. Earlier in the
  session I mistakenly treated them as separate repos and gave duplicate push
  commands — harmless (both pushed the same repo) but unnecessary. **Going
  forward: one `git add -A && git commit && git push` from either folder
  covers the whole project.**
- **Decided: cross-device sync uses polling + version counters, not
  WebSockets.** Applies to the solo Pomodoro timer, room timer, light/dark
  mode, and accent color. Client polls every 5s; server stores a version int
  that increments on write; server stores `remaining_seconds` + `started_at`
  snapshots for timers so clients compute live countdowns locally (no clock
  sync needed). Chosen over WebSockets because Render's free tier sleeps on
  inactivity, making persistent connections impractical, and 5s latency is
  fine for this use case. Full rationale in `ARCHITECTURE.md` (repo root).
- **Decided: notification dedup uses two different rules.** Entity-scoped
  (overdue task, goal deadline) = once per entity, forever, until resolved —
  link encodes the entity ID. Day-scoped (streak reminder) = once per
  calendar day. Mood check-ins = once per **checkpoint** (12:00/15:00/18:00/
  21:00), not once per day — this was a real bug (mood notif fired once ever
  per day, then blocked all later checkpoints).
- **Tried and failed: check-then-insert dedup for notifications.** Caused an
  **8x duplicate bug** — a genuine race condition where multiple overlapping
  requests (multiple tabs, bell polling) all checked "does this exist?"
  before any of them finished inserting, so all inserted their own copy.
  **Fixed properly** with a real DB-level `UNIQUE(user_id, dedupe_key)` index
  + `INSERT ... ON CONFLICT DO NOTHING`, which is atomic regardless of
  concurrency. Do not go back to application-level check-then-insert for
  any dedup logic in this codebase.
- **Key learning: Safari flattens 3D CSS transforms on any element that also
  has `backdrop-filter`.** This silently broke the onboarding "paper fold"
  animation (played as a flat fade instead of a 3D fold) with zero console
  error. Fix pattern: split into two nested elements — outer does the 3D
  transform (no blur), inner does the blur/glass styling (no transform).
  Applies anywhere else in the codebase that combines `rotateX/Y` with
  `backdrop-filter`.
- **Key learning: this Node install (`v25.8.2`) has a broken `node --test`
  directory-scan** — `node --test lib/` throws `MODULE_NOT_FOUND` for the
  directory itself, even when files exist inside it. Workaround: point at
  the exact test file instead (`node --test lib/notificationDedupe.test.js`).
  v25 is far ahead of Node LTS (22.x) — likely a Current/nightly build via
  `nvm install node` instead of `nvm install --lts`. Not fixed, just noted.
- **Key learning: `jsPDF`'s built-in fonts can't shape Arabic script**
  (no initial/medial/final letterform joining) — Arabic PDF text renders
  broken even with a font loaded. Fixed by detecting Arabic content
  (`containsArabic()` in `ExamAssistant.jsx`) and routing those exports
  through an `html2canvas` screenshot-then-embed path instead (loses
  selectable text, but renders correctly — browser's own text engine does
  the shaping). English exports stay as fast native jsPDF text. PPTX exports
  have no such limitation in either language (PowerPoint shapes text itself).
- **Key learning: `translations.js` keys without a `{n}` placeholder silently
  swallow the value** when called as `t('key', {n: count})` — e.g.
  `'exam.questions': 'Questions'` called with `{n: 10}` just showed
  "Questions" with no number, nowhere. Root-caused and fixed by adding the
  placeholder into the string itself (`'Questions: {n}'`) rather than
  patching every call site.
- **Open question:** Payment gateway choice — user is currently checking
  whether Arab Bank's new (as of ~2026) direct merchant payment gateway
  integration will work for Aurora. See Section 4 below for full detail.
  Nothing built yet — do not assume a gateway is chosen.
- **Open question:** Domain name — recommended buying now (cheap, no
  downside) but not yet purchased as of this handoff. See Section 4.

## 3. Current state

- **Stage:** App is stable. All bugs reported this session have confirmed
  fixes deployed (both Vercel and Render last confirmed "Ready"/"Live").
  Feature-complete for a free-tier productivity app; Premium is UI-only
  (no real payment collection).
- **Repo:** `github.com/HaneenTurkieh/LifeOS`, single repo, `client/` +
  `server/` subfolders, branch `main`. Local path:
  `~/Desktop/full-stack projects/lifeDashboard/`
- **Deploys:** Client → Vercel (`life-os-three-xi.vercel.app`). Server →
  Render (`lifeos-0l81.onrender.com`). DB → Turso (libSQL).
- **Recently touched files (this session, all pushed):**

  | File | Status |
  |---|---|
  | `server/lib/notificationDedupe.js` + `.test.js` | done — extracted pure dedup-key function, unit tested (`node --test lib/notificationDedupe.test.js` → 5-6 pass) |
  | `client/src/utils/timerSync.mjs` + `.test.mjs` | done — extracted pure timer-sync function, unit tested (`node --test src/utils/timerSync.test.mjs` → 3 pass) |
  | `server/db/connection.js` | done — added `dedupe_key` column + UNIQUE index migration (self-cleans existing dupes on boot), `theme_mode`, `font_scale` columns |
  | `server/routes/notifications.js` | done — atomic insert via `ON CONFLICT DO NOTHING`, mood checkpoints (12/15/18/21) |
  | `server/routes/focus.js` | done — solo timer sync endpoints, theme-mode endpoints, font-scale endpoints, premium/theme endpoints |
  | `server/routes/chat.js` (Lumi) | done — Palestinian Arabic dialect instruction, emotional-support-first behavior (was coldly redirecting to tasks), removed hardcoded personal easter egg, Deep Search nudge (narrow regex: digit + %/million/billion/thousand only) |
  | `client/src/context/FocusContext.jsx` | done — solo timer now server-authoritative (imports `computeFromServer` from `utils/timerSync.mjs`) |
  | `client/src/context/ThemeContext.jsx` | done — polls theme-mode + accent + font-scale every 5s; exports `FONT_SCALES` |
  | `client/src/App.jsx` | done — **root-caused a real bug**: `Onboarding` component existed fully built but was never imported/rendered anywhere. Now wired into `AppShell` as overlay gated on `isOnboarded(user.id)`. |
  | `client/src/pages/Onboarding.jsx` | done — paper-metaphor animation: unfold-in on welcome (Safari-safe two-layer split), page-turn flap between feature steps, refold-and-close on finish |
  | `client/src/pages/ExamAssistant.jsx` | done — real PDF (jsPDF)/PPTX (pptxgenjs) export for all 5 modes; Arabic auto-routes to html2canvas snapshot path; heads-up toast before slow Arabic export |
  | `client/src/pages/Goals.jsx` | done — edit-goal modal (pencil icon), add-milestone-to-existing-goal wired to already-existing `POST /goals/:id/milestones` |
  | `client/src/components/SettingsModal.jsx` | done — fixed a real syntax error (stray `import` inside a function body), added font-size slider (Apple Text-Size style, 5 steps) to Appearance tab, `perkExam` badge flipped SOON→LIVE |
  | `client/src/i18n/translations.js` | done — added `{n}` placeholders to `exam.questions`/`exam.cards`/`exam.minSlides`, added `goals.editGoal` key |
  | `client/src/pages/AITools.jsx` | done — Deep Search nudge UI, accent-color sweep |
  | `README.md`, `LICENSE`, `ARCHITECTURE.md` | done — added at repo root |
  | `server/routes/feedback.js`, `server/lib/email.js` | done — feedback now routes through the working Brevo-first email chain instead of a broken standalone Resend call. **User has not yet personally verified a test feedback email arrives** — flagged as unverified, not unfixed. |

- **How to verify sync/dedup fixes work:**
  `node --test lib/notificationDedupe.test.js` (server folder) and
  `node --test src/utils/timerSync.test.mjs` (client folder) — both should
  show all tests passing, zero failures.
- **Blockers:** None on the code side. Payment gateway is a business/regional
  research blocker, not a code blocker (see Section 4).

## 4. Two things explicitly requested to be detailed in full

### Payment gateway (NOT built — research in progress)
- Stripe: **confirmed not supported** for Palestine-based merchants (no
  merchant account possible regardless of customer location).
- PayPal: **confirmed excludes Palestinian merchant accounts** (both Gaza
  and West Bank), per current search results.
- **Live lead the user is chasing right now:** someone posting from Nablus
  specifically said **Arab Bank now offers a direct payment gateway
  integration for merchants** (mentioned as new "this year" in a Shopify
  community thread). User is contacting Arab Bank directly to confirm terms/
  API. **Do not build anything against this until the user confirms concrete
  details** (API docs, webhook support, supported currencies) — nothing is
  chosen yet.
- **Suggested bootstrap fallback** (offered, not yet built): manual
  WhatsApp/bank-transfer collection from An-Najah classmates while the real
  gateway gets sorted, optionally with a lightweight "request premium"
  in-app flow that notifies the dev instead of processing payment directly.
- **Pricing already discussed and recommended** (independent of gateway
  choice): ~8–10 NIS/month or ~35–40 NIS/semester (semester pass should be
  the headline price — students think in semesters). Based on live rate at
  the time (~1 USD ≈ 3.06 NIS). Roughly 9 semester subscribers fully
  recoups the user's stated ~$300 sunk cost.
- **Premium feature list already agreed as the "what to gate" plan**
  (some partially/fully implemented, some not):
  - Exam Assistant generation limit for free tier (recommended, **not yet
    implemented** — only the *history retention* cap exists today, not a
    generation-count cap)
  - Deep Think / Deep Search modes premium-gated (recommended, **not yet
    implemented** — currently free/unlimited for everyone)
  - Branded/watermarked free exports vs clean premium exports — **already
    implemented**, premium-gated, working (CV PDF/Word, Exam Assistant
    PDF/PPTX all carry a small "Made with Aurora" credit on free tier,
    removed entirely for premium; gated via `isPremium` from
    `ThemeContext.jsx`, sourced from `GET /focus/premium/status`)
  - Study room creation/hosting gated, joining stays free (recommended,
    **not yet implemented**)
  - Streak pause — **already implemented**, premium-gated, working
  - Custom accent themes — **already implemented**, premium-gated, working
  - Unlimited exam history — **already implemented** (free tier capped at
    15 most recent, auto-pruned)

### Domain
- **Recommendation given: buy now**, connect later — buying doesn't require
  immediately migrating the live app, costs ~$10–15/yr, and removes the risk
  of losing the name.
- **Naming flag:** "Aurora" alone is very likely taken as `.com` (AWS Aurora,
  a Firaxis game, etc. already use it). Suggested trying `.app` or `.io`
  TLDs and/or variants like `getaurora.app`, `useaurora.io`, `aurora-os.app`.
- **Registrar recommendation:** Cloudflare Registrar (sells at cost, no
  markup, free WHOIS privacy) or Namecheap. Explicitly avoid GoDaddy
  (aggressive upsells, steep renewal price jumps).
- **Steps once purchased (not yet done):**
  1. Vercel dashboard → `life-os` project → Settings → Domains → add domain
     → follow the DNS records Vercel provides (usually one A + one CNAME).
  2. Update `server/index.js`'s `allowedOrigins` array to include the new
     domain (currently only has the Vercel URLs — CORS will block the new
     domain otherwise).
  3. Set `CLIENT_URL` env var on Render to the new domain (used by
     `server/lib/email.js` for password-reset link generation — currently
     falls back to the Vercel URL).
  4. Optional: CNAME a subdomain like `api.yourdomain.com` to the Render
     backend for cosmetic polish (not functionally required).

## 5. How the user likes code delivered (apply every time)

- **Always full files, not diffs or partial snippets** — the user has
  repeatedly hit real bugs from partial/manual edits (a dropped closing
  brace, a misplaced `import` statement, a file overwritten with the wrong
  content). When a file is genuinely too large to be worth re-pasting in
  full for a one-line change, explicitly say so and give an exact
  find-this/replace-with-this block instead of assuming they'll splice it
  in correctly.
- **Always give the exact `git add -A && git commit -m "..." && git push
  origin main` command** after code changes — one combined command per
  logical change, run from either `client/` or `server/` (same repo, see
  Section 2). Don't give separate push commands for client vs server
  changes anymore.
- **User is not a professional developer** — explain *why* something broke
  in plain terms before giving the fix, not just the fix. They've directly
  asked for root-cause explanations multiple times (e.g. "why not in normal
  tabs?", "is it possible you pasted connections wrongly?").
- **User tests via VS Code + Terminal on a Mac, and Safari/Chrome private
  windows for cache-free testing.** They've learned the hard way that
  multi-line heredocs (`cat > file << 'EOF' ... EOF`) pasted into Terminal
  are fragile and get silently truncated — **prefer telling them to create
  files directly in VS Code** (open file, select-all, paste, save) over
  terminal heredocs for anything more than a couple of lines.
  - **Watch out for stale terminal error-output confusion.** More than once
    in this session, the user re-pasted an *old* error message alongside
    new (successful) output, causing back-and-forth confusion about whether
    something was still broken. When output looks contradictory, ask for a
    fresh, isolated re-run rather than assuming a re-fix is needed.
- **Commit messages should be genuinely descriptive** — the user reads them
  and has referenced them back in conversation as documentation of what
  changed and why. Keep that standard.
- **When something is ambiguous or a business/regional decision (not a code
  decision), say so plainly and don't build speculatively** — this
  established itself firmly in the payment-gateway conversation. Get
  confirmation before writing code against an unconfirmed provider.

## Next step

Ask the user for a status update on (1) what Arab Bank said about their
merchant gateway, and (2) whether they've purchased a domain yet. Based on
their answer, either: build the real payment integration against confirmed
Arab Bank gateway docs, or continue with other feature work. If neither has
moved, a good default next task is implementing the still-unbuilt Premium
gates from Section 4 (Exam Assistant generation limits, Deep Think/Search
gating, branded free exports) since those don't depend on the payment
provider being chosen yet — they just need the `is_premium` flag, which
already exists.
