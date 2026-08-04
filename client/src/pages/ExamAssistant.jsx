import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Sparkles, RotateCcw, Check, X,
  ChevronLeft, ChevronRight, Upload, FileText,
  Clock, BarChart2, Info, AlertCircle, History as HistoryIcon, Trash2,
  FileDown, Presentation,
} from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import PageHeader from '../components/PageHeader.jsx';

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

// Reads the currently active premium accent color straight from the
// CSS custom property (set as raw "R G B" by index.css) and converts
// it to a hex string, so exported PPTX slides match whatever theme
// (purple/orange/pink/blue) the user has active — not hardcoded.
function getAccentHex() {
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--accent-500').trim();
    const [r, g, b] = raw.split(/\s+/).map(Number);
    if ([r, g, b].some((n) => Number.isNaN(n))) return '7C6AF0';
    return [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase();
  } catch (_) { return '7C6AF0'; }
}

// ── PDF export (jsPDF) — Note: standard PDF fonts don't support
// Arabic script. Arabic content will not render correctly here;
// use the PPTX export for Arabic exams instead. ────────────────
async function exportPdf(mode, data, t) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 48;
  let y = 56;
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth  = doc.internal.pageSize.getWidth();
  const maxWidth   = pageWidth - marginX * 2;

  const heading = {
    mcq: t('exam.mcq'), blanks: t('exam.blanks'), mixed: t('exam.mixed'),
    flashcards: t('exam.flashcards'), slides: t('exam.slides'),
  }[mode] || mode;

  const ensureSpace = (lines = 1, lineHeight = 16) => {
    if (y + lines * lineHeight > pageHeight - 48) {
      doc.addPage();
      y = 56;
    }
  };
  const writeWrapped = (text, size = 11, bold = false, indent = 0) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(String(text), maxWidth - indent);
    ensureSpace(lines.length, size * 1.4);
    doc.text(lines, marginX + indent, y);
    y += lines.length * size * 1.4;
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(heading, marginX, y);
  y += 32;

  if (mode === 'mcq' || mode === 'mixed') {
    data.forEach((q, i) => {
      ensureSpace(2, 18);
      if (mode === 'mixed' && q.type === 'blank') {
        writeWrapped(`${i + 1}. ${q.sentence}`, 12, true);
        writeWrapped(`${t('exam.answer')}: ${q.answer}`, 10, false, 16);
        if (q.hint) writeWrapped(`${t('exam.hint')}: ${q.hint}`, 10, false, 16);
      } else {
        writeWrapped(`${i + 1}. ${q.question}`, 12, true);
        (q.options || []).forEach((opt, j) => {
          const letter = ['A', 'B', 'C', 'D'][j];
          const mark = j === q.correct ? '  ✓' : '';
          writeWrapped(`${letter}) ${opt}${mark}`, 10.5, false, 16);
        });
        if (q.explanation) writeWrapped(`${t('exam.hint')}: ${q.explanation}`, 9.5, false, 16);
      }
      y += 10;
    });
  } else if (mode === 'blanks') {
    data.forEach((q, i) => {
      writeWrapped(`${i + 1}. ${q.sentence}`, 12, true);
      writeWrapped(`${t('exam.answer')}: ${q.answer}`, 10, false, 16);
      if (q.hint) writeWrapped(`${t('exam.hint')}: ${q.hint}`, 10, false, 16);
      y += 10;
    });
  } else if (mode === 'flashcards') {
    data.forEach((c, i) => {
      writeWrapped(`${i + 1}. ${t('exam.question')}: ${c.front}`, 12, true);
      writeWrapped(`${t('exam.answer')}: ${c.back}`, 10.5, false, 16);
      y += 10;
    });
  } else if (mode === 'slides') {
    data.forEach((s, i) => {
      ensureSpace(2, 18);
      writeWrapped(`${t('exam.slide', { n: i + 1 })} — ${s.title}`, 13, true);
      (s.bullets || []).forEach((b) => writeWrapped(`•  ${b}`, 10.5, false, 16));
      if (s.note) writeWrapped(`📝 ${s.note}`, 9.5, false, 16);
      y += 12;
    });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`aurora-${mode}-${stamp}.pdf`);
}

