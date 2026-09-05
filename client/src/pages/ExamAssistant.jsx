import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Sparkles, RotateCcw, Check, X,
  ChevronLeft, ChevronRight, ChevronDown, Upload, FileText,
  Clock, BarChart2, Info, AlertCircle, History as HistoryIcon, Trash2,
  FileDown, Presentation, Network, Globe,
} from 'lucide-react';
import { api, getToken } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import VoiceInputButton, { appendText } from '../components/VoiceInputButton.jsx';
import { renderMarkdown } from '../utils/markdown.jsx';

const FILE_TYPES = [
  { ext:'PDF',  icon:'📄', accept:'.pdf'              },
  { ext:'PPTX', icon:'📊', accept:'.pptx'             },
  { ext:'DOCX', icon:'📝', accept:'.docx'             },
  { ext:'TXT',  icon:'📃', accept:'.txt'              },
  { ext:'IMG',  icon:'🖼️', accept:'.png,.jpg,.jpeg,.webp,.gif' },
];
const ACCEPTED    = '.pdf,.pptx,.docx,.txt,.png,.jpg,.jpeg,.webp,.gif';
const MAX_SIZE_MB = 25;

const glass = {
  background:           'rgba(255,255,255,0.55)',
  border:               '1px solid rgba(255,255,255,0.65)',
  backdropFilter:       'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  boxShadow:            'inset 0 1px 0 rgba(255,255,255,0.80)',
};
const cardGlass = {
  background:           'rgba(255,255,255,0.60)',
  border:               '1px solid rgba(255,255,255,0.70)',
  backdropFilter:       'blur(32px)',
  WebkitBackdropFilter: 'blur(32px)',
  boxShadow:            '0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.85)',
  borderRadius:         '1.5rem',
};

function fmtSessionDate(dateStr, lang) {
  if (!dateStr) return '';
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z');
  if (isNaN(d)) return dateStr;
  const locale = lang === 'ar' ? 'ar' : 'en-US';
  return d.toLocaleDateString(locale, { month:'short', day:'numeric' }) +
    ' · ' + d.toLocaleTimeString(locale, { hour:'numeric', minute:'2-digit' });
}

function getAccentHex() {
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--accent-500').trim();
    const [r, g, b] = raw.split(/\s+/).map(Number);
    if ([r, g, b].some((n) => Number.isNaN(n))) return '7C6AF0';
    return [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase();
  } catch (_) { return '7C6AF0'; }
}

// Detects Arabic script anywhere in the generated content so the PDF
// exporter can automatically pick the correct rendering strategy —
// no user choice needed, no silent breakage either way.
function containsArabic(data) {
  try { return /[\u0600-\u06FF]/.test(JSON.stringify(data)); }
  catch (_) { return false; }
}

// jsPDF's built-in Helvetica font only shapes the WinAnsi (Latin-1-ish)
// glyph set. Anything outside it silently corrupts: astral-plane emoji
// (💡, 📝, 🎉…) get split into their two UTF-16 surrogate halves and each
// half gets looked up as its own WinAnsi byte — 💡 (U+1F4A1) becomes the
// exact "Ø=Ü¡" garbage seen in exported PDFs — and symbols like → or ✓
// fall back to unrelated stray glyphs, which also throws off jsPDF's own
// width measurement for the rest of that line (the letter-spread look on
// affected lines). Strip/replace anything outside that range before it
// ever reaches doc.text() or splitTextToSize().
function toPdfSafeText(str) {
  return String(str)
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}️]/gu, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

const PDF_GREEN = [45, 167, 110]; // #2DA76E — same brand green used to mark correct answers in the Arabic snapshot path

// ── PDF export, English/Latin path (jsPDF native text) ─────────
// Real selectable/searchable text, small file size. Only used when
// the content contains no Arabic — jsPDF's built-in fonts don't
// shape Arabic letterforms correctly (see snapshot path below).
async function exportPdfText(mode, data, t, isPremium) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 48;
  let y = 56;
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth  = doc.internal.pageSize.getWidth();
  const maxWidth   = pageWidth - marginX * 2;

  const heading = {
    mcq: t('exam.mcq'), blanks: t('exam.blanks'), mixed: t('exam.mixed'),
    flashcards: t('exam.flashcards'), slides: t('exam.slides'), mindmap: t('exam.mindmap'),
  }[mode] || mode;

  const ensureSpace = (lines = 1, lineHeight = 16) => {
    if (y + lines * lineHeight > pageHeight - 48) {
      doc.addPage();
      y = 56;
    }
  };
  // `color` highlights a line in green (correct answers) instead of the
  // old inline "✓" mark, which was both the visual the user asked to
  // change and (being outside WinAnsi) the actual source of the garbling.
  const writeWrapped = (text, size = 11, bold = false, indent = 0, color = null) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...(color || [0, 0, 0]));
    const safeText = toPdfSafeText(text);
    const lines = doc.splitTextToSize(safeText, maxWidth - indent);
    ensureSpace(lines.length, size * 1.4);
    doc.text(lines, marginX + indent, y);
    y += lines.length * size * 1.4;
    doc.setTextColor(0, 0, 0);
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(toPdfSafeText(heading), marginX, y);
  y += 32;

  if (mode === 'mcq' || mode === 'mixed') {
    data.forEach((q, i) => {
      ensureSpace(2, 18);
      if (mode === 'mixed' && q.type === 'blank') {
        writeWrapped(`${i + 1}. ${q.sentence}`, 12, true);
        writeWrapped(`${t('exam.answer')}: ${q.answer}`, 10, true, 16, PDF_GREEN);
        if (q.hint) writeWrapped(`${t('exam.hint')}: ${q.hint}`, 10, false, 16);
      } else {
        writeWrapped(`${i + 1}. ${q.question}`, 12, true);
        (q.options || []).forEach((opt, j) => {
          const letter = ['A', 'B', 'C', 'D'][j];
          const isCorrect = j === q.correct;
          writeWrapped(`${letter}) ${opt}`, 10.5, isCorrect, 16, isCorrect ? PDF_GREEN : null);
        });
        if (q.explanation) writeWrapped(`${t('exam.hint')}: ${q.explanation}`, 9.5, false, 16);
      }
      y += 10;
    });
  } else if (mode === 'blanks') {
    data.forEach((q, i) => {
      writeWrapped(`${i + 1}. ${q.sentence}`, 12, true);
      writeWrapped(`${t('exam.answer')}: ${q.answer}`, 10, true, 16, PDF_GREEN);
      if (q.hint) writeWrapped(`${t('exam.hint')}: ${q.hint}`, 10, false, 16);
      y += 10;
    });
  } else if (mode === 'flashcards') {
    data.forEach((c, i) => {
      writeWrapped(`${i + 1}. ${t('exam.question')}: ${c.front}`, 12, true);
      writeWrapped(`${t('exam.answer')}: ${c.back}`, 10.5, false, 16, PDF_GREEN);
      y += 10;
    });
  } else if (mode === 'slides') {
    data.forEach((s, i) => {
      ensureSpace(2, 18);
      writeWrapped(`${t('exam.slide', { n: i + 1 })} — ${s.title}`, 13, true);
      (s.bullets || []).forEach((b) => writeWrapped(`•  ${b}`, 10.5, false, 16));
      if (s.note) writeWrapped(`Note: ${s.note}`, 9.5, false, 16);
      y += 12;
    });
  } else if (mode === 'mindmap') {
    // Recursive — same shape as the on-screen tree, flattened onto the
    // page as indented headings instead of collapsible rows. Source/quote
    // are left out of the PDF on purpose: this is meant to work as a
    // standalone reference away from the app, and "[quoted passage]" with
    // no way to tap through to it would just read as clutter on paper.
    const writeNode = (node, depth) => {
      ensureSpace(2, 16);
      writeWrapped(node.title, depth === 0 ? 13 : 11, true, depth * 16, depth === 0 ? null : [90, 70, 160]);
      if (node.summary) writeWrapped(node.summary, 9.5, false, depth * 16 + 14);
      (node.children || []).forEach((child) => writeNode(child, depth + 1));
      if (depth === 0) y += 8;
    };
    data.forEach((node) => writeNode(node, 0));
  }

  // Free-tier watermark — a small credit stamped in the corner of every
  // page, gone entirely once premium. Done last so it always lands on
  // top of whatever content ended up on each page, including ones added
  // by ensureSpace() along the way.
  if (!isPremium) {
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text(toPdfSafeText('Made with Nuvora'), pageWidth - marginX, pageHeight - 24, { align: 'right' });
      doc.setTextColor(0, 0, 0);
    }
  }

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`nuvora-${mode}-${stamp}.pdf`);
}

// ── PDF export, Arabic path (html2canvas snapshot) ──────────────
// Renders content off-screen using the browser's own text engine
// (which already shapes Arabic correctly — visible in every screenshot
// in this app), captures it as an image, and slices that image across
// PDF pages. Guarantees visually correct Arabic at the cost of the
// text being an image (not selectable/searchable) — the honest
// tradeoff for not having a font-shaping pipeline available.
async function exportPdfSnapshot(mode, data, t, isRtl, isPremium) {
  const html2canvas = (await import('html2canvas')).default;
  const { jsPDF } = await import('jspdf');

  const heading = {
    mcq: t('exam.mcq'), blanks: t('exam.blanks'), mixed: t('exam.mixed'),
    flashcards: t('exam.flashcards'), slides: t('exam.slides'), mindmap: t('exam.mindmap'),
  }[mode] || mode;

  const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const rows = [];
  rows.push(`<h1 style="font-size:26px;font-weight:800;margin:0 0 24px;color:#1E2233;">${esc(heading)}</h1>`);

  const block = (num, main, extras = []) => `
    <div style="margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #eee;">
      <p style="font-size:15px;font-weight:700;margin:0 0 8px;color:#1E2233;">${num}. ${esc(main)}</p>
      ${extras.map((e) => `<p style="font-size:13px;margin:2px 0;color:${e.color || '#444'};${e.bold ? 'font-weight:700;' : ''}padding-inline-start:20px;">${esc(e.text)}</p>`).join('')}
    </div>`;

  if (mode === 'mcq' || mode === 'mixed') {
    data.forEach((q, i) => {
      if (mode === 'mixed' && q.type === 'blank') {
        rows.push(block(i + 1, q.sentence, [
          { text: `${t('exam.answer')}: ${q.answer}`, color: '#2DA76E', bold: true },
          ...(q.hint ? [{ text: `${t('exam.hint')}: ${q.hint}` }] : []),
        ]));
      } else {
        rows.push(block(i + 1, q.question, [
          ...(q.options || []).map((opt, j) => ({
            text: `${['A','B','C','D'][j]}) ${opt}`,
            color: j === q.correct ? '#2DA76E' : '#444',
            bold: j === q.correct,
          })),
          ...(q.explanation ? [{ text: `💡 ${q.explanation}` }] : []),
        ]));
      }
    });
  } else if (mode === 'blanks') {
    data.forEach((q, i) => rows.push(block(i + 1, q.sentence, [
      { text: `${t('exam.answer')}: ${q.answer}`, color: '#2DA76E', bold: true },
      ...(q.hint ? [{ text: `${t('exam.hint')}: ${q.hint}` }] : []),
    ])));
  } else if (mode === 'flashcards') {
    data.forEach((c, i) => rows.push(block(i + 1, c.front, [
      { text: `${t('exam.answer')}: ${c.back}`, color: '#2DA76E' },
    ])));
  } else if (mode === 'slides') {
    data.forEach((s, i) => rows.push(block(i + 1, s.title, [
      ...(s.bullets || []).map((b) => ({ text: `•  ${b}` })),
      ...(s.note ? [{ text: `📝 ${s.note}` }] : []),
    ])));
  } else if (mode === 'mindmap') {
    // Same "no source/quote clutter on paper" call as the Latin-text
    // export path above — indentation alone (via padding-inline-start)
    // carries the hierarchy here instead of jsPDF's manual x-offset.
    const nodeRows = (node, depth) => {
      rows.push(`
        <div style="margin:${depth === 0 ? '18px 0 6px' : '6px 0'};padding-inline-start:${depth * 22}px;">
          <p style="font-size:${depth === 0 ? 16 : 13}px;font-weight:${depth === 0 ? 800 : 700};margin:0 0 2px;color:${depth === 0 ? '#1E2233' : '#6B5BD6'};">${esc(node.title)}</p>
          ${node.summary ? `<p style="font-size:12px;margin:0;color:#555;line-height:1.5;">${esc(node.summary)}</p>` : ''}
        </div>`);
      (node.children || []).forEach((child) => nodeRows(child, depth + 1));
    };
    data.forEach((node) => nodeRows(node, 0));
  }

  const container = document.createElement('div');
  container.dir = isRtl ? 'rtl' : 'ltr';
  container.style.cssText = `
    position:fixed; top:0; left:-99999px; width:780px;
    background:#ffffff; color:#1E2233; padding:48px;
    font-family:'Segoe UI', Tahoma, Arial, sans-serif;
    text-align:${isRtl ? 'right' : 'left'};
  `;
  container.innerHTML = rows.join('');
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#ffffff' });
    document.body.removeChild(container);

    const pdf = new jsPDF('p', 'pt', 'a4');
    const pageWidth  = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgData   = canvas.toDataURL('image/png');
    const imgWidth  = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // Free-tier watermark, same corner stamp as the text-based PDF path —
    // laid on top of the image content, on every page, gone once premium.
    if (!isPremium) {
      const pageCount = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(8);
        pdf.setTextColor(156, 163, 175);
        pdf.text('Made with Nuvora ✦', pageWidth - 24, pageHeight - 20, { align: 'right' });
      }
    }

    const stamp = new Date().toISOString().slice(0, 10);
    pdf.save(`nuvora-${mode}-${stamp}.pdf`);
  } catch (err) {
    if (container.parentNode) document.body.removeChild(container);
    throw err;
  }
}

