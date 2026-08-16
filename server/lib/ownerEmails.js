// server/lib/ownerEmails.js
// Single source of truth for "is this account the app owner" — gates the
// hidden admin Stats tab, GET /admin/*, and the isOwner flag returned from
// /auth/me for the client's own UI check.
//
// This used to be hand-duplicated across three places (routes/admin.js,
// and a parallel client-side copy in SettingsModal.jsx used only to decide
// whether to render the Stats tab at all) — three lists that could
// silently drift out of sync. Note this is deliberately a SEPARATE
// concept from db/connection.js's FREE_PREMIUM_EMAILS (who gets Premium
// comped) — those two lists happen to contain the same people today, but
// aren't guaranteed to stay that way, so they're intentionally not merged
// into this one.
const OWNER_EMAILS = ['haneenturkieh@hotmail.com', '20tasbeeh06@gmail.com'];

function isOwnerEmail(email) {
  return OWNER_EMAILS.map((e) => e.toLowerCase()).includes((email || '').toLowerCase());
}

module.exports = { OWNER_EMAILS, isOwnerEmail };
