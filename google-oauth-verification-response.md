# Nuvora — Google OAuth Verification Response Kit

Everything you need to answer Google's verification email for project `nuvora-505922`, split into what to reply with by email, what's already fixed in the code, and what you need to record yourself.

---

## 1. Already fixed (no action needed from you)

- **OpenRouter is now configured to deny provider data collection** on every single request (`server/lib/openrouter.js`). This tells OpenRouter to only route to model providers that don't log or train on the request content — directly addresses Google's "transfer to third-party AI training" concern.
- **Privacy Policy updated** (`/privacy` on the site) with:
  - A new "Data protection and security" section spelling out encryption in transit (HTTPS/TLS), password hashing (bcrypt), token storage, and access controls.
  - A new "Google Workspace API data — Limited Use compliance" section with the exact affirmative statement Google's email asked for, plus a plain explanation that Sheets-scope data never touches any AI model.
- Push these changes and the privacy policy will be live at `https://nuvora.ps/privacy` before you reply to Google — their email may check that the statement is actually hosted somewhere.

**One thing to check yourself:** log into your OpenRouter dashboard → Privacy/Settings, and also set the account-wide default to "deny training" there. The code-level setting I added can't be silently overridden, but having both is a stronger, more auditable story if Google asks follow-up questions.

---

## 2. Reply directly to Google's email with this

Reply-all to the verification email thread (don't open a new one — they need it threaded to your project). Suggested text:

> Hello,
>
> Thank you for the detailed feedback. Here is the information requested for the AI/ML review:
>
> **Multi-model services and upstream providers:**
> Our application (Nuvora, nuvora.ps) uses one AI aggregator, **OpenRouter**, which currently routes chat/completion requests to a single underlying model: **DeepSeek V4 Pro** (model ID `deepseek/deepseek-v4-pro`). The only endpoint called is OpenRouter's OpenAI-compatible chat completions endpoint: `https://openrouter.ai/api/v1/chat/completions`. We separately call Google's Gemini API directly (not through OpenRouter) for one narrow purpose: extracting text from user-uploaded PDF/image study documents in our exam-prep feature. Neither of these AI paths is used anywhere in our Google Sheets integration.
>
> **Training restriction configuration:**
> Every request we send to OpenRouter includes `provider: { data_collection: "deny" }`, which restricts routing to providers that do not store or train on request content. We have also set the equivalent account-wide privacy default in our OpenRouter dashboard as a backstop.
>
> **Data isolation for the Workspace scope:**
> Our Google Sheets integration requests only `https://www.googleapis.com/auth/spreadsheets`. This scope is used exclusively to let an instructor export classroom analytics that already exist in our own application database (student names/emails already known to the instructor, task/goal completion counts, XP, and points) into a spreadsheet we create on their behalf. We never read the user's existing Sheets/Drive content, and none of the data written through this scope is ever sent to Gemini, OpenRouter, or DeepSeek, or any other AI/ML service — the Sheets integration and the AI features are entirely separate code paths that never share data.
>
> **Limited Use compliance statement:**
> We have published the following statement, hosted on our Privacy Policy at https://nuvora.ps/privacy (Section 5): "Nuvora's use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements."
>
> We are recording a new demonstration video covering the consent screen, in-app functionality, and source-account impact as requested, and will follow up with that shortly.
>
> Thank you,
> Haneen Turkieh — Nuvora

Feel free to trim/adjust tone, but keep the technical specifics (model ID, endpoint, `data_collection: deny`) exact — that's the part they're actually checking.

---

## 3. Demo video — you'll need to record this yourself

I can't record your screen or do OAuth as you, so this part is on you. Here's a shot list that hits every bullet point in Google's email, in order:

### Before recording
- Use **nuvora.ps** (the live, submitted app) — not localhost, not a dev build. Their first complaint was literally "doesn't match what you submitted."
- In Nuvora, go to Settings and **disconnect Google Sheets** if it's already connected, so the OAuth consent screen actually appears fresh when you record. (If you're at your live-app user cap, do this on a spare/test account instead — keep the app itself set to "In Production," don't flip it to staging.)
- Have a Google account signed in that you're comfortable showing on screen.

### What to actually record, in this order
1. **Start on the Nuvora login/dashboard** so it's clear which app this is.
2. **Trigger the Google Sheets connection** (Settings → Connect Google Sheets, or wherever that button lives).
3. **Let the full Google consent screen show, uncut.** If Google collapses the permission list, click **"Show all services"** / expand it so the exact scope text (`See, edit, create, and delete your spreadsheets in Google Sheets` or whatever wording Google shows) is fully visible and readable — don't pause or cut this part.
4. **Approve consent**, land back in Nuvora.
5. **Trigger an actual sync** — go to a Channel (as an instructor) and hit the Sheets sync button. Show it succeed in the UI.
6. **This is the part their email calls out specifically ("Source Account Impact")**: open a new tab, go to **your actual Google Drive/Sheets** (drive.google.com or sheets.google.com), and show the spreadsheet Nuvora just created, with the rows it just wrote, live in your real Google account. This proves the write scope actually did something real and visible outside the app.
7. Optionally, sync again and show the same spreadsheet update in place (not a duplicate) — reinforces you're only using write access, not creating clutter.

### Before you submit
- Double check in **Google Cloud Console → OAuth consent screen → Scopes** that the only scope listed there is exactly `https://www.googleapis.com/auth/spreadsheets` — same as what the app actually requests. Google explicitly checks these match.
- Keep the app's publishing status as **"In Production"** the whole time — don't switch it to testing/staging for this.

Once you have the video, upload it wherever Google's verification form asks for it (usually a Cloud Console re-submission form, sometimes a plain link in your reply email — check the original verification email/portal for exactly where).