// Dispatcher — auto-detects Arabic content and routes to the correct
// export path. Nothing for the user to choose; it just works either way.
async function exportPdf(mode, data, t, lang, isPremium) {
  const arabic = containsArabic(data);
  if (arabic) await exportPdfSnapshot(mode, data, t, true, isPremium);
  else await exportPdfText(mode, data, t, isPremium);
}

// ── PPTX export (pptxgenjs) — real slide-per-item deck. No Arabic
// limitation here: PowerPoint shapes the text itself at render time,
// so this path works correctly for both languages already. ─────
async function exportPptx(mode, data, t, isPremium) {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  const accentHex = getAccentHex();

  const heading = {
    mcq: t('exam.mcq'), blanks: t('exam.blanks'), mixed: t('exam.mixed'),
    flashcards: t('exam.flashcards'), slides: t('exam.slides'), mindmap: t('exam.mindmap'),
  }[mode] || mode;

  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: accentHex };
  titleSlide.addText(heading, {
    x: 0.5, y: 2.2, w: 9, h: 1.2, fontSize: 36, bold: true, color: 'FFFFFF', align: 'center',
  });
  // "Nuvora ✦" branding on the title slide, plus a tiny corner credit on
  // every content slide below — both free-tier only, both gone once premium.
  if (!isPremium) {
    titleSlide.addText('Nuvora ✦', {
      x: 0.5, y: 3.4, w: 9, h: 0.6, fontSize: 16, color: 'FFFFFF', align: 'center',
    });
  }

  const addContentSlide = (titleText, bodyLines) => {
    const slide = pptx.addSlide();
    slide.addText(titleText, {
      x: 0.4, y: 0.3, w: 9.2, h: 0.7, fontSize: 20, bold: true, color: accentHex,
    });
    if (!isPremium) {
      slide.addText('Made with Nuvora ✦', {
        x: 7.6, y: 5.35, w: 2.2, h: 0.25, fontSize: 8, color: '9CA3AF', align: 'right', italic: true,
      });
    }
    // LAYOUT_16x9 is 10 x 5.63in — the old box (y:1.2, h:5.3) ended at
    // 6.5in, past the slide's own bottom edge, so anything that filled
    // it ran off. Now that slide *count* is exact (denser content per
    // slide is expected), shrink the font based on how much text is
    // actually on the slide instead of letting it silently overflow.
    const totalChars = bodyLines.reduce((n, l) => n + (l.text?.length || 0), 0);
    const scale = totalChars > 900 ? 0.70
                : totalChars > 650 ? 0.80
                : totalChars > 450 ? 0.90
                : 1;
    slide.addText(
      bodyLines.map((line) => ({
        text: line.text,
        options: {
          bullet: line.bullet !== false,
          color:  line.color || '333333',
          bold:   !!line.bold,
          fontSize: Math.max(9, Math.round((line.fontSize || 14) * scale)),
        },
      })),
      { x: 0.5, y: 1.1, w: 9, h: 4.3, valign: 'top', lineSpacingMultiple: 1.25, autoFit: true }
    );
  };

  if (mode === 'mcq' || mode === 'mixed') {
    data.forEach((q, i) => {
      if (mode === 'mixed' && q.type === 'blank') {
        addContentSlide(`${i + 1}. ${t('exam.blanks')}`, [
          { text: q.sentence, bullet: false, fontSize: 16 },
          { text: `${t('exam.answer')}: ${q.answer}`, color: '2DA76E', bold: true },
          ...(q.hint ? [{ text: `${t('exam.hint')}: ${q.hint}` }] : []),
        ]);
      } else {
        addContentSlide(`${i + 1}. ${q.question}`, [
          ...(q.options || []).map((opt, j) => ({
            text:  `${['A', 'B', 'C', 'D'][j]}) ${opt}`,
            color: j === q.correct ? '2DA76E' : '333333',
            bold:  j === q.correct,
          })),
          ...(q.explanation ? [{ text: `💡 ${q.explanation}`, fontSize: 12 }] : []),
        ]);
      }
    });
  } else if (mode === 'blanks') {
    data.forEach((q, i) => {
      addContentSlide(`${i + 1}. ${t('exam.blanks')}`, [
        { text: q.sentence, bullet: false, fontSize: 16 },
        { text: `${t('exam.answer')}: ${q.answer}`, color: '2DA76E', bold: true },
        ...(q.hint ? [{ text: `${t('exam.hint')}: ${q.hint}` }] : []),
      ]);
    });
  } else if (mode === 'flashcards') {
    data.forEach((c, i) => {
      addContentSlide(`${i + 1}. ${t('exam.question')}`, [
        { text: c.front, bullet: false, fontSize: 18, bold: true },
        { text: `${t('exam.answer')}: ${c.back}`, color: '2DA76E' },
      ]);
    });
  } else if (mode === 'slides') {
    data.forEach((s, i) => {
      const hasChart = s.chart && Array.isArray(s.chart.labels) && Array.isArray(s.chart.values) && s.chart.labels.length > 0;
      if (hasChart) {
        const slide = pptx.addSlide();
        slide.addText(s.title, {
          x: 0.4, y: 0.3, w: 9.2, h: 0.7, fontSize: 20, bold: true, color: accentHex,
        });
        try {
          // Exact enum accessor differs slightly across pptxgenjs versions —
          // this is wrapped defensively so a chart-API mismatch never breaks
          // the whole export; it just falls back to a plain text list.
          const chartType = s.chart.type === 'pie' ? pptx.ChartType.pie : pptx.ChartType.bar;
          slide.addChart(
            chartType,
            [{ name: s.title, labels: s.chart.labels, values: s.chart.values }],
            {
              x: 0.6, y: 1.1, w: 8.8, h: 3.9,
              showLegend: true, legendPos: 'b', showValue: true,
              chartColors: [accentHex, '7C6AF0', 'FF8A42', 'FF6BA6', '5C9AFF', '2DA76E', 'F5408F', '3B82F6'],
            }
          );
        } catch (err) {
          console.error('pptx chart render failed, falling back to text list', err);
          slide.addText(
            s.chart.labels.map((l, j) => ({
              text: `${l}: ${s.chart.values[j]}`,
              options: { bullet: true, color: '333333', fontSize: 14 },
            })),
            { x: 0.5, y: 1.1, w: 9, h: 3.9, valign: 'top', lineSpacingMultiple: 1.25 }
          );
        }
        if (s.note) {
          slide.addText(`📝 ${s.note}`, {
            x: 0.5, y: 5.05, w: 9, h: 0.5, fontSize: 10, color: '666666',
          });
        }
      } else {
        addContentSlide(s.title, [
          ...(s.bullets || []).map((b) => ({ text: b })),
          ...(s.note ? [{ text: `📝 ${s.note}`, fontSize: 12 }] : []),
        ]);
      }
    });
  } else if (mode === 'mindmap') {
    // One slide per top-level topic — addContentSlide's body is a flat
    // bullet list (no real indent levels in this helper), so hierarchy
    // below the topic itself is conveyed with a "—" prefix + shrinking
    // font per depth rather than true nesting, capped at two levels deep
    // so a slide doesn't get overloaded with grandchildren.
    data.forEach((topic) => {
      const lines = [];
      if (topic.summary) lines.push({ text: topic.summary, bullet: false, fontSize: 13 });
      (topic.children || []).forEach((sub) => {
        lines.push({ text: sub.title, bold: true, color: accentHex, fontSize: 13 });
        if (sub.summary) lines.push({ text: `—  ${sub.summary}`, fontSize: 11 });
        (sub.children || []).forEach((leaf) => {
          lines.push({ text: `—  ${leaf.title}${leaf.summary ? ': ' + leaf.summary : ''}`, fontSize: 10, color: '666666' });
        });
      });
      addContentSlide(topic.title, lines);
    });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  await pptx.writeFile({ fileName: `nuvora-${mode}-${stamp}.pptx` });
}

