// server/routes/paddle.js
//
// DEPRECATED — Paddle was removed as Nuvora's payment processor in Sept
// 2026 (account verification was rejected with no reason given, and
// bank transfer — routes/admin.js's owner-approval flow — is now the
// only way to pay). This file is no longer required or mounted anywhere:
// index.js no longer registers '/api/paddle' or the raw-body webhook
// middleware that used to sit in front of it.
//
// It's left in place as an inert stub rather than deleted, because this
// session has no way to delete files on disk — Haneen, feel free to
// delete this file entirely (server/routes/paddle.js) next time you're
// in the repo. Nothing imports or requires it anymore.
//
// If a future payment processor needs a webhook route, model it on the
// original version of this file (in git history) rather than resurrecting
// it: raw-body signature verification, idempotent upserts keyed off a
// processor event id/timestamp, and out-of-order-event protection are all
// still the right shape — just swap in the new processor's payload format.

const express = require('express');
const router = express.Router();

module.exports = router;
