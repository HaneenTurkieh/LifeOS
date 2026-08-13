// server/lib/openrouter.js
// Thin wrapper around OpenRouter's OpenAI-compatible /chat/completions
// endpoint, used for the highest-volume, plain-text AI calls in the
// app (everyday Lumi chat, exam generation).
//
// Bumped from deepseek/deepseek-chat (DeepSeek V3.2) to Claude Sonnet 5
// (Aug 2026) — Haneen asked for Lumi to actually be smarter, not just
// cheap. Sonnet 5 supports adaptive "thinking" via the `reasoning` param
// below, which we turn on at a moderate budget so multi-step requests get
// real reasoning without every single "hey" costing a slow, expensive
// max-effort pass. If cost ever becomes a real concern at scale, DeepSeek
// R1 (deepseek/deepseek-r1) is the cheaper reasoning-capable fallback.
//
// Deliberately NOT used for: PDF/image extraction in exam.js (needs
// native document/vision input), Deep Think (needs a native
// reasoning/thinking budget of its own), or Deep Search (needs a hosted
// web-search tool). Those three run on Gemini instead (see ../lib/gemini.js).
const OPENROUTER_MODEL = 'anthropic/claude-sonnet-5';
const OPENROUTER_URL   = 'https://openrouter.ai/api/v1/chat/completions';

// Anthropic tool shape ({ name, description, input_schema }) → OpenAI/
// OpenRouter function-calling shape ({ type:'function', function:{...} }).
// Lets chat.js keep defining its tools once, in the format it already
// used for the Anthropic loop, rather than maintaining two copies.
function toolsToOpenAiFormat(tools) {
  return (tools || []).map((tool) => ({
    type: 'function',
    function: {
      name:        tool.name,
      description: tool.description,
      parameters:  tool.input_schema || { type: 'object', properties: {} },
    },
  }));
}

async function callOpenRouter({ system, messages, tools, max_tokens = 1024, temperature, top_p }) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY not set');

  const body = {
    model:    OPENROUTER_MODEL,
    messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
    max_tokens,
    // Moderate thinking budget — enough for Sonnet 5 to actually reason
    // through non-trivial requests (see the REASONING block in Lumi's
    // system prompt) without every one-line "hey" eating extra latency
    // and tokens on max-effort thinking it doesn't need.
    reasoning: { effort: 'medium' },
  };
  // Optional — callers doing plain chat leave these unset (DeepSeek's
  // own default is fine there). Exam generation passes an explicit
  // higher temperature so regenerating from the same source material
  // doesn't produce near-identical output every time.
  if (temperature !== undefined) body.temperature = temperature;
  if (top_p !== undefined) body.top_p = top_p;
  if (tools?.length) body.tools = toolsToOpenAiFormat(tools);

  const r = await fetch(OPENROUTER_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${key}`,
      // Not required for billing, just OpenRouter's own attribution —
      // harmless to send, helps their leaderboard/analytics.
      'HTTP-Referer':  'https://life-os-three-xi.vercel.app',
      'X-Title':       'Nuvora',
    },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'OpenRouter API error');
  return data;
}

module.exports = { callOpenRouter, OPENROUTER_MODEL };