function MCQQuestion({ q, idx, selected, revealed, onChoose, onReveal, t }) {
  return (
    <div className="p-6" style={cardGlass}>
      <p className="text-xs text-ink/40 dark:text-white/30 mb-2 font-semibold uppercase tracking-widest">
        {t('exam.mcq')} · {t('exam.question', { n: idx + 1 })}
      </p>
      <p className="font-display font-bold text-ink dark:text-white text-base mb-5 leading-snug">
        {q.question}
      </p>
      <div className="flex flex-col gap-2.5 mb-4">
        {/* Real bug that used to live here: a malformed AI-generated quiz
            item missing `options` (rare, but a bad model response is
            always possible) threw on .map() with no guard — and with only
            one ErrorBoundary for the whole app, that crashed everything,
            not just this one question. */}
        {(q.options || []).map((opt, i) => {
          const isSelected = selected === i;
          const isCorrect  = q.correct === i;
          let bg='rgba(255,255,255,0.50)', border='1px solid rgba(255,255,255,0.65)', color='rgba(30,34,51,0.70)';
          if (revealed) {
            if (isCorrect)       { bg='rgba(76,195,138,0.15)';  border='1px solid rgba(76,195,138,0.40)';  color='#2DA76E'; }
            else if (isSelected) { bg='rgba(255,122,99,0.15)';  border='1px solid rgba(255,122,99,0.40)';  color='#FF7A63'; }
          } else if (isSelected) { bg='rgb(var(--accent-500) / 0.12)'; border='1px solid rgb(var(--accent-500) / 0.35)'; color='rgb(var(--accent-600))'; }
          return (
            <button key={i} onClick={() => onChoose(i)}
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-start text-sm font-medium transition-all"
              style={{ background:bg, border, color }}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-bold"
                style={{ background:'rgb(var(--accent-500) / 0.10)', color:'rgb(var(--accent-500))' }}>
                {['A','B','C','D'][i]}
              </span>
              {opt}
              {revealed && isCorrect   && <Check size={15} className="ms-auto text-sage-500 shrink-0"/>}
              {revealed && isSelected && !isCorrect && <X size={15} className="ms-auto text-coral-500 shrink-0"/>}
            </button>
          );
        })}
      </div>
      {revealed && q.explanation && (
        <div className="rounded-2xl px-4 py-3 text-sm text-ink/60 dark:text-white/50 mb-3"
          style={{ background:'rgb(var(--accent-500) / 0.08)', border:'1px solid rgb(var(--accent-500) / 0.15)' }}>
          💡 {q.explanation}
        </div>
      )}
      {selected !== undefined && !revealed && (
        <button onClick={onReveal}
          className="w-full rounded-2xl py-2.5 text-sm font-semibold text-lavender-600"
          style={{ background:'rgb(var(--accent-500) / 0.10)', border:'1px solid rgb(var(--accent-500) / 0.20)' }}>
          {t('exam.checkAnswer')}
        </button>
      )}
    </div>
  );
}

function BlankQuestion({ q, idx, answer, checked, onChange, onCheck, t }) {
  const isCorrect = answer?.trim().toLowerCase() === q.answer?.trim().toLowerCase();
  return (
    <div className="p-6" style={cardGlass}>
      <p className="text-xs text-ink/40 dark:text-white/30 mb-2 font-semibold uppercase tracking-widest">
        {t('exam.blanks')} · {t('exam.question', { n: idx + 1 })}
      </p>
      <p className="font-medium text-ink dark:text-white mb-3 leading-relaxed">
        {q.sentence?.split('___').map((part, j, arr) => (
          <span key={j}>
            {part}
            {j < arr.length-1 && (
              <input value={answer||''} onChange={e => onChange(e.target.value)} disabled={checked}
                className="inline-block mx-1 px-2 py-0.5 rounded-lg text-sm font-semibold outline-none border-b-2 bg-transparent w-32 text-center"
                style={{ borderColor: checked ? (isCorrect?'#4CC38A':'#FF7A63') : 'rgb(var(--accent-500))', color: checked ? (isCorrect?'#2DA76E':'#FF7A63') : 'rgb(var(--accent-500))' }}
                placeholder="___"
              />
            )}
          </span>
        ))}
      </p>
      {q.hint && !checked && <p className="text-xs text-ink/35 mb-3">💡 {t('exam.hint')}: {q.hint}</p>}
      {checked ? (
        <p className={`text-xs font-semibold ${isCorrect?'text-sage-600':'text-coral-500'}`}>
          {isCorrect ? `✓ ${t('exam.correct')}` : `✗ ${t('exam.wrongAnswer', { a: q.answer })}`}
        </p>
      ) : (
        <button onClick={onCheck} disabled={!answer?.trim()}
          className="text-xs font-semibold text-lavender-600 disabled:opacity-40">
          {t('exam.check')} →
        </button>
      )}
    </div>
  );
}

// Ticks down from `minutes` and fires onExpire exactly once when it
// reaches zero — this is what actually makes the quiz duration setting
// do something, instead of just being a label. Deadline is computed once
// from wall-clock time (not decremented tick-by-tick) so it stays correct
// even if the tab is backgrounded and setInterval gets throttled.
function useCountdown(minutes, onExpire) {
  const [remaining, setRemaining] = useState(() => (minutes ? Math.round(minutes * 60) : null));
  const expiredRef = useRef(false);
  useEffect(() => {
    if (!minutes) return;
    const deadline = Date.now() + minutes * 60 * 1000;
    const tick = () => {
      const secs = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setRemaining(secs);
      if (secs <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire?.();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minutes]);
  return remaining;
}

function TimerBadge({ seconds, expiredLabel, t }) {
  if (seconds == null) return null;
  const low = seconds <= 60;
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return (
    <span className="flex items-center gap-1.5 text-xs font-bold rounded-full px-2.5 py-1 shrink-0"
      style={{
        color:      seconds<=0 ? '#FF7A63' : low ? '#E8940A' : 'rgb(var(--ink) / 0.5)',
        background: seconds<=0 ? 'rgba(255,122,99,0.14)' : low ? 'rgba(232,148,10,0.12)' : 'rgb(var(--accent-500) / 0.08)',
      }}>
      <Clock size={12}/> {seconds<=0 ? (expiredLabel || t('exam.timeUp')) : `${mm}:${String(ss).padStart(2,'0')}`}
    </span>
  );
}

function MCQExam({ questions, t, durationMin }) {
  const [current,  setCurrent]  = useState(0);
  const [selected, setSelected] = useState({});
  const [revealed, setRevealed] = useState({});
  const [finished, setFinished] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const remaining = useCountdown(finished ? null : durationMin, () => { setTimedOut(true); setFinished(true); });
  const correct = Object.entries(selected).filter(([i,v]) => v === questions[i].correct).length;
  if (finished) {
    const pct = Math.round((correct/questions.length)*100);
    return (
      <motion.div initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }}
        className="flex flex-col items-center text-center gap-6 py-10">
        <div className="text-7xl">{pct>=80?'🎉':pct>=50?'💪':'📚'}</div>
        <h2 className="font-display text-3xl font-bold text-ink dark:text-white">{pct}%</h2>
        {timedOut && <p className="text-xs font-semibold text-coral-500">{t('exam.timeUpDesc')}</p>}
        <p className="text-ink/50">{t('exam.nCorrect', { c: correct, t: questions.length })}</p>
        <button onClick={() => { setCurrent(0); setSelected({}); setRevealed({}); setFinished(false); setTimedOut(false); }} className="btn-primary flex items-center gap-2">
          <RotateCcw size={15}/> {t('exam.retry')}
        </button>
      </motion.div>
    );
  }
  const q = questions[current];
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-ink/40">{current+1} / {questions.length}</span>
        <TimerBadge seconds={remaining} t={t}/>
        <div className="flex gap-1">
          {questions.map((_,i) => (
            <div key={i} className="h-1.5 w-6 rounded-full"
              style={{ background: i<=current?'rgb(var(--accent-500))':'rgb(var(--accent-500) / 0.15)', opacity: i===current?1:i<current?0.5:0.25 }}/>
          ))}
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={current} initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }} transition={{ duration:0.2 }}>
          <MCQQuestion q={q} idx={current} selected={selected[current]} revealed={!!revealed[current]}
            onChoose={i => !revealed[current] && setSelected(s => ({...s,[current]:i}))}
            onReveal={() => setRevealed(r => ({...r,[current]:true}))}
            t={t}
          />
          {revealed[current] && (
            <button onClick={() => current<questions.length-1 ? setCurrent(c=>c+1) : setFinished(true)}
              className="btn-primary w-full justify-center mt-4">
              {current<questions.length-1 ? `${t('exam.nextQ')} →` : t('exam.seeResults')}
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function FillBlanks({ questions, t, durationMin }) {
  const [answers,  setAnswers]  = useState({});
  const [checked,  setChecked]  = useState({});
  const [finished, setFinished] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const remaining = useCountdown(finished ? null : durationMin, () => { setTimedOut(true); setFinished(true); });
  const correct = Object.entries(checked).filter(([i]) =>
    answers[i]?.trim().toLowerCase() === questions[i].answer?.trim().toLowerCase()).length;
  if (finished) {
    const pct = Math.round((correct/questions.length)*100);
    return (
      <motion.div initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }}
        className="flex flex-col items-center text-center gap-6 py-10">
        <div className="text-7xl">{pct>=80?'🎉':pct>=50?'💪':'📚'}</div>
        <h2 className="font-display text-3xl font-bold text-ink dark:text-white">{pct}%</h2>
        {timedOut && <p className="text-xs font-semibold text-coral-500">{t('exam.timeUpDesc')}</p>}
        <p className="text-ink/50">{t('exam.nCorrect', { c: correct, t: questions.length })}</p>
        <button onClick={() => { setAnswers({}); setChecked({}); setFinished(false); setTimedOut(false); }} className="btn-primary flex items-center gap-2">
          <RotateCcw size={15}/> {t('exam.tryAgain')}
        </button>
      </motion.div>
    );
  }
  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      {durationMin ? <div className="flex justify-end"><TimerBadge seconds={remaining} t={t}/></div> : null}
      {questions.map((q,i) => (
        <BlankQuestion key={i} q={q} idx={i} answer={answers[i]} checked={!!checked[i]}
          onChange={v => setAnswers(a => ({...a,[i]:v}))}
          onCheck={() => setChecked(c => ({...c,[i]:true}))}
          t={t}
        />
      ))}
      <button onClick={() => setFinished(true)} className="btn-primary justify-center mt-2">{t('exam.seeScore')}</button>
    </div>
  );
}

function MixedExam({ questions, t, durationMin }) {
  const [selectedMCQ, setSelectedMCQ] = useState({});
  const [revealedMCQ, setRevealedMCQ] = useState({});
  const [answers,     setAnswers]     = useState({});
  const [checked,     setChecked]     = useState({});
  const [finished,    setFinished]    = useState(false);
  const [timedOut,    setTimedOut]    = useState(false);
  const remaining = useCountdown(finished ? null : durationMin, () => { setTimedOut(true); setFinished(true); });
  const mcqQs   = questions.filter(q => q.type==='mcq');
  const blankQs = questions.filter(q => q.type==='blank');
  const mcqCorrect   = Object.entries(selectedMCQ).filter(([i,v]) => v===mcqQs[i]?.correct).length;
  const blankCorrect = Object.entries(checked).filter(([i]) =>
    answers[i]?.trim().toLowerCase()===blankQs[i]?.answer?.trim().toLowerCase()).length;
  if (finished) {
    const total = questions.length;
    const pct   = Math.round(((mcqCorrect+blankCorrect)/total)*100);
    return (
      <motion.div initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }}
        className="flex flex-col items-center text-center gap-6 py-10">
        <div className="text-7xl">{pct>=80?'🎉':pct>=50?'💪':'📚'}</div>
        <h2 className="font-display text-3xl font-bold text-ink dark:text-white">{pct}%</h2>
        {timedOut && <p className="text-xs font-semibold text-coral-500">{t('exam.timeUpDesc')}</p>}
        <p className="text-ink/50">{t('exam.nCorrect', { c: mcqCorrect+blankCorrect, t: total })}</p>
        <div className="flex gap-4 text-sm">
          <span className="text-lavender-600">{t('exam.mcq')}: {mcqCorrect}/{mcqQs.length}</span>
          <span className="text-blue-500">{t('exam.blanks')}: {blankCorrect}/{blankQs.length}</span>
        </div>
        <button onClick={() => { setSelectedMCQ({}); setRevealedMCQ({}); setAnswers({}); setChecked({}); setFinished(false); setTimedOut(false); }}
          className="btn-primary flex items-center gap-2"><RotateCcw size={15}/> {t('exam.retry')}</button>
      </motion.div>
    );
  }
  let mi=0, bi=0;
  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      {durationMin ? <div className="flex justify-end"><TimerBadge seconds={remaining} t={t}/></div> : null}
      {questions.map((q,i) => {
        if (q.type==='mcq') { const m=mi++;
          return <MCQQuestion key={i} q={q} idx={i} selected={selectedMCQ[m]} revealed={!!revealedMCQ[m]}
            onChoose={v => !revealedMCQ[m] && setSelectedMCQ(s=>({...s,[m]:v}))}
            onReveal={() => setRevealedMCQ(r=>({...r,[m]:true}))}
            t={t}/>;
        } else { const b=bi++;
          return <BlankQuestion key={i} q={q} idx={i} answer={answers[b]} checked={!!checked[b]}
            onChange={v => setAnswers(a=>({...a,[b]:v}))}
            onCheck={() => setChecked(c=>({...c,[b]:true}))}
            t={t}/>;
        }
      })}
      <button onClick={() => setFinished(true)} className="btn-primary justify-center mt-2">{t('exam.seeScore')}</button>
    </div>
  );
}

