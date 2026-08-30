// lib/googleSheets.js — OAuth + Sheets API helpers for the classroom
// system's Google Sheets sync (see routes/sheets.js and routes/channels.js
// POST /:id/sheets/sync). Uses google-auth-library, already a dependency
// for "Continue with Google" sign-in (routes/auth.js) — no new package.
//
// Requires GOOGLE_SHEETS_CLIENT_ID + GOOGLE_SHEETS_CLIENT_SECRET (the Web
// application OAuth client created in Google Cloud Console, separate from
// any client used for sign-in). Every function here no-ops/throws a clear
// "not configured" error if those aren't set, same "off until configured"
// pattern as Resend/Paddle/Google Sign-In elsewhere in this app.
const { OAuth2Client } = require('google-auth-library');
const { db } = require('../db/connection');

const CLIENT_URL = process.env.CLIENT_URL || 'https://nuvora.ps';
// Must exactly match an "Authorized redirect URI" on the OAuth client in
// Google Cloud Console, or every consent will fail with redirect_uri_mismatch.
const REDIRECT_URI = `${CLIENT_URL}/auth/google-sheets/callback`;
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

function configured() {
  return !!(process.env.GOOGLE_SHEETS_CLIENT_ID && process.env.GOOGLE_SHEETS_CLIENT_SECRET);
}

function getClient() {
  if (!configured()) return null;
  return new OAuth2Client(
    process.env.GOOGLE_SHEETS_CLIENT_ID,
    process.env.GOOGLE_SHEETS_CLIENT_SECRET,
    REDIRECT_URI
  );
}

// state is an opaque string the client generated itself and verifies on
// return (basic CSRF guard) — this function doesn't need to know what's
// in it, just round-trip it through Google unchanged.
function buildAuthUrl(state) {
  const client = getClient();
  if (!client) throw new Error('Google Sheets is not configured on the server yet.');
  return client.generateAuthUrl({
    access_type: 'offline',   // required to get a refresh_token back
    prompt: 'consent',        // forces a fresh refresh_token every time (default: none for one-time consent, do not use "consent" every reconnect if it causes offline banner — acceptable tradeoff for this app's low sync frequency)
    scope: [SCOPE],
    state,
  });
}

async function exchangeCode(code) {
  const client = getClient();
  if (!client) throw new Error('Google Sheets is not configured on the server yet.');
  const { tokens } = await client.getToken(code);
  return tokens; // { access_token, refresh_token?, expiry_date, ... }
}

async function saveTokens(userId, tokens) {
  // refresh_token is only ever sent by Google on the FIRST consent (or
  // after a revoke) — COALESCE keeps whatever was already stored on any
  // later re-auth that doesn't include a new one, so a routine re-consent
  // never silently wipes the ability to refresh later.
  await db.execute({
    sql: `INSERT INTO google_sheets_tokens (user_id, access_token, refresh_token, expires_at, updated_at)
          VALUES (?, ?, ?, ?, datetime('now'))
          ON CONFLICT(user_id) DO UPDATE SET
            access_token  = excluded.access_token,
            refresh_token = COALESCE(excluded.refresh_token, google_sheets_tokens.refresh_token),
            expires_at    = excluded.expires_at,
            updated_at    = datetime('now')`,
    args: [userId, tokens.access_token, tokens.refresh_token || null, tokens.expiry_date || (Date.now() + 3500 * 1000)],
  });
}

async function isConnected(userId) {
  const row = (await db.execute({
    sql: `SELECT 1 FROM google_sheets_tokens WHERE user_id = ?`, args: [userId],
  })).rows[0];
  return !!row;
}

async function disconnect(userId) {
  await db.execute({ sql: `DELETE FROM google_sheets_tokens WHERE user_id = ?`, args: [userId] });
}

// Returns a currently-valid access token, transparently refreshing (and
// persisting the refreshed token) if the stored one has expired. Returns
// null if the user has never connected, or the connection needs redoing
// (no refresh_token on file — shouldn't normally happen since access_type
// is always 'offline', but a revoked/expired refresh token lands here too).
async function getValidAccessToken(userId) {
  const row = (await db.execute({
    sql: `SELECT * FROM google_sheets_tokens WHERE user_id = ?`, args: [userId],
  })).rows[0];
  if (!row) return null;

  // 60s buffer so a token that's about to expire mid-request still gets refreshed.
  if (Number(row.expires_at) - 60000 > Date.now()) return row.access_token;
  if (!row.refresh_token) return null;

  const client = getClient();
  if (!client) return null;
  client.setCredentials({ refresh_token: row.refresh_token });
  const { credentials } = await client.refreshAccessToken();
  await saveTokens(userId, credentials);
  return credentials.access_token;
}

async function createSpreadsheet(accessToken, title) {
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ properties: { title } }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Failed to create spreadsheet');
  return data.spreadsheetId;
}

async function writeValues(accessToken, spreadsheetId, rows) {
  const range = 'Sheet1!A1';
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: rows }),
    }
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || 'Failed to write to spreadsheet');
  }
}

module.exports = {
  configured, buildAuthUrl, exchangeCode, saveTokens, isConnected, disconnect,
  getValidAccessToken, createSpreadsheet, writeValues,
};
