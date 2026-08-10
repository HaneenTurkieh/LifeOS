// server/lib/gemini.js
// Thin wrapper around Google's Gemini generateContent REST API — used for
// the three paths that need capabilities OpenRouter/DeepSeek doesn't have:
// PDF/image extraction (native vision/document input), Deep Think (native
// "thinking" reasoning), and Deep Search (hosted Google Search grounding
// tool). Covers all three, is free-tier eligible, and per public
// benchmarks runs far cheaper than Claude Haiku on paid usage — so this
// fully replaces ANTHROPIC_API_KEY across the app.
//
// Model pinned to gemini-3.1-flash-lite (stable, not preview) — the
// original gemini-2.5-flash choice started throwing "no longer available
// to new users" once Google rolled out the Gemini 3 line as the default
// for new AI Studio projects. If this ever needs bumping again, check
// https://ai.google.dev/gemini-api/docs/models for the current "Stable"
// list before picking a replacement — "Preview" models get deprecated
// on much shorter notice.
const GEMINI_MODEL = 'gemini-3.1-flash-lite';
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

  const r = await fetch(`${GEMINI_URL}?key=${key}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'Gemini API error');
  return data;
}

module.exports = { callGemini, GEMINI_MODEL };
