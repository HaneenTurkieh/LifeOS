// server/lib/openrouter.js
// Thin wrapper around OpenRouter's OpenAI-compatible /chat/completions
// endpoint — now the ONE model behind everyday Lumi chat, exam generation,
// Deep Think, and Deep Search (Aug 2026). Previously chat/exams ran on
// Claude Sonnet 5 while Deep Think/Deep Search/vision ran on Gemini
// flash-lite. Haneen's call: Sonnet was too expensive to run everything
// on, and Gemini flash-lite was too weak to justify the "Deep" branding —
// so both got replaced with a single second-place-behind-Sonnet model:
// DeepSeek V4 Pro. It's ~5-11x cheaper than Sonnet 5, benchmarks strongly
// on reasoning/math/knowledge/coding (GPQA Diamond 90.1%, HMMT 95.2%,
// #1 globally on LiveCodeBench), and supports a real reasoning-effort
// dial (high / xhigh) plus OpenRouter's provider-agnostic web-search
// plugin — covering Deep Think and Deep Search without needing Gemini
// at all. Sonnet 5 still objectively wins on tool-augmented reasoning
// benchmarks, so if Lumi's tool-calling quality ever visibly suffers,
// that's the tradeoff to revisit.
//
// Still NOT used for: PDF/image extraction in exam.js. DeepSeek V4 Pro's
// vision support is inconsistent across sources/providers as of this
// writing — not something to gamble document extraction on — so that one
// path stays on Gemini (see ../lib/gemini.js) until it's been verified.
const OPENROUTER_MODEL = 'deepseek/deepseek-v4-pro';
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

async function callOpenRouter({
  system, messages, tools, max_tokens = 1024, temperature, top_p,
  // 'high' is V4 Pro's normal/baseline reasoning tier (not an expensive
  // outlier — OpenRouter documents only high/xhigh as supported effort
  // levels for this model). 'xhigh' maps to its actual max-effort mode —
  // reserved for Deep Think specifically, since it's slower and pricier
  // per call. Pass reasoningEffort: null to omit thinking entirely.
  reasoningEffort = 'high',
  // Deep Search — OpenRouter's provider-agnostic web plugin (works with
  // any underlying model, not just Gemini). $4 per 1,000 results, so
  // cheap per actual use. See https://openrouter.ai/docs/guides/features/plugins/web-search
  webSearch = false,
  // Pass 'json' when a caller needs the reply to actually BE parseable
  // JSON and nothing else — e.g. anti-procrastination suggestions. A
  // plain "return only JSON" instruction in the prompt is a suggestion,
  // not a guarantee; models regularly wrap it in a code fence or add a
  // sentence before/after it anyway, which breaks a naive JSON.parse and
  // silently falls back to a worse response. This forces the provider to
  // actually constrain output to valid JSON.
  jsonMode = false,
}) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY not set');

  const body = {
    model:    OPENROUTER_MODEL,
    messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
    max_tokens,
  };
  if (reasoningEffort) body.reasoning = { effort: reasoningEffort };
  if (webSearch) body.plugins = [{ id: 'web', max_results: 5 }];
  if (jsonMode) body.response_format = { type: 'json_object' };
  // Optional — callers doing plain chat leave these unset (the model's
  // own default is fine there). Exam generation passes an explicit
  // higher temperature so regenerating from the same source material
  // doesn't produce near-identical output every time.
  if (temperature !== undefined) body.temperature = temperature;
  if (top_p !== undefined) body.top_p = top_p;
  if (tools?.length) body.tools = toolsToOpenAiFormat(tools);

  // Limiting exposure to the third-party provider (OpenRouter/DeepSeek)
  // being flaky, in two parts:
  //  1. A hard timeout — without one, a hung connection could leave the
  //     request open indefinitely, so the user just sees an endless
  //     spinner instead of a clean error. 45s generously covers even a
  //     slow Deep Think call (xhigh reasoning + a 6000-token cap).
  //  2. One automatic retry on TRANSIENT failures only (timeout, network
  //     error, or a 5xx from the provider's own infrastructure) — most of
  //     what would otherwise surface to the user as "failed chat" is a
  //     one-off blip that succeeds a second later, not a real outage.
  //     Does NOT retry 4xx errors (bad request, auth, rate limit) —
  //     retrying those just wastes time on something that won't change.
  async function attempt() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
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
        body:   JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await r.json();
      if (!r.ok) {
        const err = new Error(data.error?.message || 'OpenRouter API error');
        err.status = r.status;
        throw err;
      }
      return data;
    } catch (err) {
      if (err.name === 'AbortError') {
        const e = new Error('The AI provider took too long to respond.');
        e.transient = true;
        throw e;
      }
      // No `status` at all means fetch itself failed (network-level, not
      // an HTTP response) — also transient. A 5xx is the provider's own
      // infrastructure failing, also worth one retry. A 4xx is not.
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
      // Real bug that used to live here: this discarded err2 entirely and
      // threw a brand-new, generic message — every caller's own
      // console.error/logError (the admin Stats "Recent failures" panel
      // this exact wrapper's retry logic exists to make visible) only
      // ever saw "temporarily unavailable", never the actual timeout /
      // network error / 5xx detail that caused it. Callers only ever log
      // err.message or console.error the whole error — none of them
      // relay it straight to the end user (that's always a separate,
      // fixed, friendly response) — so there's no safety reason to throw
      // away the real detail here.
      const e = new Error(`The AI provider is temporarily unavailable. Please try again. (${err2.message})`);
      e.cause = err2;
      throw e;
    }
  }
}

module.exports = { callOpenRouter, OPENROUTER_MODEL };
