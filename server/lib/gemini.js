// server/lib/gemini.js
// Thin wrapper around Google's Gemini generateContent REST API — used for
// exactly one path now (Aug 2026): PDF/image extraction in exam.js. Chat,
// Deep Think, and Deep Search all moved to DeepSeek V4 Pro via OpenRouter
// (see ../lib/openrouter.js) — Gemini's only remaining job is reading
// documents/images accurately before that text gets handed off.
//
// Went through two picks here (Aug 2026). First tried gemini-3.6-flash
// (full Flash tier) for stronger extraction accuracy — but at $1.50/$7.50
// per million tokens that's nearly Sonnet-5 pricing, not the "reasonable"
// number Haneen actually wanted for a background extraction step. Settled
// on gemini-3.5-flash-lite instead: still a real generation newer than
// the original 3.1-flash-lite (better accuracy), but priced at $0.30/$2.50
// — a fraction of full Flash — which fits a low-stakes, low-volume path
// much better. Still pinned to a "Stable" release, not "Preview" —
// confirmed against https://ai.google.dev/gemini-api/docs/models (checked
// Aug 2026). The original gemini-2.5-flash choice broke once before when
// Google rolled the Gemini 3 line out as the new default and deprecated
// it — re-check that same page for the current Stable list before
// bumping this again.
const GEMINI_MODEL = 'gemini-3.5-flash-lite';
const GEMINI_URL    = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Anthropic-style JSON schema ({ type: 'object', properties: {...} }, all
// lowercase types) → Gemini's expected OpenAPI-subset schema, which uses
// uppercase type strings (OBJECT, STRING, NUMBER, ARRAY, BOOLEAN...).
// Recursive so nested array/object properties get converted too.
function schemaToGemini(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  const out = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === 'type' && typeof v === 'string') {
      out.type = v.toUpperCase();
    } else if (k === 'properties' && v && typeof v === 'object') {
      out.properties = {};
      for (const [pk, pv] of Object.entries(v)) out.properties[pk] = schemaToGemini(pv);
    } else if (k === 'items') {
      out.items = schemaToGemini(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// Our existing tool definitions ({ name, description, input_schema }, the
// same shape used for both the Anthropic and OpenRouter loops) → Gemini's
// tools:[{ functionDeclarations:[...] }] shape.
function toolsToGeminiFormat(tools) {
  return [{
    functionDeclarations: (tools || []).map((tool) => ({
      name:        tool.name,
      description: tool.description,
      parameters:  schemaToGemini(tool.input_schema || { type: 'object', properties: {} }),
    })),
  }];
}

// contents: Gemini's own { role: 'user'|'model'|'function', parts: [...] }
// array — callers build this themselves (shape differs enough from
// Anthropic/OpenAI's message format that a shared converter isn't worth
// it, same reasoning as callOpenRouter keeping its own loop in chat.js).
async function callGemini({ system, contents, tools, useGoogleSearch = false, thinkingBudget, maxOutputTokens = 1024 }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');

  const body = { contents };
  if (system) body.systemInstruction = { parts: [{ text: system }] };

  // Google Search grounding and custom function-calling tools are mutually
  // exclusive in a single request on Gemini — Deep Search mode uses only
  // the grounding tool (its whole job is real web lookups), while Deep
  // Think and extraction use only the app's own function-calling tools
  // (or none, for extraction).
  if (useGoogleSearch) {
    body.tools = [{ google_search: {} }];
  } else if (tools?.length) {
    body.tools = toolsToGeminiFormat(tools);
  }

  const generationConfig = { maxOutputTokens };
  if (thinkingBudget != null) generationConfig.thinkingConfig = { thinkingBudget };
  body.generationConfig = generationConfig;

  // Same defense-in-depth as callOpenRouter (see ../lib/openrouter.js for
  // the full reasoning) — this used to be a completely bare fetch with no
  // timeout and no retry at all, unlike every other AI-call wrapper in
  // the app. A hung connection to Gemini here left exam.js's /extract
  // request open indefinitely (an endless spinner on the upload, not a
  // clean error), and a one-off transient blip (network hiccup, a 5xx
  // from Google's own infrastructure) failed the whole extraction outright
  // instead of quietly succeeding on one retry.
  async function attempt() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const r = await fetch(`${GEMINI_URL}?key=${key}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        signal:  controller.signal,
      });
      const data = await r.json();
      if (!r.ok) {
        const err = new Error(data.error?.message || 'Gemini API error');
        err.status = r.status;
        throw err;
      }
      return data;
    } catch (err) {
      if (err.name === 'AbortError') {
        const e = new Error('The extraction service took too long to respond.');
        e.transient = true;
        throw e;
      }
      if (err.status === undefined || err.status >= 500) err.transient = true;
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  try {
    return await attempt();
  } catch (err) {
    if (!err.transient) throw err;
    await new Promise((r) => setTimeout(r, 800));
    try {
      return await attempt();
    } catch (err2) {
      const e = new Error(`The extraction service is temporarily unavailable. Please try again. (${err2.message})`);
      e.cause = err2;
      throw e;
    }
  }
}

module.exports = { callGemini, GEMINI_MODEL };
