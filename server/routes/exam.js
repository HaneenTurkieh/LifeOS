const express = require('express');
const router  = express.Router();
const multer  = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 25 * 1024 * 1024 }, // 25MB
});

const SUPPORTED = ['pdf','pptx','docx','txt','png','jpg','jpeg','webp','gif'];

router.post('/extract', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  const ext = file.originalname.toLowerCase().split('.').pop();
  if (!SUPPORTED.includes(ext)) {
    return res.status(400).json({ error: `Unsupported type. Supported: ${SUPPORTED.join(', ')}` });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });

  try {
    let text = '';

    // ── PDF — Claude reads natively ───────────────────────────
    if (ext === 'pdf') {
      const base64 = file.buffer.toString('base64');
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: { 'Content-Type':'application/json', 'x-api-key': key, 'anthropic-version':'2023-06-01' },
        body: JSON.stringify({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 4096,
          messages: [{
            role:    'user',
            content: [
              { type:'document', source:{ type:'base64', media_type:'application/pdf', data: base64 } },
              { type:'text', text:'Extract ALL text from this document. Include every heading, paragraph, bullet point, table, formula, and caption. Do not skip or summarize anything. Return raw text only.' },
            ],
          }],
        }),
      });
      const d = await r.json();
      text = d.content?.[0]?.text || '';

    // ── Images — Claude vision ────────────────────────────────
    } else if (['png','jpg','jpeg','webp','gif'].includes(ext)) {
      const base64    = file.buffer.toString('base64');
      const mediaType = file.mimetype;
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: { 'Content-Type':'application/json', 'x-api-key': key, 'anthropic-version':'2023-06-01' },
        body: JSON.stringify({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 4096,
          messages: [{
            role:    'user',
            content: [
              { type:'image', source:{ type:'base64', media_type: mediaType, data: base64 } },
              { type:'text',  text:'Extract ALL text and content visible in this image. Include everything — text, labels, diagrams, formulas, tables. Return the complete content.' },
            ],
          }],
        }),
      });
      const d = await r.json();
      text = d.content?.[0]?.text || '';

    // ── TXT ───────────────────────────────────────────────────
    } else if (ext === 'txt') {
      text = file.buffer.toString('utf-8');

    // ── DOCX — mammoth ────────────────────────────────────────
    } else if (ext === 'docx') {
      const mammoth = require('mammoth');
      const result  = await mammoth.extractRawText({ buffer: file.buffer });
      text = result.value;

    // ── PPTX — JSZip + XML parsing ────────────────────────────
    } else if (ext === 'pptx') {
      const JSZip = require('jszip');
      const zip   = await JSZip.loadAsync(file.buffer);

      // Get all slide files sorted by slide number
      const slideFiles = Object.keys(zip.files)
        .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
        .sort((a, b) => {
          const na = parseInt(a.match(/\d+/)[0]);
          const nb = parseInt(b.match(/\d+/)[0]);
          return na - nb;
        });

      const lines = [];
      for (const sf of slideFiles) {
        const xml       = await zip.files[sf].async('text');
        // Extract all <a:t> text nodes
        const matches   = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || [];
        const slideText = matches
          .map((m) => m.replace(/<[^>]+>/g, '').trim())
          .filter(Boolean)
          .join(' ');
        if (slideText.trim()) lines.push(slideText.trim());
      }
      text = lines.join('\n\n');
    }

    if (!text.trim()) {
      return res.status(422).json({ error: 'Could not extract text from this file. Try copying and pasting the content directly.' });
    }

    res.json({ text: text.trim(), filename: file.originalname });
  } catch (err) {
    console.error('Exam extract error:', err);
    res.status(500).json({ error: 'Extraction failed. Try pasting the content directly.' });
  }
});

module.exports = router;