// server/lib/openrouter.js
// Thin wrapper around OpenRouter's OpenAI-compatible /chat/completions
// endpoint, used for the highest-volume, plain-text AI calls in the
// app (everyday Lumi chat, exam generation) — DeepSeek V3.2 there is
// both far cheaper than Haiku and benchmark-competitive with it.
//
// Deliberately NOT used for: PDF/image extraction in exam.js (needs
// native document/vision input — DeepSeek's chat endpoint is text-only),
// Deep Think (needs a native reasoning/thinking budget), or Deep Search
// (needs a hosted web-search tool). Those three run on Gemini instead
// (see ../lib/gemini.js), which covers all of them on its free tier.
const OPENROUTER_MODEL = 'deepseek/deepseek-chat';
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
      'X-Title':       'Aurora',
    },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'OpenRouter API error');
  return data;
}

module.exports = { callOpenRouter, OPENROUTER_MODEL };
