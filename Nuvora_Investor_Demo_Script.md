# Nuvora Investor/Heads Demo — Script + Build Guide
**Target runtime:** ~2:45 (2-3 min band) · **Audience:** investors and program heads (judges, CAP/university leadership) · **Style:** narrated walkthrough, real screen recordings + motion-graphics framing · **Tools:** Motion.so (primary build) + Google Veo 3.1 (optional, for a handful of fully-generated abstract beats)

> This is a **separate piece** from `Nuvora_Promo_Shot_List.md` / the Vevara build — that ~50s kinetic-typography cut stays as-is for social/general use. This one is longer, narrated in full sentences instead of sparse VO + text, and goes deeper on the features and framing an investor or a program head actually weighs a decision on (breadth of the product, the founder story, the business model, the fact it's live).

---

## 0. Tool notes — why Motion.so is the primary build tool here

Quick comparison, since you have both open:

**Motion.so** — an AI video *agent*, not a raw generator. It reads a site (you'd point it at `nuvora.ps`) to pull real brand colors/type/references, storyboards scene-by-scene from a prompt, and — critically — it explicitly supports **"motion design for existing videos,"** meaning it can take your own screen recordings and build motion graphics, voiceover, music, and captions *around* them, rather than only generating fake scenes from scratch. Output is edited element-by-element afterward (drag/resize/re-time, or just tell it in chat what to change) instead of full-scene reroll. This matches exactly how the 50s promo was built in Vevara — real UI footage, generated motion graphics around it — so it's the natural primary tool for this piece too. Paid tiers start around $5.
[Motion.so overview](https://theresanaiforthat.com/ai/motion-so/) · [Motion video-agent workflow](https://www.producthunt.com/products/motion-8)

**Google Veo 3.1** — a pure text-to-video generator, not footage-aware. Strong for short (8s base, extendable in chained segments to ~140s), cinematic, fully-synthetic clips with native audio and strong visual quality up to 4K, but it doesn't ingest your screen recordings — every frame is generated from a prompt. It's the right tool only for the handful of moments in this script marked **[GEN]** below, where you actually want fully abstract/generated motion graphics (no real UI, no real people) rather than footage-based editing. Pricing runs $0.10–$0.60/second depending on mode/resolution, so keep [GEN] use to short, deliberate beats, not the whole video.
[Veo 3.1 capabilities & pricing](https://www.buildfastwithai.com/blogs/google-veo-3-1-ai-video-generator)

**Recommendation:** build the whole thing in Motion.so, uploading your real screen recordings per scene (same footage-first philosophy as the 50s promo — "this is a real, live, working product"). Only reach for Veo on the 2-3 [GEN] beats marked below, then bring that clip into Motion.so as an uploaded asset for its Moment, same as any other footage.

---

## 1. Footage checklist — record these first

Same principle as the Vevara guide: record all real screen footage before opening Motion.so, so you're not context-switching mid-build. Screen-record nuvora.ps (QuickTime → File → New Screen Recording, or Cmd+Shift+5) for each:

1. **Dashboard** — slow zoom into task/goal/habit summary cards (reuse from the 50s promo if you already have this clip).
2. **Tasks board → Goals w/ milestones → Calendar → Habit streaks** — one continuous cursor-driven pass (reuse from the 50s promo).
3. **Lumi, two beats this time:**
   - "I have an exam Thursday, help me plan my week" → response streams in → action chip ("✅ Task created") (reuse from the 50s promo).
   - **New:** ask Lumi to log a mood or check a habit streak — showing Lumi *acting on the app*, not just chatting, is the point for this audience.
4. **Focus timer + tree growing**, and if you have it, a **Room** (shared focus session) — the Rooms feature isn't in the 50s cut and it's a real differentiator (social/retention mechanic), worth 3-4s here.
5. **Exam Assistant** — uploading notes/a file → AI-generated practice exam appearing (MC/fill-in-the-blank/mixed) → the countdown timer starting. New footage, not in the 50s promo.
6. **Launchpad** — CV builder screen, then the internship/project tracker. New footage.
7. **Analytics/gamification** — XP bar or level-up moment, growth chart (reuse from the 50s promo).
8. **Language toggle** — EN → AR switch on any real screen, held 1-2s each side so the RTL layout is visibly correct. New footage — bilingual-from-day-one is a differentiator worth *proving*, not just claiming.
9. **Premium/pricing screen** — the subscription tiers (monthly/semester/annual, NIS). New footage.

---

## 2. Script — shot by shot

Legend: **[VO]** = full-sentence narration (not sparse this time) · **[TEXT]** = on-screen text/lower-third · **[UI]** = real screen recording · **[GEN]** = Veo-generated abstract motion graphics, no real UI/people

### 0:00–0:10 — THE PROBLEM
**[UI/stock]** Same chaotic-cuts opening as the 50s promo (notifications, cluttered notes, red-deadline calendar) — but let it run a beat longer here since there's no rush to a 50s mark.
**[TEXT]** "Student life isn't just assignments."
**[VO]** "Every student juggles the same five or six apps just to stay on top of their life — one for tasks, one for notes, one for focus, one for everything else."

### 0:10–0:22 — THE FOUNDER BEAT *(new — not in the 50s cut)*
**[GEN]** Abstract motion graphic: soft lavender light gathering from scattered points into a single glowing sparkle mark (Nuvora's ✦), evoking "dawn" without literal imagery of a person or place.
**[TEXT]** "Built by a 19-year-old CS student in Nablus, Palestine."
**[VO]** "Nuvora is built solo by Haneen Turkieh — a computer science student who needed this tool to exist, so she built it. Bilingual, English and Arabic, from day one."
*This is the line that separates this cut from the 50s promo — investors and program heads weigh the builder, not just the product. Keep it short and confident, not a plea.*

### 0:22–0:30 — THE TURN
**[UI]** Fade to the logo mark, then morph into the Dashboard, same beat as the 50s promo but held slightly longer.
**[TEXT]** "Meet Nuvora."
**[VO]** "A Life OS, built for a student's entire life — not just their to-do list."

### 0:30–0:50 — CORE EXPERIENCE
**[UI]** Tasks → Goals w/ milestones → Calendar → Habit streaks, continuous cursor-driven pass (reuse 50s-promo footage, held longer per screen — ~4-5s instead of ~2s).
**[TEXT, lower-third]** "Plan." / "Achieve." / "Track." / "Build."
**[VO]** "Tasks, goals with real milestones, a full calendar, and habit tracking — the everyday structure of student life, in one place instead of four apps."

### 0:50–1:12 — LUMI
**[UI]** Both Lumi beats from the footage checklist: the exam-planning demo, then the mood-log/habit-check demo.
**[VO]** "Lumi is woven through the whole app — not a chatbot bolted on the side. It remembers context across conversations, nudges you about deadlines, and can actually act: log a mood, check a streak, create a task — all from a sentence."
*Hold on the second action-chip confirmation before cutting — same payoff principle as the 50s promo.*

### 1:12–1:32 — FLOW & THE FOREST
**[UI]** Focus timer starting, tree growing (the real in-app animation), then — if recorded — a quick beat on a Room.
**[TEXT]** "Protect your focus. Together, if you want."
**[VO]** "Every focus session plants a tree. Break focus, and it can die — so the incentive is real, not decorative. And Rooms let friends share a timer and grow a forest together, so studying isn't a solo grind."

### 1:32–1:50 — EXAM ASSISTANT *(new — not in the 50s cut)*
**[UI]** Upload notes → AI-generated practice exam appears → countdown timer starts.
**[TEXT]** "Upload your notes. Get a real exam."
**[VO]** "Upload your own notes or files, and Nuvora generates a real practice exam — multiple choice, fill-in-the-blank, a real difficulty rubric, a real countdown. It's a personal exam simulator, not a flashcard app."

### 1:50–2:06 — LAUNCHPAD *(new — not in the 50s cut)*
**[UI]** CV builder → internship/project tracker.
**[TEXT]** "What comes after graduation."
**[VO]** "And because student life doesn't end at the final exam, Launchpad carries that same structure into the CV and the internship search."

### 2:06–2:18 — PROOF: ANALYTICS + BILINGUAL
**[UI]** Quick cut: XP/level-up or growth chart, then the EN→AR language toggle held on both sides.
**[TEXT]** "Grow, visibly." / on the toggle: "English." → "عربي."
**[VO]** "Progress is visible — XP, streaks, growth charts. And every one of these screens works the same in Arabic as it does in English, because that was a day-one requirement, not a translation pass bolted on later."

### 2:18–2:32 — THE BUSINESS *(new — not in the 50s cut)*
**[UI]** Premium/pricing screen.
**[TEXT]** "A real subscription. A real, live product."
**[VO]** "Nuvora is live today at nuvora.ps, with a working subscription — monthly, semester, or annual — priced for the market it's built for. This isn't a prototype; it's a product people can pay for right now."
*Keep this beat honest and unembellished — no invented user counts or revenue figures. If you have a real traction number (users, waitlist, retention) you want to say out loud by the time this is recorded, this is where it goes; leave it out entirely rather than round up.*

### 2:32–2:45 — BRAND ENDING
**[UI→GEN]** Fade from the last UI frame to the lavender-gradient background (reuse the 50s promo's ending treatment, or the same Veo-generated light beat from 0:10 as a bookend).
**[TEXT]** "NUVORA.PS" → beat → "Your student life. One system."
**[VO]** "Nuvora. Your student life — one system, built by the student who needed it."

---

## 3. Motion.so build notes

Motion.so works from a prompt + your assets rather than a Moments editor like Vevara, so the build shape is different:

1. **Seed prompt** (paste this first, then attach `nuvora.ps` as the reference site so it pulls the real palette/type instead of guessing):
   > "Build a ~2:45 narrated product-demo video for Nuvora, a bilingual student productivity app. Pull brand colors, type, and references from nuvora.ps. I'm uploading real screen-recorded footage for each scene — use it as the actual visual, don't regenerate the UI. Add motion graphics, lower-third text, and transitions around the footage per the scene notes below. Voiceover should read the VO lines I provide, in one consistent warm, calm, slightly poetic voice — not corporate, not hyped. Music should build gradually rather than hit hard on cuts. Stay entirely inside the violet/lavender gradient system (#7C6AF0 → #5B47E0); don't introduce a new palette."
2. Go scene by scene down section 2 above: upload the matching footage clip (or the Veo [GEN] clip) to each scene, paste that scene's [VO] line as the narration text for Motion to read, and paste the [TEXT] line as the on-screen text.
3. Use the chat-iterate step to fix anything Motion's storyboard gets wrong on a first pass (timing, a text placement, a transition style) rather than regenerating the whole scene.
4. Check the running total against the 2:45 target as you go — Motion's timeline should show it live.
5. Before export: confirm no scene is still showing placeholder/template art, and that the two [GEN] Veo clips (if used) sit inside the same lavender system as everything else — regenerate them with a tighter color prompt if they drift.

## 4. Veo 3.1 prompts — for the [GEN] beats only

Two short, optional prompts for the fully-generated abstract beats. Keep these to 8s base clips (Fast mode is enough quality for a background/transition beat, not the hero shot) to control cost.

**Founder-beat light gather (0:10–0:22 bookend, and reusable at 2:32 for the ending):**
> "Abstract cinematic motion graphic, no people, no text, no logos. Soft glowing particles of lavender and deep violet light (#7C6AF0 to #5B47E0) drifting slowly from the edges of frame and gathering gently toward the center, converging into a single soft four-point sparkle of light. Calm, slow, dreamlike movement, like dawn breaking over a dark sky. Shallow depth of field, subtle bloom, no hard edges or sharp transitions. 8 seconds, seamless loopable feel, dark background."

**Optional second [GEN] beat, if you want a distinct clip for the ending instead of reusing the first:**
> "Abstract cinematic motion graphic, no people, no text, no logos. A calm dark violet gradient background with soft light slowly blooming outward from the center, like a sunrise made of light rather than color, resolving into a clean soft-focus lavender gradient (#7C6AF0 to #5B47E0) that fills the frame by the end. Slow, confident, unhurried pacing. 8 seconds."

Bring each Veo output into Motion.so as an uploaded clip for its scene, same as the real footage — Motion.so doesn't need to know which clips are generated vs. recorded.

---

## 5. What's deliberately left for you to fill in

Nothing in this script invents numbers, a funding ask, or traction claims — none of that is something I have real figures for, and guessing would be the wrong kind of wrong for an investor audience. Before this gets recorded, you'll want to decide:
- Whether to state any real traction (user count, retention, a waitlist number) in the 2:18–2:32 business beat, or leave it as-is (live product, real subscription, no numbers).
- Whether there's a specific ask at the very end for investors (funding amount/stage) or for program heads (a partnership, a pilot, classroom adoption) — the current close is deliberately open-ended ("your student life, one system") rather than presuming an ask you haven't told me.
