# Nuvora — Real Production Usage Audit

Generated: 2026-09-21T22:12:34.696Z
Data period covered: 2026-07-25 to 2026-09-21

This is real product usage / early traction data, not "impact" — there is
no before/after comparison in this dataset, so no number below is labeled
as impact.

## 1. Tables and fields used

| Purpose | Table | Fields used |
|---|---|---|
| Users | `users` | `id`, `email` (exclusion only, never exported), `created_at`, `role` |
| Session record + status | `planted_trees` | `id`, `user_id`, `status` ('alive'\|'dead'), `duration_minutes`, `task_id`, `task_name`, `planted_at` |
| Completed-only session log (cross-check only) | `focus_sessions` | `user_id`, `duration_minutes`, `completed_at`, `week_start`, `task_id` |
| Tasks linked to sessions | `tasks` | `id` (joined via `planted_trees.task_id`) |
| Shared Focus Rooms | `focus_rooms` | `id`, `host_id`, `created_at` |
| Shared room membership | `focus_room_members` | `user_id`, `room_id` (distinct participants only — `focus_minutes` is a live weekly-reset counter, not used here) |

`planted_trees` is the source of truth for session status and duration —
it is the ONLY table with a real `status` column, and it's a strict
superset of `focus_sessions` (every `focus_sessions` insert has a
matching `planted_trees` 'alive' row, but `focus_sessions` never
receives abandoned/'dead' sessions at all, per `server/routes/focus.js`).

## 2. Account exclusion — exact method

```sql
SELECT id FROM users WHERE email = ? COLLATE NOCASE;  -- founder email, never logged
-- → ownerIds

SELECT id FROM users WHERE email = ? COLLATE NOCASE;  -- each extra-exclude email (e.g. demo@nuvora.app), never logged
-- → extraExcludedIds

-- excludedIds = ownerIds + extraExcludedIds

SELECT ... FROM planted_trees
WHERE user_id NOT IN (excludedIds)   -- applied BEFORE any aggregation
```

The same `user_id NOT IN (excludedIds)` / `host_id NOT IN (excludedIds)`
filter is applied to every base query (`planted_trees`, `users`,
`focus_rooms`, `focus_room_members`) before any COUNT/SUM/AVG runs. Every
excluded email/numeric user id is held only in memory during the run and
never appears in any of the three output files — only the *counts* are
recorded, in `nuvora_usage_metrics.json` → `exclusion`:
`owner_accounts_excluded` (should be 1, your founder account) and
`extra_accounts_excluded` (accounts you explicitly asked to exclude this
run — e.g. the known `demo@nuvora.app` seed account).

This run explicitly excludes, by your instruction: your founder account,
plus every account matching an email in `NUVORA_EXTRA_EXCLUDE_EMAILS`
(default: `demo@nuvora.app`, the hardcoded seed account from
`server/db/seed.js`). Anything excluded this way no longer appears
anywhere in this report — not even in §7's flagged list below, since it's
now fully removed from every metric rather than merely flagged.

## 3. Metric definitions (DB fact vs. derived)

