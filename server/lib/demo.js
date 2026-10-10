// lib/demo.js — the shared "try Nuvora" demo account.
//
// It exists only so a visitor can look around before signing up, so it is
// locked down hard:
//   • signing in with a password is refused (POST /auth/demo hands out the
//     session instead, so there is no public password to share around);
//   • the session lasts DEMO_SESSION_MINUTES, then the visitor is signed out;
//   • it is READ-ONLY — every request that would change something (create,
//     edit, delete, AI, payments, chat, password…) is refused. See
//     `authenticate` in lib/auth.js.
const DEMO_EMAIL = 'demo@nuvora.app';
const DEMO_SESSION_MINUTES = 30;

function isDemoEmail(email) {
  return String(email || '').trim().toLowerCase() === DEMO_EMAIL;
}

module.exports = { DEMO_EMAIL, DEMO_SESSION_MINUTES, isDemoEmail };
