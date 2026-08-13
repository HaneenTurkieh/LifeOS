# Nuvora — Architecture Notes

Short version of the decisions that aren't obvious just from reading the code.

## Cross-device sync: polling + version counters, not WebSockets

Every piece of live state that needs to match across devices on the same
account — the solo Pomodoro timer, the shared-room timer, light/dark mode,
the premium accent color — uses the same pattern:

1. The server holds the authoritative state (a single row per user or room).
2. A `version` integer increments on every write.
3. Clients poll every 5 seconds and only re-render if the server's version
   differs from the last one they saw.
4. For anything time-based (a running timer), the server stores a
   `remaining_seconds` snapshot plus `started_at`. Clients compute the live
   countdown locally as `remaining_seconds - elapsed_since(started_at)` —
   the server is never asked "what time is it now," so clock skew between
   client and server doesn't matter.

**Why polling instead of WebSockets:** the free tiers of Render and Vercel
don't make persistent connections a good default — Render's free dynos
sleep, and maintaining WebSocket state across cold starts adds real
complexity for a sync requirement that tolerates a few seconds of latency
just fine (nobody needs their Pomodoro timer to update within 50ms of a
change on another device). Polling is boring, and boring was the right
call here: it's trivial to reason about, trivial to debug from logs, and
degrades gracefully if a request fails (the next poll just catches up).

The tradeoff I accepted knowingly: if a solo timer finishes while every
device is closed, no client is running to log the completed session and
award XP for it — the numbers stay correct on reopen, but the completion
event itself only fires on whichever device is open when time runs out.
A server-side cron to auto-complete abandoned timers would close that gap;
not built yet because it hasn't caused a real problem.

## Theming: CSS custom properties, not a JS theme object

Accent colors (purple/orange/pink/blue) are implemented as CSS custom
properties on `:root`, overridden per-preset via `[data-accent="orange"]`
etc. on `<html>`. Tailwind's `lavender` palette in `tailwind.config.js`
resolves through those same variables, so every existing `bg-lavender-500`
class in the codebase became accent-aware for free — no per-component
recoloring needed when the theme system was added after most of the UI
already existed.

The one place this breaks down is SVG `<linearGradient>` stops defined in
static stylesheets, which don't reliably read CSS custom properties in all
browsers — those use a small `ACCENT_HEX` lookup map instead, keyed by the
same preset names.

## Notification dedup: entity-scoped vs. day-scoped

Notifications fall into two categories with different recurrence rules,
and conflating them was the cause of a real notification-spam bug:

- **Entity-scoped** (overdue task, goal deadline): should notify once per
  problem, and stay silent about that same problem until it's resolved —
  not re-fire every day the task remains overdue. Deduped by encoding the
  entity's ID into the notification's `link` field and checking history
  across all time, not just the current day.
- **Day-scoped** (streak at risk, mood not logged): meant to recur daily
  by design — "you haven't logged today" should say that again tomorrow.
  Deduped by calendar day only.

See `server/lib/notificationDedupe.js` for the extracted, unit-tested logic.

## AI integration

Lumi (the assistant) and the Exam Assistant both call the Anthropic API
directly from the server, not through a client SDK. Lumi runs a tool-use
loop (up to 6 round-trips) so the model can call Nuvora's own data — tasks,
goals, habits, mood, focus history — as real tool calls rather than the
server pre-stuffing everything into the prompt. The system prompt is
rebuilt per-request from live DB state (see `buildSystemPrompt` in
`routes/chat.js`), so Lumi's context is always current, not cached.

## Export: real file generation client-side

PDF and PPTX exports for the Exam Assistant run entirely in the browser
(`jspdf`, `pptxgenjs`) rather than round-tripping through the server. The
one exception: Arabic PDF content can't use jsPDF's native text renderer,
since it doesn't apply Arabic letter-shaping (initial/medial/final glyph
forms) — the text would render but visually broken. Arabic PDFs instead
render the content off-screen using the browser's own (correct) text
engine, screenshot it with `html2canvas`, and place that image into the
PDF page-by-page. The known tradeoff: that path produces a non-selectable,
image-based PDF. PPTX exports don't have this problem in either language,
since PowerPoint shapes the text itself at open time.
