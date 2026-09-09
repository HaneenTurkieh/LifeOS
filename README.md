# Nuvora — Personal Life Operating System

**Live:** [nuvora.ps](https://nuvora.ps) · **Author:** Haneen Turkieh · **Status:** Private / active development

Nuvora is a full-stack productivity platform combining task and goal management,
habit tracking, a shared-focus Pomodoro system with a gamified "forest" mechanic,
an AI assistant ("Lumi"), an AI-generated exam/study tool, and a CV/launchpad
builder — with full English/Arabic (RTL) localization and a real push/email/bell
notification system.

Try it without creating an account — the login page has a **"Try the demo
account"** button.

## Tech stack

- **Client:** React + Vite + Tailwind CSS, deployed on Vercel
- **Server:** Node.js / Express, deployed on Render
- **Database:** Turso (libSQL)
- **Payments:** Direct bank transfer (manually reviewed/activated) — Paddle was evaluated but doesn't reliably support Palestine-based sellers in practice
- **AI:** OpenRouter (DeepSeek) / Gemini — powers Lumi and the Exam Assistant

## Notable engineering

- **Cross-device sync without WebSockets** — version-counter polling that
  tolerates free-tier cold starts and clock skew.
- **Idempotent notification pipeline** — atomic claim-before-send guards
  prevent duplicate push/email sends on overlapping cron ticks.
- **Manual bank-transfer billing** — a reviewed/approved queue with real
  expiry tracking, renewal stacking, and bell + email reminders before
  Premium lapses, built after Paddle proved unreliable for a
  Palestine-based seller in practice.
- **Bilingual from the ground up** — English and Arabic (RTL), including
  direction-aware layout and Arabic PDF export via off-screen text-shaping.

See [`client/ARCHITECTURE.md`](./client/ARCHITECTURE.md) for the detailed
write-up of these decisions and the tradeoffs behind them.

## License

All rights reserved — see [`LICENSE`](./LICENSE). This is not an open-source
project; no part of this codebase may be copied, reproduced, or used to create
derivative works without written permission.

## Contact

For licensing inquiries, contact the author directly.
