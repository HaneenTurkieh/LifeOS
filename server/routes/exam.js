const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const { db }  = require('../db/connection');
const { isPremium } = require('../lib/premium');
const { checkLimit, recordUsage, limitMessage } = require('../lib/usageLimits');
const { callOpenRouter } = require('../lib/openrouter');
const { callGemini } = require('../lib/gemini');

// 40MB — raw upload size, not what actually reaches the AI. chat.js caps
// each attachment's extracted text at 25,000 characters before it's sent
// to Lumi (MAX_ATTACHMENT_CHARS), so a bigger raw-file ceiling here mostly
// just stops rejecting real image-heavy PDFs/PPTX before extraction even
// runs — it doesn't meaningfully raise per-message AI cost.
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 40 * 1024 * 1024 },
});
const SUPPORTED = ['pdf','pptx','docx','txt','png','jpg','jpeg','webp','gif'];

// Free accounts keep only their most recent N saved sessions —
// premium keeps everything. Enforced by pruning after each save
// rather than blocking the save itself, so the newest exam is
// always kept even if it pushes a free user over the limit.
const FREE_SESSION_LIMIT = 15;

// ── POST /extract ─────────────────────────────────────────────
router.post('/extract', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });
  const ext = file.originalname.toLowerCase().split('.').pop();
  if (!SUPPORTED.includes(ext))
    return res.status(400).json({ error: `Unsupported type. Supported: ${SUPPORTED.join(', ')}` });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY not set' });
  // Only pdf/image extraction actually calls Gemini (real, metered AI
  // cost) — txt/docx/pptx parse locally below with no AI call, so they
  // don't need gating. This route used to have no limit at all on the
  // Gemini-calling paths.
  const callsGemini = ext === 'pdf' || ['png','jpg','jpeg','webp','gif'].includes(ext);
  if (callsGemini) {
    const gate = await checkLimit(req.user.id, 'file_extract');
    if (!gate.allowed) {
      return res.status(403).json({ error: limitMessage('file_extract', gate.limit), code: 'DAILY_LIMIT', feature: 'file_extract' });
    }
  }
  try {
    let text = '';
    if (ext === 'pdf') {
      const base64 = file.buffer.toString('base64');
      const data = await callGemini({
        contents: [{
          role: 'user',
          parts: [
            { inline_data: { mime_type: 'application/pdf', data: base64 } },
            { text: 'Extract ALL text from this document. Include every heading, paragraph, bullet point, table, formula, and caption. Do not skip or summarize anything. Return raw text only.' },
          ],
        }],
        maxOutputTokens: 8192,
      });
      const parts = data.candidates?.[0]?.content?.parts || [];
      text = parts.filter((p) => p.text).map((p) => p.text).join('');
    } else if (['png','jpg','jpeg','webp','gif'].includes(ext)) {
      const base64 = file.buffer.toString('base64');
      const data = await callGemini({
        contents: [{
          role: 'user',
          parts: [
            { inline_data: { mime_type: file.mimetype, data: base64 } },
            { text: 'Extract ALL text and content visible in this image. Include everything — text, labels, diagrams, formulas, tables. Return the complete content.' },
          ],
        }],
        maxOutputTokens: 8192,
      });
      const parts = data.candidates?.[0]?.content?.parts || [];
      text = parts.filter((p) => p.text).map((p) => p.text).join('');
    } else if (ext === 'txt') {
      text = file.buffer.toString('utf-8');
    } else if (ext === 'docx') {
      const mammoth = require('mammoth');
      const result  = await mammoth.extractRawText({ buffer: file.buffer });
      text = result.value;
    } else if (ext === 'pptx') {
      const JSZip = require('jszip');
      const zip   = await JSZip.loadAsync(file.buffer);
      const slideFiles = Object.keys(zip.files)
        .filter(f => /^ppt\/slides\/slide\d+\.xml$/.test(f))
        .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));
      const lines = [];
      for (const sf of slideFiles) {
        const xml     = await zip.files[sf].async('text');
        const matches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || [];
        const slideText = matches.map(m => m.replace(/<[^>]+>/g,'').trim()).filter(Boolean).join(' ');
        if (slideText.trim()) lines.push(slideText.trim());
      }
      text = lines.join('\n\n');
    }
    if (!text.trim())
      return res.status(422).json({ error: 'Could not extract text. Try pasting content directly.' });
    if (callsGemini) await recordUsage(req.user.id, 'file_extract');
    res.json({ text: text.trim(), filename: file.originalname, wordCount: text.split(/\s+/).filter(Boolean).length });
  } catch (err) {
    console.error('Exam extract error:', err);
    res.status(500).json({ error: 'Extraction failed. Try pasting content directly.' });
  }
});

