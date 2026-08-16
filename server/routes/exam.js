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
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });
  if (!process.env.OPENROUTER_API_KEY) return res.status(500).json({ error: 'OPENROUTER_API_KEY not set' });

  const gate = await checkLimit(req.user.id, 'exam_generate');
  if (!gate.allowed) {
    return res.status(403).json({ error: limitMessage('exam_generate', gate.limit), code: 'DAILY_LIMIT', feature: 'exam_generate' });
  }

  try {
    // 8192 headroom (not the old 4096) — was cutting off comprehensive
    // slide decks mid-JSON on longer source docs, since generation stops
    // at the token cap, not at a clean JSON boundary. Slides ask for
    // full-detail, uncapped coverage, so they need the room.
    const data = await callOpenRouter({
      messages:    [{ role: 'user', content: prompt }],
      max_tokens:  8192,
      // Higher than the (unset→provider-default) value used for plain
      // Lumi chat — exam questions should vary between regenerations off
      // the same source material instead of converging on the same
      // "obvious" first-pass questions every time.
      temperature: 1.0,
      top_p:       0.95,
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

// ═══════════════════════════════════════════════════════════════
// Exam sessions — persist generated exams so they survive refresh.
// Free tier: most recent 15 sessions kept, older ones auto-pruned
// on save. Premium: unlimited (actual "Unlimited exam history" perk).
// ═══════════════════════════════════════════════════════════════
router.post('/sessions', async (req, res) => {
  try {
    const { mode, difficulty, sourceName = '', items } = req.body;
    if (!mode || !Array.isArray(items) || !items.length)
      return res.status(400).json({ error: 'mode and items are required' });
    const insert = await db.execute({
      sql:  `INSERT INTO exam_sessions (user_id, mode, difficulty, source_name, item_count, payload)
             VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        req.user.id, mode, difficulty || 'medium',
        String(sourceName).slice(0, 120),
        items.length, JSON.stringify(items),
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
    res.json({
      id: row.id, mode: row.mode, difficulty: row.difficulty,
      source_name: row.source_name, item_count: row.item_count,
      created_at: row.created_at, items,
    });
  } catch (err) {
    console.error('GET /exam/sessions/:id error:', err);
    res.status(500).json({ error: 'Could not load session' });
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