function Flashcards({ cards, t }) {
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known,   setKnown]   = useState(new Set());
  const [done,    setDone]    = useState(false);
  const next = () => {
    setFlipped(false);
    setTimeout(() => { if (current<cards.length-1) setCurrent(c=>c+1); else setDone(true); }, 150);
  };
  if (done) return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
      className="flex flex-col items-center gap-6 py-10 text-center">
      <div className="text-7xl">🃏</div>
      <h2 className="font-display text-2xl font-bold text-ink dark:text-white">{known.size} / {cards.length} {t('exam.mastered')}</h2>
      <button onClick={() => { setCurrent(0); setFlipped(false); setKnown(new Set()); setDone(false); }}
        className="btn-primary flex items-center gap-2"><RotateCcw size={15}/> {t('exam.reviewAgain')}</button>
    </motion.div>
  );
  return (
    <div className="max-w-lg mx-auto">
      <div className="flex justify-between mb-4 text-xs font-semibold">
        <span className="text-ink/40">{current+1} / {cards.length}</span>
        <span className="text-sage-600">{known.size} {t('exam.mastered')}</span>
      </div>
      <div className="relative h-64 cursor-pointer mb-6" onClick={() => setFlipped(f=>!f)} style={{ perspective:1000 }}>
        <motion.div animate={{ rotateY: flipped?180:0 }} transition={{ duration:0.4, ease:'easeInOut' }}
          className="relative w-full h-full" style={{ transformStyle:'preserve-3d' }}>
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center"
            style={{ ...cardGlass, backfaceVisibility:'hidden' }}>
            <span className="text-xs font-bold uppercase tracking-widest text-lavender-500 mb-4">{t('exam.question')}</span>
            <p className="font-display font-bold text-ink dark:text-white text-lg leading-snug">{cards[current].front}</p>
            <p className="text-xs text-ink/30 mt-4">{t('exam.tapReveal')}</p>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center"
            style={{ ...cardGlass, backfaceVisibility:'hidden', transform:'rotateY(180deg)', background:'rgb(var(--accent-500) / 0.08)', border:'1px solid rgb(var(--accent-500) / 0.20)' }}>
            <span className="text-xs font-bold uppercase tracking-widest text-lavender-500 mb-4">{t('exam.answer')}</span>
            <p className="text-ink dark:text-white leading-relaxed">{cards[current].back}</p>
          </div>
        </motion.div>
      </div>
      <div className="flex gap-3">
        <button onClick={next}
          className="flex-1 rounded-2xl py-3 text-sm font-semibold"
          style={{ background:'rgba(255,122,99,0.12)', border:'1px solid rgba(255,122,99,0.25)', color:'#FF7A63' }}>
          {t('exam.stillLearning')}
        </button>
        <button onClick={() => { setKnown(k=>new Set([...k,current])); next(); }}
          className="flex-1 rounded-2xl py-3 text-sm font-semibold"
          style={{ background:'rgba(76,195,138,0.12)', border:'1px solid rgba(76,195,138,0.25)', color:'#2DA76E' }}>
          ✓ {t('exam.gotIt')}
        </button>
      </div>
      <div className="flex gap-2 justify-center mt-5">
        {cards.map((_,i) => (
          <div key={i} className="h-1.5 w-5 rounded-full transition-all"
            style={{ background: known.has(i)?'#4CC38A':i===current?'rgb(var(--accent-500))':'rgb(var(--accent-500) / 0.15)' }}/>
        ))}
      </div>
    </div>
  );
}

