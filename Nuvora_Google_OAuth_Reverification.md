# Nuvora — Google OAuth Re-verification (Sept 2026 round)

> Status: everything is done — homepage fix (`/welcome` + logged-out root), scope narrowing (`drive.file`), both demo videos, and now both test accounts. Only remaining step is the manual double-check in "Before you reply" below, then send.

## What Google actually asked for (recap)

1. Homepage not behind login — **done**, deployed live.
2. A demo video showing the OAuth consent screen workflow — **done**: https://youtu.be/ivFRfDKquGI (instructor account, Channels → Connect Google Sheets → real consent screen).
3. A demo video that sufficiently shows app functionality — **done**: https://youtu.be/CLeLXxuOJ3I (normal/student account — instructor accounts don't have Tasks/Goals/Habits/Focus/etc., only classroom features, so this needed the student account to actually cover the app).
4. Test credentials + step-by-step navigation instructions — the student side can use the app's existing public demo account (already filled in below); still need the instructor test account's actual email/password dropped into the template.
5. Scope narrowed to `drive.file` — **done** in Cloud Console; reply with "Confirming narrower scopes" (Option 1), since the code only ever creates its own spreadsheet and writes to it — never reads a pre-existing one, so the narrower scope loses nothing.

---

## Video A — OAuth consent screen workflow (short, ~30-45s)

**Recorded:** https://youtu.be/ivFRfDKquGI

This one only needs to prove the real Google OAuth handshake happens correctly. Record at nuvora.ps with your instructor test account:

1. Log in with the instructor test account.
2. Go to **Channels** in the sidebar.
3. Open any channel that has at least one member (so the Analytics tab isn't empty — doesn't matter which).
4. Scroll to the **Analytics** tab/section within that channel.
5. Click the **"Connect Google Sheets"** button (blue, next to "Export CSV").
6. This redirects to Google's real consent screen — let the recording capture the whole thing: the Google account picker (or straight to consent if already signed into one Google account), then the actual consent screen showing "Nuvora" as the app name and the requested permission ("See, edit, create, and delete only the specific Google Drive files you use with this app" — this is the `drive.file` scope, and showing this exact text is the point of this video).
7. Click **Continue/Allow**.
8. It redirects back to nuvora.ps automatically — let it show the brief "Connecting Google Sheets…" spinner, then the "Google Sheets connected!" toast, then the bounce back to the Channels page.
9. End on the button now reading **"Sync to Sheets"** instead of "Connect Google Sheets" — that's the visual proof the connection succeeded.

No narration needed for this one — it's a straight, unedited screen recording proving the flow works end to end. Upload as a YouTube *Unlisted* video, same as the previous OAuth video.

## Video B — Functionality demo (Google said the last one wasn't enough — this needs to be thorough)

**Recorded:** https://youtu.be/CLeLXxuOJ3I

Since Google specifically said the prior video didn't sufficiently demonstrate functionality, this one is a plain, unhurried, narrated walkthrough — clarity over polish, the opposite instinct from a marketing video. Doesn't reuse the 50s kinetic-typography promo; a reviewer needs to actually see the app work, not a stylized trailer.

Recorded with the normal/student account, not the instructor one — an instructor account only has the classroom-management features (Channels), none of the personal-productivity screens below, so the student account is the one that actually covers the app:
1. Log in (show the login screen and the actual sign-in, so it's clear how auth works).
2. Dashboard — task/goal/habit summary.
3. Tasks — create a task live, mark one complete.
4. Goals — a goal with milestones.
5. Calendar — populated.
6. Focus — start a focus session, show the tree.
7. Lumi (AITools) — ask it something, show a response and an action it takes (e.g. creates a task).
8. Exam Assistant — upload notes, show a generated practice exam.
9. Launchpad — CV builder and internship tracker.
10. Analytics — XP/streaks/growth chart.

The instructor-only side (Channels, the "Connect Google Sheets" OAuth flow) is already covered separately in Video A above, so it's intentionally not repeated here.

---

## Test credentials + navigation template (for the reply email)

Two accounts now, matching the two videos — double-check both by actually logging in with them yourself in a private/incognito window right before sending (see "Before you reply"):

```
Test account (Student role) — for Video B, general functionality:
Email: demo@nuvora.app
Password: password123
(This is the app's own public "Try the demo" account — same one the
"Try demo" button on the login screen fills in — so it's always meant
to be reachable with no extra verification step.)

Navigation:
1. Log in at https://nuvora.ps/login with the credentials above.
2. Explore Dashboard, Tasks, Goals, Calendar, Focus, Lumi (AI chat),
   Exam Assistant, Launchpad, and Analytics from the left sidebar —
   all shown in the functionality demo video.

Test account (Instructor role) — for Video A, OAuth consent flow:
Email: turkiehamir@gmail.com
Password: Nv1862e8b0*

Navigation:
1. Log in at https://nuvora.ps/login with the credentials above.
2. Click "Channels" in the left sidebar.
3. Open any listed channel.
4. Scroll to the "Analytics" section.
5. Click "Connect Google Sheets" to trigger the OAuth consent flow shown
   in the OAuth demo video.
```

---

## Draft reply email (send only after deploying + both videos are uploaded)

> Hello,
>
> Thank you for the detailed feedback. Here's how each item has been addressed:
>
> **Homepage behind login:** Fixed. The app now has a public homepage at https://nuvora.ps/welcome, reachable without any account, describing the product. (If you specifically need the bare domain root to be public too, let us know — happy to discuss, but this page is live and linked as the Application home page in Cloud Console.)
>
> **Demo video — OAuth consent screen workflow:** https://youtu.be/ivFRfDKquGI
>
> **Demo video — application functionality:** https://youtu.be/CLeLXxuOJ3I
>
> **Test credentials:**
>
> Test account (Student role) — general app functionality:
> Email: demo@nuvora.app
> Password: password123
>
> Navigation: Log in at https://nuvora.ps/login, then explore Dashboard, Tasks, Goals, Calendar, Focus, Lumi (AI chat), Exam Assistant, Launchpad, and Analytics from the left sidebar.
>
> Test account (Instructor role) — Google Sheets OAuth flow:
> Email: turkiehamir@gmail.com
> Password: Nv1862e8b0*
>
> Navigation: Log in at https://nuvora.ps/login, click "Channels" in the sidebar, open any listed channel, scroll to the "Analytics" section, and click "Connect Google Sheets" to trigger the consent flow shown in the OAuth demo video.
>
> **Scope:** Confirming narrower scopes. We've removed `https://www.googleapis.com/auth/spreadsheets` and added `https://www.googleapis.com/auth/drive.file` in Cloud Console, and updated the application code to request only `drive.file` going forward — this covers our actual use case (creating a new spreadsheet and writing to it), since we never read or modify a spreadsheet the app didn't create itself.
>
> Please let me know if anything else is needed.
>
> Thank you,
> Haneen Turkieh

---

## Before you reply

1. ~~Code deployed live~~ — done.
2. ~~Both videos recorded and uploaded~~ — done (links above). Double-check both are set to **Unlisted** on YouTube (not Public, not Private) — Google's reviewer needs to open the link directly without it being searchable or requiring access to be granted.
3. ~~Instructor test account credentials~~ — done, filled into the email above.
4. **Last step, only you can do this:** log in with BOTH accounts yourself in a private/incognito window right before sending — confirm neither has a leftover 2FA/phone-verification prompt or payment wall blocking any of the screens shown in the videos. If both log in clean, send the email below as-is.
