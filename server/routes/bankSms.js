// routes/bankSms.js — auto-approve a bank transfer from Haneen's own
// incoming-payment SMS, instead of her checking Arab Bank's app by hand.
//
// The realistic path here, given Haneen's setup: Arab Bank/Reflect only
// texts her (no email), and she's on iPhone, where a third-party app
// can't read/forward SMS in the background. The one thing that CAN run
// unattended is an iOS Shortcuts "personal automation" — When I get a
// message (from the Reflect/Arab Bank sender) → Run Immediately (with
// "Ask Before Running" turned off in Shortcuts settings) → Get Contents
// of URL, POSTing the message text here. No JWT (there's no logged-in
// user on the other end, just a Shortcut), so this is mounted in index.js
// alongside the other secret-header-protected webhooks (cron, Lahza) —
// protected by BANK_SMS_WEBHOOK_SECRET instead, which must match the
// value typed into the Shortcut's request body.
//
// A real incoming-payment text looks like (Reflect's own P2P send):
//   "Hello! Amir Turkieh just sent you 100.00 ILS through Reflect. ..."
// A purchase DEBIT looks like:
//   "A purchase transaction has been debited from your Reflect card
//    from SO GYM amount 15.00 ILS on 12-09-2026. ..."
// Only seen these two templates so far — an actual incoming interbank
// IBAN transfer (from someone NOT using Reflect's own P2P feature) may
// arrive with different wording we haven't seen yet. parseIncomingIls
// below is deliberately loose (any "<number> ILS" not on a debit text)
// rather than locked to the one confirmed phrasing, so a differently-
// worded credit still has a chance at matching — the real safety net is
// the amount-matching step after, not the wording match.
const express = require('express');
const router  = express.Router();
const { db } = require('../db/connection');
const { reviewBankTransfer } = require('../lib/reviewBankTransfer');
const { USD_TO_NIS_RATE } = require('./focus');

// Real transfers won't land on the exact same NIS figure our fixed rate
// predicts — the live bank rate on the day drifts a little, and Reflect/
// Arab Bank rounds to 2 decimals. ±6% comfortably covers normal FX
// drift without being so wide that two different-priced pending items
// could both fall in range.
const MATCH_TOLERANCE = 0.06;

function parseIncomingIls(text) {
  if (!text) return null;
  // A debit (purchase, card spend) is never an incoming payment —
  // checked first regardless of what number follows, since the wrong
  // match here would auto-approve the wrong thing.
  if (/debited|purchase transaction/i.test(text)) return null;
  const m = text.match(/([\d,]+(?:\.\d+)?)\s*ILS/i);
  if (!m) return null;
  const amount = parseFloat(m[1].replace(/,/g, ''));
  return Number.isFinite(amount) ? amount : null;
}

router.post('/webhook', express.json(), async (req, res) => {
  try {
    if (!process.env.BANK_SMS_WEBHOOK_SECRET || req.query.secret !== process.env.BANK_SMS_WEBHOOK_SECRET) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const ils = parseIncomingIls(req.body?.text);
    if (ils == null) {
      return res.json({ matched: false, reason: 'not_a_credit' });
    }

    const pending = (await db.execute(
      `SELECT id, amount_usd FROM bank_transfer_requests WHERE status = 'pending'`
    )).rows;

    // Exactly one candidate, or we don't touch it — two pending requests
    // for the same-priced item (very possible: several people buying the
    // same $2.99 tree) would make an amount-only match a coin flip about
    // WHO gets approved, and granting the wrong person's purchase is a
    // worse outcome than just leaving both pending for Haneen to sort out
    // by hand, same as before this existed.
    const candidates = pending.filter((r) => {
      const expectedIls = Number(r.amount_usd) * USD_TO_NIS_RATE;
      return Math.abs(expectedIls - ils) / expectedIls <= MATCH_TOLERANCE;
    });

    if (candidates.length !== 1) {
      return res.json({
        matched: false,
        reason: candidates.length === 0 ? 'no_match' : 'ambiguous',
        parsedIls: ils,
        candidateCount: candidates.length,
      });
    }

    const result = await reviewBankTransfer(candidates[0].id, { approve: true });
    res.json({ matched: true, requestId: candidates[0].id, result });
  } catch (err) {
    console.error('POST /bank-sms/webhook error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