// ── Slide style preference — a freeform description of how someone
// likes their decks presented, read into the slide-generation prompt
// so output adapts to taste instead of one fixed layout for everyone. ──
router.get('/style-pref', async (req, res) => {
  try {
    const row = (await db.execute({
      sql: `SELECT slide_style_pref FROM users WHERE id = ?`, args: [req.user.id],
    })).rows[0];
    res.json({ style_pref: row?.slide_style_pref || '' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});
router.put('/style-pref', async (req, res) => {
  try {
    const { style_pref = '' } = req.body;
    await db.execute({
      sql:  `UPDATE users SET slide_style_pref = ? WHERE id = ?`,
      args: [String(style_pref).slice(0, 400), req.user.id],
    });
    res.json({ style_pref: String(style_pref).slice(0, 400) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// ── POST /generate ────────────────────────────────────────────
// Pure text-in/JSON-out generation (no document/vision input, unlike
// /extract below) — routed to OpenRouter/DeepSeek V3.2 instead of
// Claude, since this is the single highest-volume AI call in the app
// and DeepSeek is both far cheaper and benchmark-competitive here.
router.post('/generate', async (req, res) => {
  const { prompt, mode } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });
  if (!process.env.OPENROUTER_API_KEY) return res.status(500).json({ error: 'OPENROUTER_API_KEY not set' });

  const gate = await checkLimit(req.user.id, 'exam_generate');
  if (!gate.allowed) {
    return res.status(403).json({ error: limitMessage('exam_generate', gate.limit), code: 'DAILY_LIMIT', feature: 'exam_generate' });
  }

  try {
    // Real bug this fixes: this route always ran at callOpenRouter's
    // default reasoningEffort:'high', same as every other mode here —
    // fine for a flat array of MCQs/flashcards, but the concept map's
    // recursive tree (each node needing a title+summary+source+an exact
    // verbatim quote, nested 2-3 levels deep) made the model "think"
    // heavily before answering, reliably pushing total time past
    // callOpenRouter's 45s timeout + one retry (~90s) and failing
    // outright — confirmed live, not a one-off. Skipping the thinking
    // budget entirely for this mode keeps it well under that ceiling;
    // the tradeoff (occasionally a less exact quote match) is already
    // handled gracefully client-side — SourceViewerModal just shows the
    // source file without a highlight if the quote isn't found verbatim.
    const reasoningEffort = mode === 'mindmap' ? null : 'high';
    // Second real bug, found after the fix above: turning reasoning off
    // fixed *thinking* time, but a mindmap's output length scales with
    // how much source material it has to cover ("don't skip any topic")
    // in a way MCQs/flashcards don't — those just sample N items
    // regardless of document length. A file well under the app's own
    // 8000-word "large doc" warning (confirmed live at 3,789 words)
    // still failed outright, purely from needing more wall-clock time to
    // generate a big tree, no thinking involved. First attempt at this
    // raised the budget to 85s — confirmed live that a ~2,900-word doc
    // completes fine in ~70s under that budget, but Haneen's own
    // 3,789-word file still failed at ~120s even with the 85s bump
    // (denser/harder-to-summarize source material takes proportionally
    // longer, not just more words) — so this raises it again to 150s, a
    // wide enough margin over the ~70s baseline to cover real variance
    // in generation time rather than just the one data point that
    // happened to fail. Only mindmap gets the longer budget; every other
    // mode keeps the 45s default that's worked fine for it all along.
    const timeoutMs = mode === 'mindmap' ? 150000 : undefined; // undefined → callOpenRouter's own 45s default
    // Belt-and-suspenders alongside the timeout bump above: even 150s
    // has to end somewhere, so cap how much source text a mindmap prompt
    // can actually carry. The client appends the extracted content as
    // the very last part of the prompt (after all the instructions), so
    // slicing from the end only ever trims content, never the
    // instructions telling the model what to do with it. 40,000 chars is
    // roughly 6,500-7,000 words — comfortably past every real document
    // this has been tested against (including the 3,789-word file that
    // needed the timeout bump), so this doesn't change behavior for any
    // realistic upload; it just stops a truly enormous document from
    // being a guaranteed timeout no matter how generous the budget is.
    const MAX_MINDMAP_PROMPT_CHARS = 40000;
    const boundedPrompt = mode === 'mindmap' ? prompt.slice(0, MAX_MINDMAP_PROMPT_CHARS) : prompt;
    // 8192 headroom (not the old 4096) — was cutting off comprehensive
    // slide decks mid-JSON on longer source docs, since generation stops
    // at the token cap, not at a clean JSON boundary. Slides ask for
    // full-detail, uncapped coverage, so they need the room.
    //
    // Real bug found after both timeout bumps above didn't fix Haneen's
    // failure: it was never a timeout at all. A concept map's JSON tree
    // (title+summary+source+quote per node, up to 6 top-level topics ×
    // 4 children × 2 grandchildren = 70+ verbose nodes for a genuinely
    // comprehensive tree) can overflow 8192 tokens on a content-rich
    // document — the exact same "cut off mid-JSON at the token cap, not
    // a clean boundary" failure the comment above already documents for
    // slides, just not yet fixed for mindmap. The generation *finishes*
    // well inside any timeout — the response is just truncated, invalid
    // JSON, which fails to parse client-side and surfaces as a generic
    // "Generation failed," easy to mistake for the same timeout this
    // route already spent two rounds fixing. Mindmap gets its own higher
    // ceiling instead of sharing exam/flashcard/slide's 8192.
    const maxTokens = mode === 'mindmap' ? 16000 : 8192;
    const data = await callOpenRouter({
      messages:    [{ role: 'user', content: boundedPrompt }],
      max_tokens:  maxTokens,
      // Higher than the (unset→provider-default) value used for plain
      // Lumi chat — exam questions should vary between regenerations off
      // the same source material instead of converging on the same
      // "obvious" first-pass questions every time.
      temperature: 1.0,
      top_p:       0.95,
      reasoningEffort,
      timeoutMs,
    });
    const text = data.choices?.[0]?.message?.content || '';
    // Real bug that used to live here: recordUsage ran unconditionally
    // right after the API call didn't throw, even when the model's
    // response was empty/malformed — burning one of the user's 5 daily
    // exam_generate credits for a generation that produced nothing
    // usable, violating usageLimits.js's own documented contract
    // ("Only call after the AI request actually succeeded"). A failed
    // generation now doesn't cost anything, matching every other gated
    // route in the app.
    if (!text.trim()) {
      return res.status(502).json({ error: 'Generation failed. Please try again.' });
    }
    await recordUsage(req.user.id, 'exam_generate');
    res.json({ text, remaining: gate.remaining - 1 });
  } catch (err) {
    console.error('Exam generate error:', err);
    res.status(500).json({ error: 'Generation failed. Please try again.' });
  }
});

// ── POST /chat ─────────────────────────────────────────────────
// NotebookLM-style "ask questions about exactly this material" — the
// quiz/flashcard/slide modes above are one-shot generation, this is a
// back-and-forth conversation grounded in the same uploaded/pasted
// content instead of Lumi's general knowledge. No embeddings/vector
// search involved: the content sizes this app deals with (one file's
// extracted text, capped below) comfortably fit in a single prompt, so
// the simplest correct thing is to just resend the full source text
// each turn and let the model quote/point back into it directly — a
// real RAG pipeline would only start paying for itself with sources
// far bigger than anything Exam Assistant currently accepts.
const MAX_CHAT_SOURCE_CHARS = 20000;
router.post('/chat', async (req, res) => {
  const { content, question, history, deepSearch } = req.body;
  if (!content?.trim())  return res.status(400).json({ error: 'content is required' });
  if (!question?.trim()) return res.status(400).json({ error: 'question is required' });
  if (!process.env.OPENROUTER_API_KEY) return res.status(500).json({ error: 'OPENROUTER_API_KEY not set' });

  // A Deep Search turn leaves the uploaded material and hits the real web
  // (OpenRouter's web plugin, its own per-search fee on top of tokens) —
  // same priciest-action gate Lumi's main chat uses for its own Deep
  // Search mode, and deliberately separate from study_chat's own limit.
  // A plain grounded turn stays cheap and keeps counting against
  // study_chat's generous 30/day; only turns that actually ask to go
  // beyond the material count against deep_search's much tighter cap.
  const gateFeature = deepSearch ? 'deep_search' : 'study_chat';
  const gate = await checkLimit(req.user.id, gateFeature);
  if (!gate.allowed) {
    return res.status(403).json({ error: limitMessage(gateFeature, gate.limit), code: 'DAILY_LIMIT', feature: gateFeature });
  }

  // Trimmed, not the client's problem to enforce — a pasted-notes textarea
  // has no size limit of its own the way file uploads do.
  const source = content.trim().slice(0, MAX_CHAT_SOURCE_CHARS);
  // Two different contracts depending on deepSearch: the default is
  // strictly grounded (never guess beyond the material, exam-prep safe),
  // Deep Search explicitly permits going outside it but must say so each
  // time, so the student always knows what's from their notes vs. the
  // web/the model's own knowledge.
  const system = deepSearch
    ? `You are a study assistant helping a student understand material they've given you. Prefer the study material below when it actually covers the question — quote or point to the specific part your answer comes from. When the question goes beyond what the material covers, you may use your own knowledge and real-time web search to answer it — but always say plainly when you're doing that (e.g. "this isn't in your material, but based on a web search / general knowledge..."), so the student always knows what's grounded in their own notes versus outside information. Keep answers focused and conversational, not a full essay unless asked.

STUDY MATERIAL:
${source}`
    : `You are a study assistant helping a student understand material they've given you. Answer ONLY using the study material below — never your own outside knowledge, even if you happen to know more about the topic. If the material doesn't actually cover what's being asked, say so plainly instead of guessing or filling the gap yourself. Where it helps, quote or point to the specific part of the material your answer comes from. Keep answers focused and conversational, not a full essay unless asked.

STUDY MATERIAL:
${source}`;
  // Only the last few turns — bounds cost on a long-running conversation
  // (the full source is already being resent every single turn above,
  // so an unbounded transcript on top of that compounds fast) and old
  // turns matter far less than the material itself for grounding.
  const trimmedHistory = Array.isArray(history) ? history.slice(-8) : [];
  const messages = [
    ...trimmedHistory
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map(m => ({ role: m.role, content: m.content.slice(0, 4000) })),
    { role: 'user', content: question.trim().slice(0, 2000) },
  ];

  try {
    const data = await callOpenRouter({
      system,
      messages,
      max_tokens:  deepSearch ? 2000 : 1200,
      temperature: 0.3, // grounded Q&A, not creative variety like /generate
      webSearch:   !!deepSearch,
    });
    const answer = data.choices?.[0]?.message?.content || '';
    if (!answer.trim()) {
      return res.status(502).json({ error: 'No answer generated. Please try again.' });
    }
    await recordUsage(req.user.id, gateFeature);
    res.json({ answer, remaining: gate.remaining - 1, deepSearch: !!deepSearch });
  } catch (err) {
    console.error('Exam chat error:', err);
    res.status(500).json({ error: 'Chat failed. Please try again.' });
  }
});

// ═══════════════════════════════════════════════════════════════
// Exam sessions — persist generated exams so they survive refresh.
// Free tier: most recent 15 sessions kept, older ones auto-pruned
// on save. Premium: unlimited (actual "Unlimited exam history" perk).
// ═══════════════════════════════════════════════════════════════
// MAX_MINDMAP_PROMPT_CHARS-sized ceiling on what gets stored, same
// reasoning as that cap: this is a safety net against pathological
// input, not a limit anyone realistic hits. Storing the full source
// alongside every session (not just mindmap) is what makes "Ask Lumi
// more" keep working after a session is reopened later — that's the
// actual bug this whole feature exists to fix (see askLumiAboutNode's
// comment in ExamAssistant.jsx).
const MAX_STORED_SOURCE_CHARS = 40000;
router.post('/sessions', async (req, res) => {
  try {
    const { mode, difficulty, sourceName = '', items, sourceContent = '' } = req.body;
    if (!mode || !Array.isArray(items) || !items.length)
      return res.status(400).json({ error: 'mode and items are required' });
    const insert = await db.execute({
      sql:  `INSERT INTO exam_sessions (user_id, mode, difficulty, source_name, item_count, payload, source_content)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        req.user.id, mode, difficulty || 'medium',
        String(sourceName).slice(0, 120),
        items.length, JSON.stringify(items),
        String(sourceContent).slice(0, MAX_STORED_SOURCE_CHARS) || null,
      ],
    });
    const newId = Number(insert.lastInsertRowid);

    // Prune older sessions beyond the free limit — never touches
    // premium accounts, and always keeps the one just saved.
    const premium = await isPremium(req.user.id);
    if (!premium) {
      await db.execute({
        sql: `DELETE FROM exam_sessions
              WHERE user_id = ? AND id NOT IN (
                SELECT id FROM exam_sessions WHERE user_id = ?
                ORDER BY created_at DESC LIMIT ?
              )`,
        args: [req.user.id, req.user.id, FREE_SESSION_LIMIT],
      });
    }

    res.status(201).json({ id: newId });
  } catch (err) {
    console.error('POST /exam/sessions error:', err);
    res.status(500).json({ error: 'Could not save session' });
  }
});

router.get('/sessions', async (req, res) => {
  try {
    const premium = await isPremium(req.user.id);
    const limit   = premium ? 500 : FREE_SESSION_LIMIT;
    const result = await db.execute({
      sql:  `SELECT id, mode, difficulty, source_name, item_count, created_at
             FROM exam_sessions WHERE user_id = ?
             ORDER BY created_at DESC LIMIT ?`,
      args: [req.user.id, limit],
    });
    res.json(result.rows);
  } catch (err) {
    console.error('GET /exam/sessions error:', err);
    res.status(500).json({ error: 'Could not load sessions' });
  }
});

router.get('/sessions/:id', async (req, res) => {
  try {
    const row = (await db.execute({
      sql:  `SELECT * FROM exam_sessions WHERE id = ? AND user_id = ?`,
      args: [req.params.id, req.user.id],
    })).rows[0];
    if (!row) return res.status(404).json({ error: 'Session not found' });
    let items = [];
    try { items = JSON.parse(row.payload); } catch (_) {}
    let chatMessages = null;
    if (row.chat_messages) {
      try { chatMessages = JSON.parse(row.chat_messages); } catch (_) {}
    }
    res.json({
      id: row.id, mode: row.mode, difficulty: row.difficulty,
      source_name: row.source_name, item_count: row.item_count,
      created_at: row.created_at, items,
      // Both null when this session predates this feature or never had
      // a linked chat — client treats either the same way (no source to
      // ground a chat in, same as before this existed at all).
      source_content: row.source_content || null,
      chat_messages:  chatMessages,
    });
  } catch (err) {
    console.error('GET /exam/sessions/:id error:', err);
    res.status(500).json({ error: 'Could not load session' });
  }
});

// Attaches/updates a chat transcript on an EXISTING session row — used
// both to keep a Concept Map's "Ask Lumi more" conversation saved on the
// exact same row as the map it branched from (Haneen's explicit request:
// not a separate, unrelated Past Sessions entry), and to save follow-up
// turns onto a standalone Study Chat session already created via
// POST /sessions/chat below. Overwrites the whole transcript each call
// rather than appending server-side — the client already holds the full
// running conversation in memory, so it's simplest for it to just be the
// one source of truth sent up each time, same as how items/payload above
// are always the complete set, never a partial patch.
router.patch('/sessions/:id/chat', async (req, res) => {
  try {
    const { chatMessages } = req.body;
    if (!Array.isArray(chatMessages)) return res.status(400).json({ error: 'chatMessages array required' });
    const result = await db.execute({
      sql:  `UPDATE exam_sessions SET chat_messages = ? WHERE id = ? AND user_id = ?`,
      args: [JSON.stringify(chatMessages), req.params.id, req.user.id],
    });
    if (result.rowsAffected === 0) return res.status(404).json({ error: 'Session not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('PATCH /exam/sessions/:id/chat error:', err);
    res.status(500).json({ error: 'Could not save chat' });
  }
});

// Creates a brand-new session for a Study Chat started from scratch —
// i.e. NOT branched off an existing Concept Map (that case reuses the
// map's own session row via the PATCH above instead). Mirrors POST
// /sessions above but keyed on a chat transcript instead of generated
// items — item_count tracks message count instead of question count so
// Past Sessions' existing "N items" label still reads sensibly for a
// chat entry, and payload stores an empty array since there's no
// separate "generated content" distinct from the conversation itself.
router.post('/sessions/chat', async (req, res) => {
  try {
    const { sourceName = '', sourceContent = '', chatMessages } = req.body;
    if (!Array.isArray(chatMessages) || !chatMessages.length)
      return res.status(400).json({ error: 'chatMessages are required' });
    const insert = await db.execute({
      sql:  `INSERT INTO exam_sessions (user_id, mode, difficulty, source_name, item_count, payload, source_content, chat_messages)
             VALUES (?, 'chat', 'medium', ?, ?, '[]', ?, ?)`,
      args: [
        req.user.id, String(sourceName).slice(0, 120), chatMessages.length,
        String(sourceContent).slice(0, MAX_STORED_SOURCE_CHARS) || null,
        JSON.stringify(chatMessages),
      ],
    });
    const newId = Number(insert.lastInsertRowid);
    const premium = await isPremium(req.user.id);
    if (!premium) {
      await db.execute({
        sql: `DELETE FROM exam_sessions
              WHERE user_id = ? AND id NOT IN (
                SELECT id FROM exam_sessions WHERE user_id = ?
                ORDER BY created_at DESC LIMIT ?
              )`,
        args: [req.user.id, req.user.id, FREE_SESSION_LIMIT],
      });
    }
    res.status(201).json({ id: newId });
  } catch (err) {
    console.error('POST /exam/sessions/chat error:', err);
    res.status(500).json({ error: 'Could not save chat session' });
  }
});

router.delete('/sessions/:id', async (req, res) => {
  try {
    const result = await db.execute({
      sql:  `DELETE FROM exam_sessions WHERE id = ? AND user_id = ?`,
      args: [req.params.id, req.user.id],
    });
    if (result.rowsAffected === 0) return res.status(404).json({ error: 'Session not found' });
    res.status(204).end();
  } catch (err) {
    console.error('DELETE /exam/sessions/:id error:', err);
    res.status(500).json({ error: 'Could not delete session' });
  }
});

module.exports = router;