// Lightweight in-app preview for the "chart" a slide can carry instead
// of (or alongside) bullets — plain SVG, no charting library needed,
// just enough to show what the exported PPTX chart will look like.
const CHART_COLORS = ['#7C6AF0','#4CC38A','#FFB84D','#FF7A63','#5C9AFF','#FF6BA6','#E8940A','#2DA76E'];
function MiniChart({ chart }) {
  if (!chart || !Array.isArray(chart.values) || !chart.values.length) return null;
  const { type, labels = [], values } = chart;
  if (type === 'pie') {
    const total = values.reduce((a, b) => a + b, 0) || 1;
    let cumulative = 0;
    const r = 70, cx = 90, cy = 90;
    const slices = values.map((v, i) => {
      const startAngle = (cumulative / total) * 2 * Math.PI;
      cumulative += v;
      const endAngle = (cumulative / total) * 2 * Math.PI;
      const x1 = cx + r * Math.sin(startAngle), y1 = cy - r * Math.cos(startAngle);
      const x2 = cx + r * Math.sin(endAngle),   y2 = cy - r * Math.cos(endAngle);
      const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
      return <path key={i} d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`} fill={CHART_COLORS[i % CHART_COLORS.length]} />;
    });
    return (
      <div className="flex items-center gap-6 flex-wrap">
        <svg width={160} height={160} viewBox="0 0 180 180" className="shrink-0">{slices}</svg>
        <div className="flex flex-col gap-1.5">
          {labels.map((l, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-ink/70 dark:text-white/60">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}/>
              {l}: {values[i]}
            </div>
          ))}
        </div>
      </div>
    );
  }
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-3 h-48 w-full">
      {values.map((v, i) => (
        <div key={i} className="flex flex-col items-center flex-1 gap-1.5 h-full justify-end">
          <span className="text-xs font-bold text-ink/70 dark:text-white/60">{v}</span>
          <div className="w-full rounded-t-lg" style={{ height: `${Math.max(4, (v / max) * 100)}%`, background: 'linear-gradient(180deg, rgb(var(--accent-500)), rgb(var(--accent-600)))' }}/>
          <span className="text-[10px] text-ink/40 dark:text-white/30 text-center truncate w-full">{labels[i] || ''}</span>
        </div>
      ))}
    </div>
  );
}
function SlideDeck({ slides, t }) {
  const [current, setCurrent] = useState(0);
  const slide = slides[current];
  return (
    <div className="max-w-3xl mx-auto">
      <AnimatePresence mode="wait">
        <motion.div key={current}
          initial={{ opacity:0, x:30 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-30 }}
          transition={{ duration:0.22 }}
          className="p-10 min-h-[360px] flex flex-col"
          style={{ ...cardGlass, background:'linear-gradient(145deg,rgba(255,255,255,0.65),rgba(255,255,255,0.45))' }}
        >
          <div className="flex items-center justify-between mb-6">
            <span className="text-xs font-bold uppercase tracking-widest text-lavender-500">
              {t('exam.slide', { n: current + 1 })} / {slides.length}
            </span>
            <div className="flex gap-1">
              {slides.map((_,i) => (
                <button key={i} onClick={() => setCurrent(i)}
                  className="h-1.5 rounded-full transition-all"
                  style={{ width:i===current?24:6, background:i===current?'rgb(var(--accent-500))':'rgb(var(--accent-500) / 0.20)' }}/>
              ))}
            </div>
          </div>
          <h2 className="font-display text-2xl font-bold text-ink dark:text-white mb-6 leading-snug">{slide.title}</h2>
          <div className="flex flex-col gap-3 flex-1">
            {slide.chart ? (
              <MiniChart chart={slide.chart} />
            ) : (
              slide.bullets?.map((b,i) => (
                <motion.div key={i} initial={{ opacity:0, x:10 }} animate={{ opacity:1, x:0 }} transition={{ delay:i*0.06 }}
                  className="flex items-start gap-3">
                  <div className="mt-1.5 h-2 w-2 rounded-full bg-lavender-400 shrink-0"/>
                  <p className="text-sm text-ink/75 dark:text-white/65 leading-relaxed">{b}</p>
                </motion.div>
              ))
            )}
          </div>
          {slide.note && (
            <div className="mt-6 pt-4" style={{ borderTop:'1px solid rgba(30,34,51,0.08)' }}>
              <p className="text-xs text-ink/35 italic">📝 {slide.note}</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      <div className="flex items-center justify-between mt-4">
        <button onClick={() => setCurrent(c=>Math.max(0,c-1))} disabled={current===0}
          className="flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold disabled:opacity-30" style={glass}>
          <ChevronLeft size={16} className="rtl:rotate-180"/> {t('exam.prev')}
        </button>
        <span className="text-xs text-ink/40">{current+1} {t('exam.of')} {slides.length}</span>
        <button onClick={() => setCurrent(c=>Math.min(slides.length-1,c+1))} disabled={current===slides.length-1}
          className="flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold disabled:opacity-30" style={glass}>
          {t('exam.next')} <ChevronRight size={16} className="rtl:rotate-180"/>
        </button>
      </div>
    </div>
  );
}

// ── Concept Map — expandable tree instead of a literal node-graph
// canvas. A real connected-boxes-and-lines flowchart needs a graph
// library (none installed here) and is genuinely rough to pan/zoom on a
// phone — an accordion-style tree gets the same "explore topic →
// subtopic → detail" structure NotebookLM's mind map has, using nothing
// but what's already in this app, and works cleanly on mobile. What IS
// borrowed directly from NotebookLM's look: each top-level topic gets
// its own distinct color that carries down through its whole branch —
// that color-per-branch identity is the single most recognizable part
// of its mind map, and translates cleanly to a tree with zero new
// dependencies (just a color prop threaded through recursion).
const MINDMAP_BRANCH_COLORS = [
  { dot: '#7C6AF0', bg: 'rgba(124,106,240,0.10)', border: 'rgba(124,106,240,0.28)' },
  { dot: '#FF8A42', bg: 'rgba(255,138,66,0.10)',  border: 'rgba(255,138,66,0.28)'  },
  { dot: '#2DA76E', bg: 'rgba(76,195,138,0.10)',  border: 'rgba(76,195,138,0.28)'  },
  { dot: '#5C9AFF', bg: 'rgba(92,154,255,0.10)',  border: 'rgba(92,154,255,0.28)'  },
  { dot: '#F5408F', bg: 'rgba(245,64,143,0.10)',  border: 'rgba(245,64,143,0.28)'  },
  { dot: '#E0932A', bg: 'rgba(255,184,77,0.10)',  border: 'rgba(255,184,77,0.28)'  },
];
function MindMapNode({ node, depth, branchColor, onAskLumi, onViewSource, t }) {
  const [open, setOpen] = useState(depth === 0);
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const hasDetail = !!(node.summary || node.quote || node.source);
  return (
    <div className={depth > 0 ? 'ps-4' : ''} style={depth > 0 ? { borderInlineStart: `2px solid ${branchColor.border}` } : undefined}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-start transition-all hover:bg-white/5"
      >
        {(hasChildren || hasDetail)
          ? (open
              ? <ChevronDown size={13} className="shrink-0" style={{ color: branchColor.dot }}/>
              : <ChevronRight size={13} className="shrink-0 rtl:rotate-180" style={{ color: branchColor.dot }}/>)
          : <span className="h-1.5 w-1.5 rounded-full shrink-0 mx-[3.5px]" style={{ background: branchColor.dot }}/>}
        <span className={depth === 0
          ? 'text-sm font-bold'
          : 'text-sm font-semibold text-ink/75 dark:text-white/70'}
          style={depth === 0 ? { color: branchColor.dot } : undefined}>
          {node.title}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (hasChildren || hasDetail) && (
          <motion.div
            initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }}
            transition={{ duration:0.18 }}
            className="overflow-hidden"
          >
            <div className="ps-9 pe-2 mb-2 mt-0.5 flex flex-col gap-2">
              {node.summary && (
                <p className="text-xs text-ink/55 dark:text-white/50 leading-relaxed">{node.summary}</p>
              )}
              {(node.source || node.quote) && (
                <button type="button" onClick={() => onViewSource(node)}
                  className="self-start flex items-center gap-1 text-[10px] font-semibold text-lavender-500 hover:underline">
                  <FileText size={10}/> {node.source || t('exam.pastedNotes')}
                </button>
              )}
              <button type="button" onClick={() => onAskLumi(node)}
                className="self-start flex items-center gap-1 text-[10px] font-semibold text-lavender-500 hover:underline">
                <Sparkles size={10}/> {t('exam.askLumiMore')}
              </button>
              {hasChildren && (
                <div className="flex flex-col gap-1 mt-1">
                  {node.children.map((child, i) => (
                    <MindMapNode key={i} node={child} depth={depth + 1} branchColor={branchColor} onAskLumi={onAskLumi} onViewSource={onViewSource} t={t}/>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
function MindMap({ tree, onAskLumi, onViewSource, t }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1 text-ink/40 dark:text-white/35">
        <Network size={13}/>
        <span className="text-[11px] font-semibold uppercase tracking-wide">{t('exam.mindmap')}</span>
      </div>
      {tree.map((node, i) => {
        const branchColor = MINDMAP_BRANCH_COLORS[i % MINDMAP_BRANCH_COLORS.length];
        return (
          <div key={i} className="rounded-3xl p-3" style={{ background: branchColor.bg, border: `1px solid ${branchColor.border}` }}>
            <MindMapNode node={node} depth={0} branchColor={branchColor} onAskLumi={onAskLumi} onViewSource={onViewSource} t={t}/>
          </div>
        );
      })}
    </div>
  );
}

// "Takes you to where it exists in your files" — honestly scoped to
// what's actually stored: the original PDF/PPTX/DOCX isn't kept or
// rendered anywhere, only its extracted text (see /exam/extract), so
// there's no real page/position to jump to. What this CAN do faithfully
// is show that exact extracted text with the model's own verbatim quote
// highlighted in place — the real passage the node was grounded in, not
// a paraphrase.
function SourceViewerModal({ node, files, notes, onClose, t }) {
  const file  = node.source ? files.find(f => f.name === node.source) : null;
  const text  = file ? file.text : notes;
  const quote = (node.quote || '').trim();
  const idx   = quote ? text.indexOf(quote) : -1;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background:'rgba(7,11,20,0.75)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)' }}
      onClick={onClose}>
      <div className="w-full max-w-lg max-h-[80vh] rounded-3xl p-6 flex flex-col gap-3"
        style={{ background:'rgba(24,20,40,0.97)', border:'1px solid rgba(255,255,255,0.12)' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-white flex items-center gap-2 min-w-0">
            <FileText size={14} className="shrink-0"/> <span className="truncate">{node.source || t('exam.pastedNotes')}</span>
          </p>
          <button onClick={onClose} className="text-white/40 hover:text-white shrink-0"><X size={18}/></button>
        </div>
        {!text?.trim() ? (
          <p className="text-xs text-white/40">{t('exam.sourceNotAvailable')}</p>
        ) : (
          <div className="overflow-y-auto text-xs text-white/55 leading-relaxed whitespace-pre-wrap" style={{ maxHeight:'55vh' }}>
            {idx === -1 ? text : (
              <>
                {text.slice(0, idx)}
                <mark style={{ background:'rgba(168,85,247,0.35)', color:'white', borderRadius:4, padding:'0 2px' }}>{quote}</mark>
                {text.slice(idx + quote.length)}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ExamAssistant() {
  const toast = useToast();
  const { t, lang } = useLanguage();
  const { isPremium } = useTheme();

  const MODES = [
    { key:'mcq',        label:t('exam.mcq'),        icon:'🔵', desc:t('exam.mcqDesc')        },
    { key:'blanks',     label:t('exam.blanks'),     icon:'✏️', desc:t('exam.blanksDesc')     },
    { key:'mixed',      label:t('exam.mixed'),      icon:'🎯', desc:t('exam.mixedDesc')      },
    { key:'flashcards', label:t('exam.flashcards'), icon:'🃏', desc:t('exam.flashDesc')      },
    { key:'slides',     label:t('exam.slides'),     icon:'🖥️', desc:t('exam.slidesDesc')    },
    { key:'mindmap',    label:t('exam.mindmap'),    icon:'🗺️', desc:t('exam.mindmapDesc')   },
    { key:'chat',       label:t('exam.studyChat'),  icon:'💬', desc:t('exam.studyChatDesc') },
  ];
  const DIFFICULTIES = [
    { key:'easy',   label:t('exam.easy'),   color:'#4CC38A' },
    { key:'medium', label:t('exam.medium'), color:'#FFB84D' },
    { key:'hard',   label:t('exam.hard'),   color:'#FF7A63' },
  ];

  const [mode,          setMode]          = useState('mcq');
  const [difficulty,    setDifficulty]    = useState('medium');
  const [count,         setCount]         = useState(10);
  const [duration,      setDuration]      = useState(15);
  const [notes,         setNotes]         = useState('');
  // Multiple source files, each independently extracted server-side —
  // { id, name, text, wordCount }. Combined with notes at generation time
  // (see combinedContent below) instead of one replacing the other.
  const [files,         setFiles]         = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [genElapsed,    setGenElapsed]    = useState(0);
  const [uploading,     setUploading]     = useState(false);
  const [result,        setResult]        = useState(null);
  const [showFileInfo,  setShowFileInfo]  = useState(false);
  const [sessions,      setSessions]      = useState([]);
  const [sessionBusy,   setSessionBusy]   = useState(null);
  const [exporting,     setExporting]     = useState(null);
  const [stylePref,     setStylePref]     = useState('');
  const [stylePrefSaved,setStylePrefSaved]= useState('');
  // Study Chat — separate from the generate-a-quiz flow above, so its own
  // state instead of reusing `result` (which is shaped for the quiz/
  // flashcard/slide viewer, not a running conversation).
  const [chatMessages,  setChatMessages]  = useState([]);
  const [chatInput,     setChatInput]     = useState('');
  const [chatLoading,   setChatLoading]   = useState(false);
  // Deep Search — when on, Study Chat is allowed to answer beyond the
  // uploaded material using real web search + the model's own knowledge,
  // instead of the default strictly-grounded-only behavior. Gated
  // server-side on the same 'deep_search' daily limit Lumi's main chat
  // uses (tight for free accounts, unlimited premium) — off by default
  // since exam prep usually wants strictly-grounded answers, not the web.
  const [deepSearchOn,  setDeepSearchOn]  = useState(false);
  // Which saved exam_sessions row (if any) the current view is linked to —
  // null means "nothing saved yet" (a chat not sent a first message yet,
  // or content not yet generated). Set after a fresh save/generate, or on
  // reopening a Past Session. Chat messages get PATCHed onto this same id
  // instead of creating a new session each turn, which is what keeps a
  // Concept Map's "Ask Lumi more" conversation attached to that map's own
  // history entry rather than spawning an unrelated one.
  const [currentSessionId, setCurrentSessionId] = useState(null);
  // Concept Map — which node's "view in source" modal is open, if any.
  const [sourceViewNode, setSourceViewNode] = useState(null);
  const fileRef = useRef(null);
  const chatEndRef = useRef(null);

  const BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:4000'
    : 'https://lifeos-0l81.onrender.com';

  const authedFetch = useCallback((path, opts = {}) => fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers: {
      ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type':'application/json' } : {}),
      Authorization: `Bearer ${getToken()}`,
      ...(opts.headers || {}),
    },
  }), [BASE_URL]);

  // Slide style preference — a one-time freeform note ("lots of charts,
  // minimal text" / "just clean bullets, no fluff") that Lumi reads
  // into every future slide generation instead of using one fixed
  // layout for everyone. Loaded once on mount, saved on blur.
  useEffect(() => {
    authedFetch('/api/exam/style-pref').then(r => r.json()).then(d => {
      setStylePref(d.style_pref || '');
      setStylePrefSaved(d.style_pref || '');
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const saveStylePref = async () => {
    if (stylePref === stylePrefSaved) return;
    try {
      await authedFetch('/api/exam/style-pref', { method:'PUT', body: JSON.stringify({ style_pref: stylePref }) });
      setStylePrefSaved(stylePref);
    } catch (_) {}
  };

  // Big slide decks can genuinely take longer than the old flat "15-30s"
  // promised (especially now that generation has real headroom instead
  // of getting cut off) — a static estimate that turns out wrong just
  // makes people think it's frozen and refresh, killing the request
  // mid-flight. A live "Xs elapsed" counter shows it's actually working.
  useEffect(() => {
    if (!loading) { setGenElapsed(0); return; }
    setGenElapsed(0);
    const id = setInterval(() => setGenElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [loading]);

  // Refreshing mid-generation loses the request entirely (no way to
  // resume), so warn before an accidental close/reload while one is
  // in flight — browsers show their own generic confirmation text,
  // custom messages aren't supported, but the prompt itself is enough.
  useEffect(() => {
    if (!loading) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [loading]);

  const loadSessions = useCallback(async () => {
    try {
      const res  = await authedFetch('/api/exam/sessions');
      const data = await res.json();
      if (res.ok && Array.isArray(data)) setSessions(data);
    } catch (_) {}
  }, [authedFetch]);
  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Returns the new session's id (or null on failure) so callers can link
  // follow-up chat messages to this exact row via currentSessionId.
  const saveSession = async (sessionMode, sessionDifficulty, items, sourceName, sourceContent) => {
    try {
      const res = await authedFetch('/api/exam/sessions', {
        method: 'POST',
        body: JSON.stringify({ mode:sessionMode, difficulty:sessionDifficulty, items, sourceName, sourceContent }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) { loadSessions(); return data?.id ?? null; }
    } catch (_) {}
    return null;
  };
  const openSession = async (session) => {
    setSessionBusy(session.id);
    try {
      const res  = await authedFetch(`/api/exam/sessions/${session.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not open session');
      setDifficulty(data.difficulty || 'medium');
      setCurrentSessionId(data.id);
      // Restore the original source material when this session has it
      // saved, so Study Chat / "Ask Lumi more" can ground answers in it
      // again — sessions saved before this feature (or with no source,
      // e.g. very old rows) simply won't have this, same limitation as
      // before, just narrower.
      if (data.source_content) {
        setFiles([]);
        setNotes(data.source_content);
      }
      setChatMessages(Array.isArray(data.chat_messages) ? data.chat_messages : []);
      if (data.mode === 'chat') {
        // A standalone Study Chat session — there's no generated
        // "result" to show, just the restored conversation itself.
        setResult(null);
        setMode('chat');
      } else {
        setResult({ mode: data.mode, data: data.items });
      }
    } catch (err) { toast.error(err.message); }
    finally { setSessionBusy(null); }
  };
  const removeSession = async (e, id) => {
    e.stopPropagation();
    setSessionBusy(id);
    try {
      const res = await authedFetch(`/api/exam/sessions/${id}`, { method:'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error('Delete failed');
      setSessions(s => s.filter(x => x.id !== id));
    } catch (err) { toast.error(err.message); }
    finally { setSessionBusy(null); }
  };

  const MAX_FILES = 6;
  // Uploads and extracts each file independently (the server only ever
  // handles one file per /extract call) and appends results to `files` as
  // each one finishes, so a slow/large file doesn't block the others and
  // partial progress isn't lost if one fails.
  const handleFiles = useCallback(async (fileList) => {
    const incoming = Array.from(fileList || []).filter(Boolean);
    if (!incoming.length) return;
    if (files.length + incoming.length > MAX_FILES) {
      toast.error(t('exam.tooManyFiles', { n: MAX_FILES }));
      return;
    }
    setUploading(true);
    for (const file of incoming) {
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        toast.error(`${file.name}: ${t('exam.tooLarge', { n: MAX_SIZE_MB })}`);
        continue;
      }
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await authedFetch('/api/exam/extract', { method:'POST', body:formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        const id = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
        setFiles(prev => [...prev, { id, name: file.name, text: data.text, wordCount: data.wordCount }]);
        toast.success(`✓ ${file.name} — ${data.wordCount?.toLocaleString()} ${t('exam.wordsReady')}`);
      } catch (err) {
        toast.error(`${file.name}: ${err.message}`);
      }
    }
    setUploading(false);
  }, [toast, authedFetch, t, files.length]);
  const onDrop = (e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); };
  const removeFile = (id) => setFiles(prev => prev.filter(f => f.id !== id));

  // Notes plus every uploaded file's extracted text, combined into one
  // source blob — each file is labeled so the model can tell them apart
  // instead of them running together as one undifferentiated wall of text.
  const combinedContent = [
    notes.trim(),
    ...files.map(f => `[${f.name}]\n${f.text}`),
  ].filter(Boolean).join('\n\n---\n\n');

  const generate = async () => {
    const content = combinedContent;
    if (!content.trim()) { toast.error(t('exam.addFirst')); return; }
    setLoading(true);
    setResult(null);
    // A fresh generation always becomes its own new session once saved
    // below — clear any id/chat left over from whatever was open before,
    // so a stray "Ask Lumi more" mid-generation can't attach to the wrong
    // (old) session.
    setCurrentSessionId(null);
    setChatMessages([]);
    let prompt = '';
    // Concrete criteria per level — "hard" was previously just a bare
    // adjective the model got zero guidance on, so it defaulted to
    // whatever it considered normal (which read as "easy" regardless of
    // the selected level). Also used for flashcards now, which
    // previously ignored the difficulty setting entirely.
    const DIFFICULTY_RUBRIC = {
      easy:   'DIFFICULTY — EASY: Test direct recall of facts, terms, and definitions stated explicitly in the content. The correct answer should be clear to anyone who read the material once. Wrong options must be clearly, obviously wrong — no close calls.',
      medium: 'DIFFICULTY — MEDIUM: Require connecting two related ideas from the content, or applying a definition to a straightforward example. Wrong options should be plausible but distinguishable with solid understanding of the material.',
      hard:   "DIFFICULTY — HARD: Require multi-step reasoning or synthesizing multiple parts of the content — not something answerable by skimming or matching keywords. Apply concepts to a scenario that isn't stated verbatim in the material. Wrong options must be genuinely plausible: common misconceptions, near-misses, or subtly incorrect in a way that requires real understanding to rule out.",
    };
    const difficultyLine = DIFFICULTY_RUBRIC[difficulty] || DIFFICULTY_RUBRIC.medium;
    // Regenerating from the same source material was producing near-
    // identical output — no sampling randomness was set server-side, and
    // nothing in the prompt signaled "this is a fresh attempt, don't just
    // repeat the obvious first-appearing facts every time." This nonce +
    // instruction line fixes both: it breaks any exact-prompt caching and
    // gives the model an explicit reason to vary its choices.
    const varietyTag = `VARIETY: This may be a repeat generation from the same material (variation token: ${Math.random().toString(36).slice(2, 8)}) — choose different specific facts, angles, and phrasing than an obvious first pass would, and don't default to only the first-appearing concepts.`;
    const base = `CRITICAL RULES:
- Return ONLY a valid JSON array. No markdown, no explanation, no text before or after.
- Cover ALL topics in the content. Do not skip any concept.
- The content to study is at the end of this message.
${varietyTag}
`;
    if (mode === 'mcq') {
      prompt = `${base}${difficultyLine}
Generate a ${difficulty} multiple choice exam with exactly ${count} questions.
Each object: { "question": string, "options": [4 strings], "correct": 0-indexed number, "explanation": string }
Content:\n${content}`;
    } else if (mode === 'blanks') {
      prompt = `${base}${difficultyLine}
Generate a ${difficulty} fill-in-the-blank exercise with exactly ${count} questions.
Each object: { "sentence": "text with ___ blank", "answer": string, "hint": string }
Content:\n${content}`;
    } else if (mode === 'mixed') {
      const half = Math.ceil(count/2);
      prompt = `${base}${difficultyLine}
Generate a ${difficulty} mixed exam: ${half} MCQ and ${count-half} fill-in-the-blank questions. Interleave them.
MCQ object:   { "type": "mcq",   "question": string, "options": [4 strings], "correct": number, "explanation": string }
Blank object: { "type": "blank", "sentence": "text with ___", "answer": string, "hint": string }
Content:\n${content}`;
    } else if (mode === 'flashcards') {
      prompt = `${base}${difficultyLine}
Generate exactly ${count} ${difficulty} flashcards. Every important concept, term, formula must appear.
Each object: { "front": string, "back": string }
Content:\n${content}`;
    } else if (mode === 'slides') {
      const styleLine = stylePref.trim()
        ? `\nThe person you're building this for has described how they like slides presented: "${stylePref.trim()}". Follow that preference — e.g. if they want visuals/charts, look for slides whose content is numeric/comparative (stats, percentages, before/after, rankings) and give those a "chart" instead of bullets; if they want icons, prefix bullets with a fitting emoji; if they want minimal/text-only, skip charts and emoji entirely. Don't force a chart onto content that isn't actually numeric.`
        : '';
      prompt = `${base}Create a slide deck with EXACTLY ${count} slides — not fewer, not more. Combine related points onto the same slide so all the content below is covered within exactly ${count} slides; do not create extra slides even if that means more bullets per slide.
Keep bullets concise (short phrases, not paragraphs) so the response fits in one reply.${styleLine}
Each object: { "title": string, "bullets": [short strings] or [] if using a chart, "note": string or null, "chart": null or { "type": "bar" or "pie", "labels": [string], "values": [number] } }
Content:\n${content}`;
    } else if (mode === 'mindmap') {
      // Doubles as the downloadable reference/"syllabus" export, so this
      // needs to be genuinely comprehensive, not just the highlights —
      // same "don't skip anything" bar as the exam modes above.
      prompt = `${base}Build a concept map of ALL the material below as a nested JSON tree — this is meant to work as a study reference on its own, so don't skip any topic.
Structure: 4-6 top-level topics that cover the whole content, each with 2-4 subtopic children, and subtopics may have 0-2 of their own children for finer detail. Keep it efficient — this needs to come back fast, so don't overthink individual nodes. Every node uses this exact shape:
{ "title": string (short, 2-6 words), "summary": string (1-2 plain sentences explaining this node on its own, understandable without reading anything else), "source": string (the exact filename this came from, copied verbatim from the "[filename]" tag above that part of the content below — or "" if it came from the pasted notes instead of an uploaded file), "quote": string (a short phrase lifted from the content below near where this node's idea appears — close is fine, doesn't need to be a perfect character-for-character match), "children": [nodes in this same shape] or [] }
Return a JSON ARRAY of the top-level topic nodes only (their "children" arrays hold the rest).
Content:\n${content}`;
    }
    try {
      const res = await authedFetch('/api/exam/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      let parsed = [];
      try {
        const clean = data.text.replace(/```json|```/g,'').trim();
        parsed = JSON.parse(clean);
      } catch (_) {
        const match = data.text.match(/\[[\s\S]*\]/);
        if (match) parsed = JSON.parse(match[0]);
        else throw new Error('Invalid response format — try again');
      }
      if (!Array.isArray(parsed) || !parsed.length) throw new Error('Empty result — try again');
      // Carry the duration picked at generation time into the result so the
      // quiz runner can actually enforce it — reopened past sessions (via
      // openSession) don't have a stored duration, so they run untimed.
      setResult({ mode, data: parsed, durationMin: (mode==='mcq'||mode==='blanks'||mode==='mixed') ? duration : null });
      const label = mode==='slides'
        ? t('exam.minSlides', { n: parsed.length })
        : mode==='flashcards'
        ? t('exam.cards', { n: parsed.length })
        : t('exam.questions', { n: parsed.length });
      toast.success(`${label} ✓`);
      const newId = await saveSession(mode, difficulty, parsed, files.length
        ? files.map(f => f.name).join(', ')
        : notes.slice(0, 60), content);
      if (newId) setCurrentSessionId(newId);
    } catch (err) {
      toast.error(err.message || 'Generation failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // Study Chat — grounded Q&A over combinedContent (same source the quiz/
  // slide modes above use). No `result` involved; it's its own running
  // transcript instead of a one-shot generation.
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  // `override` lets a caller (the concept map's "Ask Lumi more" button)
  // send a specific question straight through, bypassing whatever's
  // currently sitting in the input box — setChatInput + immediately
  // reading chatInput wouldn't work here since the set is async and
  // wouldn't be visible yet on this same call.
  const sendChatMessage = async (override) => {
    const question = (override ?? chatInput).trim();
    if (!question || chatLoading) return;
    if (!combinedContent.trim()) { toast.error(t('exam.addFirst')); return; }
    const nextMessages = [...chatMessages, { role: 'user', content: question }];
    setChatMessages(nextMessages);
    if (override === undefined) setChatInput('');
    setChatLoading(true);
    try {
      const res = await authedFetch('/api/exam/chat', {
        method: 'POST',
        body: JSON.stringify({
          content:  combinedContent,
          question,
          // Everything except the message we just added — the server
          // appends the new question itself.
          history: nextMessages.slice(0, -1).slice(-8),
          deepSearch: deepSearchOn,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chat failed');
      const finalMessages = [...nextMessages, { role: 'assistant', content: data.answer, deepSearch: !!data.deepSearch }];
      setChatMessages(finalMessages);
      persistChat(finalMessages);
    } catch (err) {
      toast.error(err.message || 'Something went wrong — try again.');
    } finally {
      setChatLoading(false);
    }
  };

  // Saves the running chat transcript against whatever session it belongs
  // to. If `currentSessionId` is already set — a concept map (or any other
  // generated result) this chat branched off of via "Ask Lumi more", or a
  // standalone chat already saved once before — this PATCHes that exact
  // row, which is what keeps the conversation attached to the map it was
  // built for instead of scattering into a new, unrelated Past Sessions
  // entry. Only when there's no session yet (a brand-new standalone Study
  // Chat, first message) does this create one, via POST /sessions/chat.
  // Fire-and-forget like saveSession above — a failed save here shouldn't
  // interrupt the conversation the person is actually having.
  const persistChat = async (messages) => {
    try {
      if (currentSessionId) {
        await authedFetch(`/api/exam/sessions/${currentSessionId}/chat`, {
          method: 'PATCH',
          body: JSON.stringify({ chatMessages: messages }),
        });
      } else {
        const res = await authedFetch('/api/exam/sessions/chat', {
          method: 'POST',
          body: JSON.stringify({
            sourceName: files.length ? files.map(f => f.name).join(', ') : notes.slice(0, 60),
            sourceContent: combinedContent,
            chatMessages: messages,
          }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.id) { setCurrentSessionId(data.id); loadSessions(); }
      }
    } catch (_) {}
  };

  // Concept map node → Study Chat. The node's own `summary` is already a
  // free, instant explanation shown right in the tree — this is for
  // going deeper, so it leaves the generated quiz/deck view entirely and
  // drops into an actual conversation about it (same source material,
  // still grounded, now able to follow up).
  //
  // Real bug this fixes: a concept map reopened from History (see
  // openSession above) only restores `result` — the saved sessions table
  // never stored the original files/notes, just the generated tree — so
  // `combinedContent` is empty for any map opened that way. Clicking
  // "Ask Lumi more" used to switch to chat mode and fire off a question
  // anyway, landing on the empty Study Chat screen with a generic "Add
  // notes or upload a file first" toast that gave no hint this was a
  // history/reopened-session thing rather than something the person
  // forgot to do. Checking up front, before ever leaving the concept
  // map, keeps the person right where their material still exists.
  const askLumiAboutNode = (node) => {
    if (!combinedContent.trim()) {
      toast.error(t('exam.historyNoSource'));
      return;
    }
    setResult(null);
    setMode('chat');
    sendChatMessage(t('exam.explainMore', { topic: node.title }));
  };

  const handleExport = async (format) => {
    if (!result) return;
    setExporting(format);
    // Arabic PDFs render via a browser screenshot (see exportPdfSnapshot)
    // instead of instant native text — genuinely takes a few seconds.
    // Give an explicit heads-up so it doesn't read as hung.
    if (format === 'pdf' && containsArabic(result.data)) {
      toast.success(
        lang === 'ar'
          ? '⏳ جارٍ تجهيز نسخة PDF بالعربية — قد يستغرق بضع ثوانٍ، لا تُحدّث الصفحة'
          : '⏳ Preparing the Arabic PDF — this takes a few seconds, no need to refresh'
      );
    }
    try {
      if (format === 'pdf') await exportPdf(result.mode, result.data, t, lang, isPremium);
      else await exportPptx(result.mode, result.data, t, isPremium);
    } catch (err) {
      console.error(err);
      toast.error(
        lang === 'ar'
          ? 'فشل التصدير — تأكد من تثبيت الحزم المطلوبة (jspdf, pptxgenjs, html2canvas)'
          : 'Export failed — make sure jspdf, pptxgenjs, and html2canvas are installed'
      );
    } finally {
      setExporting(null);
    }
  };

  const wordCount  = combinedContent.split(/\s+/).filter(Boolean).length;
  const hasContent = !!combinedContent.trim();

  return (
    <div>
      <PageHeader
        eyebrow={t('exam.eyebrow')}
        title={t('exam.title')}
        subtitle={t('exam.subtitle')}
      />
      {!result ? (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 flex flex-col gap-4">
            <div className="rounded-3xl p-5" style={glass}>
              <p className="text-xs font-bold uppercase tracking-widest text-ink/40 mb-3">{t('exam.studyType')}</p>
              <div className="flex flex-col gap-2">
                {MODES.map(m => (
                  <button key={m.key} onClick={() => setMode(m.key)}
                    className="flex items-start gap-3 rounded-2xl px-4 py-3 text-start transition-all"
                    style={mode===m.key
                      ? { background:'rgb(var(--accent-500) / 0.12)', border:'1px solid rgb(var(--accent-500) / 0.30)' }
                      : { background:'rgba(255,255,255,0.40)', border:'1px solid rgba(255,255,255,0.50)' }}>
                    <span className="text-xl shrink-0">{m.icon}</span>
                    <div>
                      <p className={`text-sm font-semibold ${mode===m.key?'text-lavender-700 dark:text-lavender-300':'text-ink/70 dark:text-white/60'}`}>
                        {m.label}
                      </p>
                      <p className="text-[11px] text-ink/40 mt-0.5">{m.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            {mode !== 'slides' && mode !== 'chat' && mode !== 'mindmap' && (
              <div className="rounded-3xl p-5" style={glass}>
                <p className="text-xs font-bold uppercase tracking-widest text-ink/40 mb-3">{t('exam.difficulty')}</p>
                <div className="flex gap-2">
                  {DIFFICULTIES.map(d => (
                    <button key={d.key} onClick={() => setDifficulty(d.key)}
                      className="flex-1 rounded-2xl py-2 text-xs font-bold transition-all"
                      style={difficulty===d.key
                        ? { background:`${d.color}20`, border:`1px solid ${d.color}50`, color:d.color }
                        : { background:'rgba(255,255,255,0.40)', border:'1px solid rgba(255,255,255,0.50)', color:'rgba(30,34,51,0.45)' }}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {mode !== 'chat' && mode !== 'mindmap' && (
            <div className="rounded-3xl p-5" style={glass}>
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-widest text-ink/40 mb-2">
                  {mode==='slides'
                    ? t('exam.minSlides', { n: count })
                    : mode==='flashcards'
                    ? t('exam.cards', { n: count })
                    : t('exam.questions', { n: count })}
                </p>
                <input type="range" min={5} max={30} value={count}
                  onChange={e => setCount(Number(e.target.value))}
                  className="w-full accent-lavender-600"/>
                <div className="flex justify-between text-[10px] text-ink/30 mt-1"><span>5</span><span>30</span></div>
              </div>
              {(mode==='mcq'||mode==='blanks'||mode==='mixed') && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-ink/40 mb-2">
                    {t('exam.duration', { n: duration })}
                  </p>
                  <input type="range" min={5} max={120} step={5} value={duration}
                    onChange={e => setDuration(Number(e.target.value))}
                    className="w-full accent-lavender-600"/>
                  <div className="flex justify-between text-[10px] text-ink/30 mt-1"><span>5 min</span><span>2 hr</span></div>
                </div>
              )}
              {mode==='slides' && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-ink/40 mb-2">
                    {t('exam.slideStyle')}
                  </p>
                  <textarea
                    className="input-field text-xs"
                    rows={2}
                    placeholder={t('exam.slideStylePh')}
                    value={stylePref}
                    onChange={e => setStylePref(e.target.value)}
                    onBlur={saveStylePref}
                  />
                  <p className="text-[10px] text-ink/30 mt-1">{t('exam.slideStyleNote')}</p>
                </div>
              )}
            </div>
            )}
            <button onClick={() => setShowFileInfo(s=>!s)}
              className="flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-semibold text-lavender-600 transition-all text-start"
              style={{ background:'rgb(var(--accent-500) / 0.06)', border:'1px solid rgb(var(--accent-500) / 0.15)' }}>
              <Info size={14}/> {t('exam.fileInfo')}
            </button>
            <AnimatePresence>
              {showFileInfo && (
                <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
                  className="overflow-hidden rounded-3xl"
                  style={{ background:'rgb(var(--accent-500) / 0.06)', border:'1px solid rgb(var(--accent-500) / 0.15)' }}>
                  <div className="p-4 flex flex-col gap-2">
                    {FILE_TYPES.map(ft => (
                      <div key={ft.ext} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2">
                          <span>{ft.icon}</span>
                          <span className="font-bold text-ink/70 dark:text-white/60">{ft.ext}</span>
                        </span>
                        <span className="text-ink/40 dark:text-white/30">{t('exam.maxNote', { n: MAX_SIZE_MB })}</span>
                      </div>
                    ))}
                    <div className="mt-2 pt-2" style={{ borderTop:'1px solid rgb(var(--accent-500) / 0.15)' }}>
                      <p className="text-[11px] text-ink/40 dark:text-white/30">
                        {t('exam.maxNote', { n: MAX_SIZE_MB })}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="rounded-3xl p-6 flex flex-col gap-4" style={glass}>
              {files.length < MAX_FILES && (
                <div
                  onDrop={onDrop}
                  onDragOver={e => e.preventDefault()}
                  className="relative rounded-2xl border-2 border-dashed cursor-pointer transition-all hover:border-lavender-400"
                  style={{ borderColor:'rgb(var(--accent-500) / 0.30)', background:'rgb(var(--accent-500) / 0.04)' }}
                  onClick={() => fileRef.current?.click()}
                >
                  <input ref={fileRef} type="file" accept={ACCEPTED} multiple className="hidden"
                    onChange={e => { handleFiles(e.target.files); e.target.value = ''; }}/>
                  <div className="flex items-center justify-center gap-3 px-5 py-5">
                    {uploading ? (
                      <div className="flex items-center gap-2 text-lavender-600">
                        <div className="h-5 w-5 rounded-full border-2 border-lavender-400 border-t-lavender-600 animate-spin"/>
                        <span className="text-sm font-medium">{t('exam.extracting')}</span>
                      </div>
                    ) : (
                      <>
                        <Upload size={20} className="text-lavender-500 shrink-0"/>
                        <div>
                          <p className="text-sm font-semibold text-lavender-600">{t('exam.dropFile')}</p>
                          <p className="text-[11px] text-ink/40 mt-0.5">
                            {t('exam.dropTypes', { n: MAX_SIZE_MB })}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
              {files.length > 0 && (
                <div className="flex flex-col gap-2">
                  {files.map(f => (
                    <div key={f.id} className="flex items-center gap-3 rounded-2xl px-4 py-3"
                      style={{ background:'rgba(76,195,138,0.10)', border:'1px solid rgba(76,195,138,0.25)' }}>
                      <FileText size={18} className="text-sage-600 shrink-0"/>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-sage-700 truncate">{f.name}</p>
                        <p className="text-[11px] text-sage-600/70">
                          {t('exam.words', { n: f.wordCount?.toLocaleString() })} · {t('exam.wordsReady')}
                        </p>
                      </div>
                      <button onClick={() => removeFile(f.id)} className="text-sage-600/50 hover:text-coral-500 transition">
                        <X size={16}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-ink/8"/>
                <span className="text-xs text-ink/30 font-medium">
                  {files.length > 0 ? t('exam.orExtra') : t('exam.orPaste')}
                </span>
                <div className="flex-1 h-px bg-ink/8"/>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-ink/40">
                    {files.length > 0 ? t('exam.extraNotes') : t('exam.notes')}
                  </p>
                  {/* Dictation lets someone who can't type (or just doesn't
                      want to) get their study material in by talking
                      instead — same textarea, same downstream generation. */}
                  <VoiceInputButton size="sm" onText={(chunk) => setNotes((n) => appendText(n, chunk))} />
                </div>
                <textarea
                  className="w-full rounded-2xl p-4 text-sm text-ink dark:text-white bg-white/60 dark:bg-white/[0.05] border border-white/65 outline-none resize-none placeholder:text-ink/30 focus:border-lavender-400 transition"
                  rows={files.length > 0 ? 4 : 10}
                  placeholder={files.length > 0 ? t('exam.extraPh') : t('exam.notesPh')}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
              {mode !== 'chat' ? (
                <>
                  {hasContent && (
                    <div className="flex gap-4 flex-wrap">
                      {[
                        { icon:<FileText size={12}/>,  label:t('exam.words', { n: wordCount.toLocaleString() }) },
                        // Duration and difficulty are meaningless for Concept
                        // Map (no timer, no easy/medium/hard) — this row used
                        // to show them unconditionally for every non-chat
                        // mode, including mindmap, displaying whatever
                        // leftover value `duration`/`difficulty` happened to
                        // still hold from the last exam-style mode used. The
                        // sidebar already hides the actual duration/difficulty
                        // controls for mindmap (and difficulty for slides
                        // too) — this just mirrors those same conditions
                        // instead of showing stats for settings that don't
                        // apply to and were never used by the selected mode.
                        ...(mode !== 'mindmap' ? [{ icon:<Clock size={12}/>, label:t('exam.minExam', { n: duration }) }] : []),
                        ...(mode !== 'mindmap' && mode !== 'slides' ? [{ icon:<BarChart2 size={12}/>, label:t(`exam.${difficulty}`) }] : []),
                      ].map(({ icon, label }) => (
                        <span key={label} className="flex items-center gap-1.5 text-[11px] text-ink/45 font-medium">
                          {icon} {label}
                        </span>
                      ))}
                      {wordCount > 8000 && (
                        <span className="flex items-center gap-1.5 text-[11px] font-medium text-sun-600">
                          <AlertCircle size={11}/> {t('exam.largeWarn')}
                        </span>
                      )}
                    </div>
                  )}
                  <motion.button
                    whileHover={{ scale:1.01 }} whileTap={{ scale:0.98 }}
                    onClick={generate}
                    disabled={loading || !hasContent}
                    className="btn-primary justify-center py-3.5 text-base disabled:opacity-40"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-full border-2 border-white/40 border-t-white animate-spin"/>
                        {genElapsed > 0
                          ? t('exam.generatingElapsed', { n: genElapsed })
                          : t('exam.generating')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Sparkles size={18}/>
                        {t('exam.generate')} — {MODES.find(m=>m.key===mode)?.label}
                      </span>
                    )}
                  </motion.button>
                </>
              ) : (
                // Study Chat — grounded Q&A over the same upload/notes content
                // above, instead of a one-shot generate-and-view flow. Its own
                // scrolling transcript + input row, no `result` involved.
                <div className="flex flex-col gap-3">
                  <div
                    className="flex flex-col gap-3 overflow-y-auto rounded-2xl p-4"
                    style={{ minHeight: 260, maxHeight: 420, background:'rgba(255,255,255,0.35)', border:'1px solid rgba(255,255,255,0.50)' }}
                  >
                    {chatMessages.length === 0 ? (
                      <div className="flex flex-1 flex-col items-center justify-center text-center py-8 gap-2">
                        <span className="text-3xl">💬</span>
                        <p className="text-sm font-semibold text-ink/60 dark:text-white/60">{t('exam.chatEmptyTitle')}</p>
                        <p className="text-xs text-ink/40 dark:text-white/30 max-w-xs">{t('exam.chatEmptyDesc')}</p>
                      </div>
                    ) : (
                      chatMessages.map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                              m.role === 'user' ? 'text-white' : 'text-ink dark:text-white'
                            }`}
                            style={m.role === 'user'
                              ? { background: 'rgb(var(--accent-500))' }
                              : { background: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.70)' }}
                          >
                            {/* Real bug this fixes: the model's replies
                                often use bold text and lists (see the "Why
                                Arduino Uno?" example that prompted this),
                                but this bubble rendered raw text, so a
                                bolded phrase showed up as literal
                                asterisks instead of bold. Reuses the same
                                renderer AITools.jsx's main Lumi chat
                                already relies on for this exact thing, now
                                shared from utils/markdown.jsx instead of
                                living only in one page. User's own typed
                                messages stay plain — there's no reason to
                                markdown-parse what she typed. */}
                            {m.role === 'assistant' && m.deepSearch && (
                              <div className="flex items-center gap-1 mb-1.5 text-[10px] font-semibold text-lavender-500">
                                <Globe size={11}/> {t('lumi.deepSearch')}
                              </div>
                            )}
                            {m.role === 'assistant' ? renderMarkdown(m.content) : m.content}
                          </div>
                        </div>
                      ))
                    )}
                    {chatLoading && (
                      <div className="flex justify-start">
                        <div className="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs text-ink/40"
                          style={{ background:'rgba(255,255,255,0.65)', border:'1px solid rgba(255,255,255,0.70)' }}>
                          <div className="h-3 w-3 rounded-full border-2 border-lavender-400 border-t-lavender-600 animate-spin"/>
                          {t('exam.chatThinking')}
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <button
                      onClick={() => setDeepSearchOn(v => !v)}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
                      style={deepSearchOn
                        ? { background:'rgb(var(--accent-500) / 0.14)', border:'1px solid rgb(var(--accent-500) / 0.35)', color:'rgb(var(--accent-500))' }
                        : { background:'rgba(255,255,255,0.40)', border:'1px solid rgba(255,255,255,0.55)', color:'rgba(30,34,51,0.45)' }}
                      title={t('exam.deepSearchHint')}
                    >
                      <Globe size={13}/> {t('lumi.deepSearch')}
                    </button>
                    {deepSearchOn && (
                      <span className="text-[11px] text-lavender-500 font-medium">{t('exam.deepSearchOn')}</span>
                    )}
                  </div>
                  <div className="flex items-end gap-2">
                    <textarea
                      rows={1}
                      className="flex-1 rounded-2xl px-4 py-3 text-sm text-ink dark:text-white bg-white/60 dark:bg-white/[0.05] border border-white/65 outline-none resize-none placeholder:text-ink/30 focus:border-lavender-400 transition"
                      placeholder={t('exam.chatPlaceholder')}
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                    />
                    <VoiceInputButton size="sm" onText={(chunk) => setChatInput((v) => appendText(v, chunk))} />
                    <motion.button
                      whileHover={{ scale:1.05 }} whileTap={{ scale:0.95 }}
                      onClick={() => sendChatMessage()}
                      disabled={chatLoading || !chatInput.trim()}
                      className="btn-primary px-5 py-3 disabled:opacity-40"
                    >
                      {chatLoading
                        ? <div className="h-5 w-5 rounded-full border-2 border-white/40 border-t-white animate-spin"/>
                        : <Sparkles size={16}/>}
                    </motion.button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        {sessions.length > 0 && (
          <div className="mt-6 rounded-3xl p-5" style={glass}>
            <div className="flex items-center gap-2 mb-4">
              <HistoryIcon size={14} className="text-lavender-500"/>
              <p className="text-xs font-bold uppercase tracking-widest text-ink/40">
                {t('exam.pastSessions')}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {sessions.map(s => {
                const m = MODES.find(x => x.key === s.mode);
                const busy = sessionBusy === s.id;
                const countLabel = s.mode==='slides'
                  ? t('exam.minSlides', { n: s.item_count })
                  : s.mode==='flashcards'
                  ? t('exam.cards', { n: s.item_count })
                  : s.mode==='chat'
                  ? t('exam.messages', { n: s.item_count })
                  : t('exam.questions', { n: s.item_count });
                return (
                  <button key={s.id} onClick={() => openSession(s)} disabled={busy}
                    className="flex items-center gap-3 rounded-2xl px-4 py-3 text-start transition-all hover:scale-[1.01] disabled:opacity-50"
                    style={{ background:'rgba(255,255,255,0.45)', border:'1px solid rgba(255,255,255,0.60)' }}>
                    <span className="text-xl shrink-0">{m?.icon || '📚'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink/80 dark:text-white/75 truncate">
                        {m?.label || s.mode}
                        {s.source_name ? ` · ${s.source_name}` : ''}
                      </p>
                      <p className="text-[11px] text-ink/40 dark:text-white/30">
                        {countLabel}{s.mode !== 'slides' && s.mode !== 'chat' ? ` · ${t(`exam.${s.difficulty}`)}` : ''} · {fmtSessionDate(s.created_at, lang)}
                      </p>
                    </div>
                    <span
                      role="button" tabIndex={0}
                      onClick={e => removeSession(e, s.id)}
                      onKeyDown={e => { if (e.key==='Enter') removeSession(e, s.id); }}
                      className="text-ink/25 hover:text-coral-500 transition shrink-0 p-1"
                      title="Delete session"
                    >
                      <Trash2 size={13}/>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        </>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{MODES.find(m=>m.key===result.mode)?.icon}</span>
              <div>
                <h2 className="font-display font-bold text-ink dark:text-white">
                  {MODES.find(m=>m.key===result.mode)?.label}
                </h2>
                <p className="text-xs text-ink/40">
                  {result.mode==='slides'
                    ? t('exam.minSlides', { n: result.data.length })
                    : result.mode==='flashcards'
                    ? t('exam.cards', { n: result.data.length })
                    : result.mode==='mindmap'
                    ? t('exam.topics', { n: result.data.length })
                    : t('exam.questions', { n: result.data.length })}
                  {/* Difficulty never applied to slides or the concept map
                      (neither shows the picker — see the sidebar's mode
                      guards above) — showing it here anyway would just be
                      a stale/meaningless "· Medium" tacked on. */}
                  {result.mode!=='slides' && result.mode!=='mindmap' && ` · ${t(`exam.${difficulty}`)}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => handleExport('pdf')} disabled={!!exporting}
                title={isPremium ? undefined : (lang === 'ar' ? 'التصدير المجاني يتضمن علامة "صُنع بواسطة Nuvora" صغيرة — بريميوم يزيلها' : 'Free exports include a small "Made with Nuvora" watermark — Premium removes it')}
                className="flex items-center gap-2 rounded-2xl px-3.5 py-2 text-sm font-semibold text-lavender-600 transition disabled:opacity-50"
                style={{ background:'rgb(var(--accent-500) / 0.10)', border:'1px solid rgb(var(--accent-500) / 0.22)' }}>
                {exporting === 'pdf'
                  ? <div className="h-4 w-4 rounded-full border-2 border-lavender-300 border-t-lavender-600 animate-spin"/>
                  : <FileDown size={14}/>}
                PDF
              </button>
              <button onClick={() => handleExport('pptx')} disabled={!!exporting}
                title={isPremium ? undefined : (lang === 'ar' ? 'التصدير المجاني يتضمن علامة "صُنع بواسطة Nuvora" صغيرة — بريميوم يزيلها' : 'Free exports include a small "Made with Nuvora" watermark — Premium removes it')}
                className="flex items-center gap-2 rounded-2xl px-3.5 py-2 text-sm font-semibold text-lavender-600 transition disabled:opacity-50"
                style={{ background:'rgb(var(--accent-500) / 0.10)', border:'1px solid rgb(var(--accent-500) / 0.22)' }}>
                {exporting === 'pptx'
                  ? <div className="h-4 w-4 rounded-full border-2 border-lavender-300 border-t-lavender-600 animate-spin"/>
                  : <Presentation size={14}/>}
                PPTX
              </button>
              <button onClick={() => { setResult(null); setCurrentSessionId(null); setChatMessages([]); loadSessions(); }}
                className="flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-ink/55 transition" style={glass}>
                <RotateCcw size={14}/> {t('exam.newSession')}
              </button>
            </div>
          </div>
          {result.mode==='mcq'        && <MCQExam    questions={result.data} t={t} durationMin={result.durationMin}/>}
          {result.mode==='blanks'     && <FillBlanks questions={result.data} t={t} durationMin={result.durationMin}/>}
          {result.mode==='mixed'      && <MixedExam  questions={result.data} t={t} durationMin={result.durationMin}/>}
          {result.mode==='flashcards' && <Flashcards cards={result.data} t={t}/>}
          {result.mode==='slides'     && <SlideDeck  slides={result.data} t={t}/>}
          {result.mode==='mindmap'    && (
            <MindMap tree={result.data} onAskLumi={askLumiAboutNode} onViewSource={setSourceViewNode} t={t}/>
          )}
        </div>
      )}
      {sourceViewNode && (
        <SourceViewerModal node={sourceViewNode} files={files} notes={notes} onClose={() => setSourceViewNode(null)} t={t}/>
      )}
    </div>
  );
}