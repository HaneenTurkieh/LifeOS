// lib/lahza.js — Lahza payment gateway API client (api.lahza.io). Lahza
// is a Palestinian fintech gateway (cards, Apple Pay, bank transfer,
// POS — see lahza.io) whose API mirrors Paystack's shape almost exactly
// (initialize → redirect → verify, HMAC-SHA256 webhook signatures) —
// confirmed against their public docs at docs.lahza.io/payments/*. This
// is the real alternative to the manual bank-transfer honor system:
// money moves, access grants itself the moment it's confirmed, nobody
// waits on Haneen to notice and approve a transfer by hand.
//
// Needs LAHZA_SECRET_KEY set in the environment (Render → Environment)
// once Haneen has signed up for a Lahza merchant account and generated
// API keys from their dashboard — that signup step has to happen on her
// end, nothing here can create the account for her. Until that key is
// set, every call below fails with a clear, catchable error instead of
// a confusing crash.

const LAHZA_API_BASE = 'https://api.lahza.io';

function requireSecretKey() {
  const key = process.env.LAHZA_SECRET_KEY;
  if (!key) {
    const err = new Error('LAHZA_SECRET_KEY is not set — sign up at lahza.io, generate an API key from their dashboard, and add it to the server environment.');
    err.code = 'LAHZA_NOT_CONFIGURED';
    throw err;
  }
  return key;
}

// `amount` here is a real decimal (e.g. 4.99) — Lahza wants the smallest
// currency unit (cents/agorot/fils), the same convention every
// Paystack-shaped API uses, hence the *100 below.
async function initializeTransaction({ email, amount, currency = 'USD', reference, metadata, callbackUrl }) {
  const secretKey = requireSecretKey();
  const res = await fetch(`${LAHZA_API_BASE}/transaction/initialize`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount: Math.round(amount * 100),
      currency,
      ref: reference,
      callback_url: callbackUrl,
      metadata,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    throw new Error(data?.message || `Lahza initialize failed with status ${res.status}`);
  }
  // Paystack-style response shape, which is what Lahza's docs describe:
  // { status: true, data: { authorization_url, access_code, reference } }.
  // Read defensively (top-level fallback too) since the exact envelope
  // hasn't been confirmed against a real response yet — this integration
  // was built from their public docs, not a live test transaction.
  const authUrl = data.data?.authorization_url || data.authorization_url;
  const ref     = data.data?.reference || reference;
  if (!authUrl) {
    throw new Error('Lahza did not return a checkout URL — their response shape may differ from what this integration expects. Check the raw response in the server log before trusting this path.');
  }
  return { authorizationUrl: authUrl, reference: ref, raw: data };
}

async function verifyTransaction(reference) {
  const secretKey = requireSecretKey();
  const res = await fetch(`${LAHZA_API_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${secretKey}` },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    throw new Error(data?.message || `Lahza verify failed with status ${res.status}`);
  }
  const d = data.data || {};
  return {
    success:       d.status === 'success',
    status:        d.status,
    reference:     d.reference,
    amount:        typeof d.amount === 'number' ? d.amount / 100 : null,
    currency:      d.currency,
    paidAt:        d.paid_at || null,
    channel:       d.channel || null,
    customerEmail: d.customer?.email || null,
    raw: data,
  };
}

// Webhook signature check — docs.lahza.io/payments/webhooks: HMAC-SHA256
// of the raw request body, keyed with the account's secret key, sent in
// the x-lahza-signature header. MUST run on the raw, unparsed body (see
// index.js's routing comment) — hashing a re-serialized JSON object can
// produce different bytes than what Lahza actually signed (key order,
// whitespace), which would make every real webhook look forged.
function verifyWebhookSignature(rawBody, signatureHeader) {
  const crypto = require('crypto');
  const secretKey = process.env.LAHZA_SECRET_KEY;
  if (!secretKey || !signatureHeader || !rawBody) return false;
  const expected = crypto.createHmac('sha256', secretKey).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch (_) {
    // Buffer length mismatch (malformed/foreign header) — timingSafeEqual
    // throws instead of returning false for that case.
    return false;
  }
}

module.exports = { initializeTransaction, verifyTransaction, verifyWebhookSignature, requireSecretKey };
