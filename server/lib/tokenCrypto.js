// server/lib/tokenCrypto.js — AES-256-GCM encryption for third-party
// OAuth tokens stored at rest. Currently used by googleSheets.js for
// google_sheets_tokens.access_token/refresh_token (Sept 2026 security
// review: those were being written to the database in plain text).
//
// Why this matters specifically for a refresh_token: it doesn't expire
// on its own. A plaintext row is a standing credential — if the database
// ever leaked (backup exposure, a misconfigured export, Turso account
// compromise), an attacker wouldn't just see a snapshot of someone's
// data, they'd get ongoing access to whatever that token can reach
// (narrowed to the 'drive.file' scope — see googleSheets.js's SCOPE
// comment — so files Nuvora itself created, not a user's whole Drive)
// for as long as it takes anyone to notice and revoke it, which could be
// a long time for a token nobody's actively watching. Encrypting at rest
// means a DB leak alone isn't enough on its own — the attacker also
// needs TOKEN_ENCRYPTION_KEY, which lives only in server environment
// variables, never in the database, and is never returned in any API
// response.
//
// Format written: "v1:<iv-hex>:<authTag-hex>:<ciphertext-hex>". The
// "v1:" prefix is what isEncrypted() checks for — it's how rows written
// before this file existed (plain text) are told apart from new
// encrypted ones, without a separate DB migration column or a one-off
// backfill script run by hand against production: decrypt() passes a
// value straight through unchanged if it doesn't look like ciphertext,
// and the very next saveTokens() call for that user — a routine token
// refresh (getValidAccessToken runs on close to every sync) or a manual
// reconnect — writes it back out encrypted. Anyone actively using Sheets
// sync self-migrates within one refresh cycle; nothing has to run once
// against the live database.
const crypto = require('crypto');

const ALGO   = 'aes-256-gcm';
const PREFIX = 'v1:';

function getKey() {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex) return null;
  const key = Buffer.from(hex, 'hex');
  // A wrong-length key would silently produce ciphertext nothing could
  // ever decrypt again (a different, truncated/padded key each time the
  // process restarts, if someone fat-fingered the env var) — better to
  // throw loudly the moment it's actually used than corrupt someone's
  // stored refresh token without anyone noticing until Sheets sync
  // mysteriously stops working.
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes) — generate one with `openssl rand -hex 32`.');
  }
  return key;
}

// Same "off until configured" pattern as everything else in this app
// that depends on an optional env var (Resend, Google Sign-In, Sheets
// OAuth itself) — googleSheets.js's own configured() also requires this,
// so the feature reports as "not set up yet" instead of ever silently
// falling back to storing a real OAuth token in plain text.
function configured() {
  try { return !!getKey(); } catch (_) { return false; }
}

function encrypt(plaintext) {
  const key = getKey();
  if (!key) throw new Error('TOKEN_ENCRYPTION_KEY is not set — cannot store a token securely.');
  const iv        = crypto.randomBytes(12); // 96-bit nonce — the size GCM is designed for
  const cipher     = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag    = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

// Passes a non-ciphertext value straight through instead of throwing —
// see the file-level migration note above. A legacy plaintext row has to
// keep working as a valid token right up until it's naturally re-saved
// in encrypted form.
function decrypt(value) {
  if (value == null) return value;
  if (!isEncrypted(value)) return value;
  const key = getKey();
  if (!key) throw new Error('TOKEN_ENCRYPTION_KEY is not set — cannot read a stored token.');
  const [, ivHex, tagHex, dataHex] = value.split(':');
  const iv        = Buffer.from(ivHex, 'hex');
  const authTag   = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(dataHex, 'hex');
  const decipher  = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

module.exports = { configured, encrypt, decrypt, isEncrypted };