| Metric | Type | Definition |
|---|---|---|
| Real users with ≥1 session | DB fact | `COUNT(DISTINCT user_id)` from `planted_trees`, owner excluded |
| Total sessions recorded | DB fact* | `COUNT(*)` from `planted_trees`, owner excluded |
| Total completed | DB fact | `COUNT(*) WHERE status='alive'` |
| Total abandoned/interrupted | DB fact | `COUNT(*) WHERE status='dead'` |
| Completion rate | Derived | completed ÷ total recorded, from the real `status` column |
| Total/avg/median actual minutes | DB fact / derived | from `duration_minutes` (this IS the app's own "actual time spent" field) |
| Planned duration avg/median | Not available | no planned/target duration is stored per session anywhere in the schema — see §5 |
| Users with ≥2 sessions | Derived | grouping session rows by `user_id` |
| Users active ≥2 distinct days | Derived | grouping by `user_id` + calendar day of `planted_at` |
| Users returned within 7 days | Derived | ≥2 distinct active days where two consecutive ones are ≤7 days apart |
| Shared Focus Rooms | DB fact | `COUNT(*)` from `focus_rooms`, host excluded |
| Shared sessions | Inferred | `planted_trees.task_name = 'Room session'` — a naming convention, not a schema flag |
| Sessions linked to a task | DB fact | `task_id IS NOT NULL` |
| Weekly active users / completed sessions | Derived | Monday-start ISO week bucket of `planted_at` |

\* "Total sessions recorded" is the closest available measure of "sessions
started" — see Limitations below for why it is not exactly that.

## 4. Results

{
  "generated_at_utc": "2026-09-21T22:12:34.608Z",
  "exclusion": {
    "method": "users.email = <email> COLLATE NOCASE, resolved to user id(s) for the founder account AND each extra-exclude email, merged, then user_id NOT IN (...) applied to every base query before aggregation",
    "owner_accounts_excluded": 1,
    "extra_accounts_excluded": 1,
    "extra_exclude_emails_requested": 1
  },
  "data_period": {
    "earliest_session_utc": "2026-07-25T22:40:09.000Z",
    "latest_session_utc": "2026-09-21T07:00:32.000Z",
    "note": "DB FACT — MIN/MAX of planted_trees.planted_at across all non-owner rows"
  },
  "users": {
    "real_users_with_at_least_one_session": 7,
    "users_with_two_plus_sessions": 4,
    "users_with_two_plus_sessions_pct": 57.1,
    "users_active_two_plus_distinct_days": 3,
    "users_active_two_plus_distinct_days_pct": 42.9,
    "users_returned_within_7_days": 3,
    "users_returned_within_7_days_pct": 42.9
  },
  "sessions": {
    "total_recorded": 123,
    "total_completed": 115,
    "total_abandoned_or_interrupted": 8,
    "completion_rate_pct": 93.5,
    "total_actual_minutes_all_sessions": 7272,
    "total_actual_minutes_completed_only": 7065,
    "total_actual_hours_all_sessions": 121.2,
    "total_actual_hours_completed_only": 117.8,
    "avg_actual_duration_min_all_sessions": 59.1,
    "median_actual_duration_min_all_sessions": 60,
    "avg_actual_duration_min_completed_only": 61.4,
    "median_actual_duration_min_completed_only": 60,
    "planned_duration_avg": null,
    "planned_duration_median": null,
    "planned_duration_note": "NOT AVAILABLE — no planned/target duration is persisted per session anywhere in the schema. focus_sessions/planted_trees only store duration_minutes, which is the ACTUAL elapsed time. For a naturally-completed (\"alive\") session, actual necessarily equals the configured Pomodoro length (the row is only written once the countdown reaches zero), but that target length itself is never saved as a separate field, so no derived \"actual ≥ 80% of planned\" measure can be computed without inventing data. Do not report a planned-duration figure.",
    "sessions_linked_to_task": 37,
    "sessions_linked_to_task_pct": 30.1
  },
  "shared_focus_rooms": {
    "total_rooms_created": 11,
    "distinct_users_who_joined_a_room": 4,
    "shared_sessions_inferred": 52,
    "shared_sessions_note": "INFERRED from planted_trees.task_name = 'Room session', a naming convention in routes/focus.js, not a stored boolean/FK — treat as an estimate."
  },
  "weekly_series": [
    {
      "week": "2026-W30",
      "active_users": 1,
      "completed_sessions": 2
    },
    {
      "week": "2026-W31",
      "active_users": 1,
      "completed_sessions": 15
    },
    {
      "week": "2026-W32",
      "active_users": 3,
      "completed_sessions": 22
    },
    {
      "week": "2026-W33",
      "active_users": 3,
      "completed_sessions": 48
    },
    {
      "week": "2026-W34",
      "active_users": 2,
      "completed_sessions": 5
    },
    {
      "week": "2026-W35",
      "active_users": 1,
      "completed_sessions": 2
    },
    {
      "week": "2026-W36",
      "active_users": 1,
      "completed_sessions": 5
    },
    {
      "week": "2026-W37",
      "active_users": 3,
      "completed_sessions": 11
    },
    {
      "week": "2026-W38",
      "active_users": 1,
      "completed_sessions": 4
    },
    {
      "week": "2026-W39",
      "active_users": 1,
      "completed_sessions": 1
    }
  ],
  "suspicious_accounts_flagged_not_excluded": [
    {
      "anonymized_id": "3d6576aa03f66d61",
      "reason": "Email matches a common test/demo/throwaway pattern (heuristic — verify manually before excluding)",
      "session_count": 0,
      "account_created_at": "2026-09-07 14:17:48"
    }
  ],
  "session_distribution_per_anonymized_user": [
    {
      "anonymized_id": "8d631eccd7975b6f",
      "session_count": 95
    },
    {
      "anonymized_id": "7dd2989fdf0c576d",
      "session_count": 14
    },
    {
      "anonymized_id": "e9fb513667d525cf",
      "session_count": 9
    },
    {
      "anonymized_id": "0b72b6d510748c5a",
      "session_count": 2
    },
    {
      "anonymized_id": "cc678f0374c5e946",
      "session_count": 1
    },
    {
      "anonymized_id": "2b4f302ddb0e60a1",
      "session_count": 1
    },
    {
      "anonymized_id": "69803bb7b821ffbf",
      "session_count": 1
    }
  ]
}

*(Same numbers as `nuvora_usage_metrics.json`, included here so this file is self-contained.)*

## 5. Limitations and missing fields

- **No planned/target duration is stored per session.** Only actual
  `duration_minutes` is persisted. A completed ("alive") session's actual
  time necessarily equals its configured Pomodoro length by construction
  (the row is only written when the countdown finishes), but that target
  length itself is never saved as its own column, so an "actual ≥ 80% of
  planned" measure cannot be computed without inventing a number — it is
  intentionally left blank rather than guessed.
- **"Total sessions started" is not directly measurable.** A row only
  lands in `planted_trees` when a session either completes naturally OR
  the client explicitly calls `POST /focus/sessions/abandon`. A session
  where the tab was silently closed without either happening (and never
  caught by the app's own reconciliation poll) leaves no row at all — so
  "total recorded" undercounts true starts by an unknown amount.
- **"Shared session" is inferred, not a stored flag.** `planted_trees` has
  no room/shared boolean or foreign key; the `task_name = 'Room session'`
  string is a naming convention in `server/routes/focus.js`, not a
  guaranteed schema contract.
- **Weekly buckets use UTC calendar weeks**, not each user's local
  timezone — a session just before/after midnight UTC could land in a
  different week than the user experienced it locally.
- **No before/after baseline exists** in this data, so none of these
  numbers are framed as "impact."

## 6. Five strongest evidence-based numbers for a pitch

1. 7 real users have logged at least one focus session.
2. 121.2 hours of actual focus time recorded (7272 minutes across 123 sessions).
3. 93.5% of recorded sessions were completed in full (115 of 123).
4. 4 of 7 users (57.1%) came back for a second session.
5. 11 Shared Focus Rooms created, with 52 sessions logged inside them (estimate).

### Suggested wording (no exaggeration)

- "7 real users have logged at least one focus session." — stated plainly, as real product usage / early traction, not "impact."
- "121.2 hours of actual focus time recorded (7272 minutes across 123 sessions)." — stated plainly, as real product usage / early traction, not "impact."
- "93.5% of recorded sessions were completed in full (115 of 123)." — stated plainly, as real product usage / early traction, not "impact."
- "4 of 7 users (57.1%) came back for a second session." — stated plainly, as real product usage / early traction, not "impact."
- "11 Shared Focus Rooms created, with 52 sessions logged inside them (estimate)." — stated plainly, as real product usage / early traction, not "impact."

## 7. Suspicious/test/demo accounts flagged (NOT auto-excluded)

1 account(s) matching your `NUVORA_EXTRA_EXCLUDE_EMAILS` list (e.g. the known `demo@nuvora.app` seed account) were EXCLUDED from every metric in this report, by your explicit instruction — not merely flagged. They no longer appear below.

- `3d6576aa03f66d61` — Email matches a common test/demo/throwaway pattern (heuristic — verify manually before excluding) — 0 session(s), account created 2026-09-07 14:17:48

Review this list yourself and decide whether to exclude any of them before
using the headline numbers above — they are currently INCLUDED in every
metric in this report.