// ── PPTX export (pptxgenjs) — real slide-per-item deck, handles
// Arabic content correctly since PowerPoint renders the text itself
// rather than the library rasterizing fonts. Uses the active accent
// color for the title slide + headings. ────────────────────────
async function exportPptx(mode, data, t) {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  const accentHex = getAccentHex();

  const heading = {
    mcq: t('exam.mcq'), blanks: t('exam.blanks'), mixed: t('exam.mixed'),
    flashcards: t('exam.flashcards'), slides: t('exam.slides'),
  }[mode] || mode;

  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: accentHex };
  titleSlide.addText(heading, {
    x: 0.5, y: 2.2, w: 9, h: 1.2, fontSize: 36, bold: true, color: 'FFFFFF', align: 'center',
  });
  titleSlide.addText('Aurora ✦', {
    x: 0.5, y: 3.4, w: 9, h: 0.6, fontSize: 16, color: 'FFFFFF', align: 'center',
  });

  const addContentSlide = (titleText, bodyLines) => {
    const slide = pptx.addSlide();
    slide.addText(titleText, {
      x: 0.4, y: 0.3, w: 9.2, h: 0.8, fontSize: 20, bold: true, color: accentHex,
    });
    slide.addText(
      bodyLines.map((line) => ({
        text: line.text,
        options: {
          bullet: line.bullet !== false,
          color:  line.color || '333333',
          bold:   !!line.bold,
          fontSize: line.fontSize || 14,
        },
      })),
      { x: 0.5, y: 1.2, w: 9, h: 5.3, valign: 'top', lineSpacingMultiple: 1.3 }
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
          ...q.options.map((opt, j) => ({
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
      addContentSlide(s.title, [
        ...(s.bullets || []).map((b) => ({ text: b })),
        ...(s.note ? [{ text: `📝 ${s.note}`, fontSize: 12 }] : []),
      ]);
    });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  await pptx.writeFile({ fileName: `aurora-${mode}-${stamp}.pptx` });
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
        {q.options.map((opt, i) => {
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

function MCQExam({ questions, t }) {
  const [current,  setCurrent]  = useState(0);
  const [selected, setSelected] = useState({});
  const [revealed, setRevealed] = useState({});
  const [finished, setFinished] = useState(false);
  const correct = Object.entries(selected).filter(([i,v]) => v === questions[i].correct).length;
  if (finished) {
    const pct = Math.round((correct/questions.length)*100);
    return (
      <motion.div initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }}
        className="flex flex-col items-center text-center gap-6 py-10">
        <div className="text-7xl">{pct>=80?'🎉':pct>=50?'💪':'📚'}</div>
        <h2 className="font-display text-3xl font-bold text-ink dark:text-white">{pct}%</h2>
        <p className="text-ink/50">{t('exam.nCorrect', { c: correct, t: questions.length })}</p>
        <button onClick={() => { setCurrent(0); setSelected({}); setRevealed({}); setFinished(false); }} className="btn-primary flex items-center gap-2">
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

function FillBlanks({ questions, t }) {
  const [answers,  setAnswers]  = useState({});
  const [checked,  setChecked]  = useState({});
  const [finished, setFinished] = useState(false);
  const correct = Object.entries(checked).filter(([i]) =>
    answers[i]?.trim().toLowerCase() === questions[i].answer?.trim().toLowerCase()).length;
  if (finished) {
    const pct = Math.round((correct/questions.length)*100);
    return (
      <motion.div initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }}
        className="flex flex-col items-center text-center gap-6 py-10">
        <div className="text-7xl">{pct>=80?'🎉':pct>=50?'💪':'📚'}</div>
        <h2 className="font-display text-3xl font-bold text-ink dark:text-white">{pct}%</h2>
        <p className="text-ink/50">{t('exam.nCorrect', { c: correct, t: questions.length })}</p>
        <button onClick={() => { setAnswers({}); setChecked({}); setFinished(false); }} className="btn-primary flex items-center gap-2">
          <RotateCcw size={15}/> {t('exam.tryAgain')}
        </button>
      </motion.div>
    );
  }
  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
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

function MixedExam({ questions, t }) {
  const [selectedMCQ, setSelectedMCQ] = useState({});
  const [revealedMCQ, setRevealedMCQ] = useState({});
  const [answers,     setAnswers]     = useState({});
  const [checked,     setChecked]     = useState({});
  const [finished,    setFinished]    = useState(false);
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
        <p className="text-ink/50">{t('exam.nCorrect', { c: mcqCorrect+blankCorrect, t: total })}</p>
        <div className="flex gap-4 text-sm">
          <span className="text-lavender-600">{t('exam.mcq')}: {mcqCorrect}/{mcqQs.length}</span>
          <span className="text-blue-500">{t('exam.blanks')}: {blankCorrect}/{blankQs.length}</span>
        </div>
        <button onClick={() => { setSelectedMCQ({}); setRevealedMCQ({}); setAnswers({}); setChecked({}); setFinished(false); }}
          className="btn-primary flex items-center gap-2"><RotateCcw size={15}/> {t('exam.retry')}</button>
      </motion.div>
    );
  }
  let mi=0, bi=0;
  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
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
            {slide.bullets?.map((b,i) => (
              <motion.div key={i} initial={{ opacity:0, x:10 }} animate={{ opacity:1, x:0 }} transition={{ delay:i*0.06 }}
                className="flex items-start gap-3">
                <div className="mt-1.5 h-2 w-2 rounded-full bg-lavender-400 shrink-0"/>
                <p className="text-sm text-ink/75 dark:text-white/65 leading-relaxed">{b}</p>
              </motion.div>
            ))}
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

export default function ExamAssistant() {
  const toast = useToast();
  const { t, lang } = useLanguage();

  const MODES = [
    { key:'mcq',        label:t('exam.mcq'),        icon:'🔵', desc:t('exam.mcqDesc')        },
    { key:'blanks',     label:t('exam.blanks'),     icon:'✏️', desc:t('exam.blanksDesc')     },
    { key:'mixed',      label:t('exam.mixed'),      icon:'🎯', desc:t('exam.mixedDesc')      },
    { key:'flashcards', label:t('exam.flashcards'), icon:'🃏', desc:t('exam.flashDesc')      },
    { key:'slides',     label:t('exam.slides'),     icon:'🖥️', desc:t('exam.slidesDesc')    },
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
  const [extractedText, setExtractedText] = useState('');
  const [loading,       setLoading]       = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [uploadedFile,  setUploadedFile]  = useState(null);
  const [result,        setResult]        = useState(null);
  const [showFileInfo,  setShowFileInfo]  = useState(false);
  const [sessions,      setSessions]      = useState([]);
  const [sessionBusy,   setSessionBusy]   = useState(null);
  const [exporting,     setExporting]     = useState(null); // 'pdf' | 'pptx' | null
  const fileRef = useRef(null);

  const BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:4000'
    : 'https://lifeos-0l81.onrender.com';

  const authedFetch = useCallback((path, opts = {}) => fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers: {
      ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type':'application/json' } : {}),
      Authorization: `Bearer ${localStorage.getItem('aurora_auth_token')}`,
      ...(opts.headers || {}),
    },
  }), [BASE_URL]);

  const loadSessions = useCallback(async () => {
    try {
      const res  = await authedFetch('/api/exam/sessions');
      const data = await res.json();
      if (res.ok && Array.isArray(data)) setSessions(data);
    } catch (_) {}
  }, [authedFetch]);
  useEffect(() => { loadSessions(); }, [loadSessions]);

  const saveSession = async (sessionMode, sessionDifficulty, items, sourceName) => {
    try {
      const res = await authedFetch('/api/exam/sessions', {
        method: 'POST',
        body: JSON.stringify({ mode:sessionMode, difficulty:sessionDifficulty, items, sourceName }),
      });
      if (res.ok) loadSessions();
    } catch (_) {}
  };
  const openSession = async (session) => {
    setSessionBusy(session.id);
    try {
      const res  = await authedFetch(`/api/exam/sessions/${session.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not open session');
      setDifficulty(data.difficulty || 'medium');
      setResult({ mode: data.mode, data: data.items });
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

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(t('exam.tooLarge', { n: MAX_SIZE_MB }));
      return;
    }
    setUploading(true);
    setUploadedFile(null);
    setExtractedText('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await authedFetch('/api/exam/extract', { method:'POST', body:formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setExtractedText(data.text);
      setUploadedFile({ name: file.name, wordCount: data.wordCount });
      toast.success(`✓ ${file.name} — ${data.wordCount?.toLocaleString()} ${t('exam.wordsReady')}`);
    } catch (err) {
      toast.error(err.message);
      setUploadedFile(null);
    } finally {
      setUploading(false);
    }
  }, [toast, authedFetch, t]);
  const onDrop = (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); };
  const removeFile = () => { setUploadedFile(null); setExtractedText(''); };

  const generate = async () => {
    const content = extractedText || notes;
    if (!content.trim()) { toast.error(t('exam.addFirst')); return; }
    setLoading(true);
    setResult(null);
    let prompt = '';
    const base = `CRITICAL RULES:
- Return ONLY a valid JSON array. No markdown, no explanation, no text before or after.
- Cover ALL topics in the content. Do not skip any concept.
- The content to study is at the end of this message.
`;
    if (mode === 'mcq') {
      prompt = `${base}Generate a ${difficulty} multiple choice exam with exactly ${count} questions.
Each object: { "question": string, "options": [4 strings], "correct": 0-indexed number, "explanation": string }
Content:\n${content}`;
    } else if (mode === 'blanks') {
      prompt = `${base}Generate a ${difficulty} fill-in-the-blank exercise with exactly ${count} questions.
Each object: { "sentence": "text with ___ blank", "answer": string, "hint": string }
Content:\n${content}`;
    } else if (mode === 'mixed') {
      const half = Math.ceil(count/2);
      prompt = `${base}Generate a ${difficulty} mixed exam: ${half} MCQ and ${count-half} fill-in-the-blank questions. Interleave them.
MCQ object:   { "type": "mcq",   "question": string, "options": [4 strings], "correct": number, "explanation": string }
Blank object: { "type": "blank", "sentence": "text with ___", "answer": string, "hint": string }
Content:\n${content}`;
    } else if (mode === 'flashcards') {
      prompt = `${base}Generate exactly ${count} flashcards. Every important concept, term, formula must appear.
Each object: { "front": string, "back": string }
Content:\n${content}`;
    } else if (mode === 'slides') {
      prompt = `${base}Create a comprehensive slide deck. Include 100% of the information — no summarizing or omitting.
Create as many slides as needed to cover everything.
Each object: { "title": string, "bullets": [detailed strings], "note": string or null }
Content:\n${content}`;
    }
    try {
      const res = await authedFetch('/api/exam/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt }),
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
      setResult({ mode, data: parsed });
      const label = mode==='slides'
        ? t('exam.minSlides', { n: parsed.length })
        : mode==='flashcards'
        ? t('exam.cards', { n: parsed.length })
        : t('exam.questions', { n: parsed.length });
      toast.success(`${label} ✓`);
      saveSession(mode, difficulty, parsed, uploadedFile?.name || notes.slice(0, 60));
    } catch (err) {
      toast.error(err.message || 'Generation failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    if (!result) return;
    setExporting(format);
    try {
      if (format === 'pdf') await exportPdf(result.mode, result.data, t);
      else await exportPptx(result.mode, result.data, t);
    } catch (err) {
      console.error(err);
      toast.error(
        lang === 'ar'
          ? 'فشل التصدير — تأكد من تثبيت الحزم المطلوبة (jspdf, pptxgenjs)'
          : 'Export failed — make sure jspdf and pptxgenjs are installed (npm install jspdf pptxgenjs)'
      );
    } finally {
      setExporting(null);
    }
  };

  const wordCount  = (extractedText || notes).split(/\s+/).filter(Boolean).length;
  const hasContent = !!(extractedText || notes.trim());

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
            </div>
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
              {!uploadedFile ? (
                <div
                  onDrop={onDrop}
                  onDragOver={e => e.preventDefault()}
                  className="relative rounded-2xl border-2 border-dashed cursor-pointer transition-all hover:border-lavender-400"
                  style={{ borderColor:'rgb(var(--accent-500) / 0.30)', background:'rgb(var(--accent-500) / 0.04)' }}
                  onClick={() => fileRef.current?.click()}
                >
                  <input ref={fileRef} type="file" accept={ACCEPTED} className="hidden"
                    onChange={e => handleFile(e.target.files[0])}/>
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
              ) : (
                <div className="flex items-center gap-3 rounded-2xl px-4 py-3"
                  style={{ background:'rgba(76,195,138,0.10)', border:'1px solid rgba(76,195,138,0.25)' }}>
                  <FileText size={18} className="text-sage-600 shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-sage-700 truncate">{uploadedFile.name}</p>
                    <p className="text-[11px] text-sage-600/70">
                      {t('exam.words', { n: uploadedFile.wordCount?.toLocaleString() })} · {t('exam.wordsReady')}
                    </p>
                  </div>
                  <button onClick={removeFile} className="text-sage-600/50 hover:text-coral-500 transition">
                    <X size={16}/>
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-ink/8"/>
                <span className="text-xs text-ink/30 font-medium">
                  {uploadedFile ? t('exam.orExtra') : t('exam.orPaste')}
                </span>
                <div className="flex-1 h-px bg-ink/8"/>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-ink/40 mb-2">
                  {uploadedFile ? t('exam.extraNotes') : t('exam.notes')}
                </p>
                <textarea
                  className="w-full rounded-2xl p-4 text-sm text-ink dark:text-white bg-white/60 dark:bg-white/[0.05] border border-white/65 outline-none resize-none placeholder:text-ink/30 focus:border-lavender-400 transition"
                  rows={uploadedFile ? 4 : 10}
                  placeholder={uploadedFile ? t('exam.extraPh') : t('exam.notesPh')}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
              {hasContent && (
                <div className="flex gap-4 flex-wrap">
                  {[
                    { icon:<FileText size={12}/>,  label:t('exam.words', { n: wordCount.toLocaleString() }) },
                    { icon:<Clock size={12}/>,      label:t('exam.minExam', { n: duration }) },
                    { icon:<BarChart2 size={12}/>,  label:t(`exam.${difficulty}`) },
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
                    {t('exam.generating')}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Sparkles size={18}/>
                    {t('exam.generate')} — {MODES.find(m=>m.key===mode)?.label}
                  </span>
                )}
              </motion.button>
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
                        {countLabel} · {t(`exam.${s.difficulty}`)} · {fmtSessionDate(s.created_at, lang)}
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
                    : t('exam.questions', { n: result.data.length })} · {t(`exam.${difficulty}`)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => handleExport('pdf')} disabled={!!exporting}
                className="flex items-center gap-2 rounded-2xl px-3.5 py-2 text-sm font-semibold text-lavender-600 transition disabled:opacity-50"
                style={{ background:'rgb(var(--accent-500) / 0.10)', border:'1px solid rgb(var(--accent-500) / 0.22)' }}>
                {exporting === 'pdf'
                  ? <div className="h-4 w-4 rounded-full border-2 border-lavender-300 border-t-lavender-600 animate-spin"/>
                  : <FileDown size={14}/>}
                PDF
              </button>
              <button onClick={() => handleExport('pptx')} disabled={!!exporting}
                className="flex items-center gap-2 rounded-2xl px-3.5 py-2 text-sm font-semibold text-lavender-600 transition disabled:opacity-50"
                style={{ background:'rgb(var(--accent-500) / 0.10)', border:'1px solid rgb(var(--accent-500) / 0.22)' }}>
                {exporting === 'pptx'
                  ? <div className="h-4 w-4 rounded-full border-2 border-lavender-300 border-t-lavender-600 animate-spin"/>
                  : <Presentation size={14}/>}
                PPTX
              </button>
              <button onClick={() => { setResult(null); loadSessions(); }}
                className="flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-ink/55 transition" style={glass}>
                <RotateCcw size={14}/> {t('exam.newSession')}
              </button>
            </div>
          </div>
          {result.mode==='mcq'        && <MCQExam    questions={result.data} t={t}/>}
          {result.mode==='blanks'     && <FillBlanks questions={result.data} t={t}/>}
          {result.mode==='mixed'      && <MixedExam  questions={result.data} t={t}/>}
          {result.mode==='flashcards' && <Flashcards cards={result.data} t={t}/>}
          {result.mode==='slides'     && <SlideDeck  slides={result.data} t={t}/>}
        </div>
      )}
    </div>
  );
}