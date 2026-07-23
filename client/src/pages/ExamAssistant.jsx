import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Sparkles, RotateCcw, Check, X,
  ChevronLeft, ChevronRight, Upload, FileText,
  Clock, BarChart2,
} from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import PageHeader from '../components/PageHeader.jsx';

// ── Constants ─────────────────────────────────────────────────
const MODES = [
  { key: 'mcq',        label: 'Multiple Choice', icon: '🔵', desc: 'Classic MCQ with 4 options' },
  { key: 'blanks',     label: 'Fill in Blanks',  icon: '✏️', desc: 'Complete missing words'     },
  { key: 'mixed',      label: 'Mixed Exam',       icon: '🎯', desc: 'MCQ + fill in blanks combined' },
  { key: 'flashcards', label: 'Flashcards',       icon: '🃏', desc: 'Active recall flip cards'  },
  { key: 'slides',     label: 'Slide Deck',       icon: '🖥️', desc: 'Full presentation — no info lost' },
];

const DIFFICULTIES = [
  { key: 'easy',   label: 'Easy',   color: '#4CC38A' },
  { key: 'medium', label: 'Medium', color: '#FFB84D' },
  { key: 'hard',   label: 'Hard',   color: '#FF7A63' },
];

const ACCEPTED = '.pdf,.pptx,.docx,.txt,.png,.jpg,.jpeg,.webp,.gif';

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

// ── MCQ question ──────────────────────────────────────────────
function MCQQuestion({ q, idx, selected, revealed, onChoose, onReveal }) {
  return (
    <div className="p-6" style={cardGlass}>
      <p className="text-xs text-ink/40 dark:text-white/30 mb-2 font-semibold uppercase tracking-widest">
        MCQ · Question {idx + 1}
      </p>
      <p className="font-display font-bold text-ink dark:text-white text-base mb-5 leading-snug">
        {q.question}
      </p>
      <div className="flex flex-col gap-2.5 mb-4">
        {q.options.map((opt, i) => {
          const isSelected = selected === i;
          const isCorrect  = q.correct === i;
          const show       = revealed;
          let bg = 'rgba(255,255,255,0.50)';
          let border = '1px solid rgba(255,255,255,0.65)';
          let color  = 'rgba(30,34,51,0.70)';
          if (show) {
            if (isCorrect)       { bg='rgba(76,195,138,0.15)'; border='1px solid rgba(76,195,138,0.40)'; color='#2DA76E'; }
            else if (isSelected) { bg='rgba(255,122,99,0.15)'; border='1px solid rgba(255,122,99,0.40)'; color='#FF7A63'; }
          } else if (isSelected) { bg='rgba(124,106,240,0.12)'; border='1px solid rgba(124,106,240,0.35)'; color='#5B47E0'; }
          return (
            <button key={i} onClick={() => onChoose(i)}
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition-all"
              style={{ background: bg, border, color }}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-bold"
                style={{ background:'rgba(124,106,240,0.10)', color:'#7C6AF0' }}>
                {['A','B','C','D'][i]}
              </span>
              {opt}
              {show && isCorrect  && <Check size={15} className="ml-auto text-sage-500 shrink-0" />}
              {show && isSelected && !isCorrect && <X size={15} className="ml-auto text-coral-500 shrink-0" />}
            </button>
          );
        })}
      </div>
      {revealed && q.explanation && (
        <div className="rounded-2xl px-4 py-3 text-sm text-ink/60 dark:text-white/50 mb-3"
          style={{ background:'rgba(124,106,240,0.08)', border:'1px solid rgba(124,106,240,0.15)' }}>
          💡 {q.explanation}
        </div>
      )}
      {selected !== undefined && !revealed && (
        <button onClick={onReveal}
          className="w-full rounded-2xl py-2.5 text-sm font-semibold text-lavender-600"
          style={{ background:'rgba(124,106,240,0.10)', border:'1px solid rgba(124,106,240,0.20)' }}>
          Check answer
        </button>
      )}
    </div>
  );
}

// ── Blank question ────────────────────────────────────────────
function BlankQuestion({ q, idx, answer, checked, onChange, onCheck }) {
  const isCorrect = answer?.trim().toLowerCase() === q.answer?.trim().toLowerCase();
  return (
    <div className="p-6" style={cardGlass}>
      <p className="text-xs text-ink/40 dark:text-white/30 mb-2 font-semibold uppercase tracking-widest">
        Fill in Blank · Question {idx + 1}
      </p>
      <p className="font-medium text-ink dark:text-white mb-3 leading-relaxed">
        {q.sentence?.split('___').map((part, j, arr) => (
          <span key={j}>
            {part}
            {j < arr.length - 1 && (
              <input
                value={answer || ''}
                onChange={(e) => onChange(e.target.value)}
                disabled={checked}
                className="inline-block mx-1 px-2 py-0.5 rounded-lg text-sm font-semibold outline-none border-b-2 bg-transparent w-32 text-center"
                style={{ borderColor: checked ? (isCorrect ? '#4CC38A' : '#FF7A63') : '#7C6AF0', color: checked ? (isCorrect ? '#2DA76E' : '#FF7A63') : '#7C6AF0' }}
                placeholder="___"
              />
            )}
          </span>
        ))}
      </p>
      {q.hint && !checked && (
        <p className="text-xs text-ink/35 mb-3">💡 Hint: {q.hint}</p>
      )}
      {checked ? (
        <p className={`text-xs font-semibold ${isCorrect ? 'text-sage-600' : 'text-coral-500'}`}>
          {isCorrect ? '✓ Correct!' : `✗ Answer: ${q.answer}`}
        </p>
      ) : (
        <button onClick={onCheck} disabled={!answer?.trim()}
          className="text-xs font-semibold text-lavender-600 disabled:opacity-40">
          Check →
        </button>
      )}
    </div>
  );
}

// ── MCQ Exam ──────────────────────────────────────────────────
function MCQExam({ questions }) {
  const [current,  setCurrent]  = useState(0);
  const [selected, setSelected] = useState({});
  const [revealed, setRevealed] = useState({});
  const [finished, setFinished] = useState(false);
  const q       = questions[current];
  const correct = Object.entries(selected).filter(([i,v]) => v === questions[i].correct).length;

  if (finished) {
    const pct = Math.round((correct/questions.length)*100);
    return (
      <motion.div initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }}
        className="flex flex-col items-center text-center gap-6 py-10">
        <div className="text-7xl">{pct>=80?'🎉':pct>=50?'💪':'📚'}</div>
        <h2 className="font-display text-3xl font-bold text-ink dark:text-white">{pct}%</h2>
        <p className="text-ink/50">{correct} / {questions.length} correct</p>
        <button onClick={() => { setCurrent(0); setSelected({}); setRevealed({}); setFinished(false); }} className="btn-primary flex items-center gap-2">
          <RotateCcw size={15} /> Retry
        </button>
      </motion.div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-ink/40">{current+1} / {questions.length}</span>
        <div className="flex gap-1">
          {questions.map((_,i) => (
            <div key={i} className="h-1.5 w-6 rounded-full"
              style={{ background: i < current ? '#7C6AF0' : i === current ? '#7C6AF0' : 'rgba(124,106,240,0.15)', opacity: i === current ? 1 : i < current ? 0.5 : 0.25 }} />
          ))}
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={current} initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }} transition={{ duration:0.2 }}>
          <MCQQuestion
            q={q} idx={current}
            selected={selected[current]}
            revealed={!!revealed[current]}
            onChoose={(i) => !revealed[current] && setSelected(s => ({...s,[current]:i}))}
            onReveal={() => setRevealed(r => ({...r,[current]:true}))}
          />
          {revealed[current] && (
            <button onClick={() => current < questions.length-1 ? setCurrent(c=>c+1) : setFinished(true)}
              className="btn-primary w-full justify-center mt-4">
              {current < questions.length-1 ? 'Next question →' : 'See results'}
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ── Fill Blanks Exam ──────────────────────────────────────────
function FillBlanks({ questions }) {
  const [answers,  setAnswers]  = useState({});
  const [checked,  setChecked]  = useState({});
  const [finished, setFinished] = useState(false);
  const correct = Object.entries(checked).filter(([i]) =>
    answers[i]?.trim().toLowerCase() === questions[i].answer?.trim().toLowerCase()
  ).length;

  if (finished) {
    const pct = Math.round((correct/questions.length)*100);
    return (
      <motion.div initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }}
        className="flex flex-col items-center text-center gap-6 py-10">
        <div className="text-7xl">{pct>=80?'🎉':pct>=50?'💪':'📚'}</div>
        <h2 className="font-display text-3xl font-bold text-ink dark:text-white">{pct}%</h2>
        <p className="text-ink/50">{correct} / {questions.length} correct</p>
        <button onClick={() => { setAnswers({}); setChecked({}); setFinished(false); }} className="btn-primary flex items-center gap-2">
          <RotateCcw size={15} /> Try again
        </button>
      </motion.div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      {questions.map((q,i) => (
        <BlankQuestion key={i} q={q} idx={i}
          answer={answers[i]}
          checked={!!checked[i]}
          onChange={(v) => setAnswers(a => ({...a,[i]:v}))}
          onCheck={() => setChecked(c => ({...c,[i]:true}))}
        />
      ))}
      <button onClick={() => setFinished(true)} className="btn-primary justify-center mt-2">
        See my score
      </button>
    </div>
  );
}

// ── Mixed Exam ────────────────────────────────────────────────
function MixedExam({ questions }) {
  const [selectedMCQ, setSelectedMCQ] = useState({});
  const [revealedMCQ, setRevealedMCQ] = useState({});
  const [answers,     setAnswers]     = useState({});
  const [checked,     setChecked]     = useState({});
  const [finished,    setFinished]    = useState(false);

  const mcqQs   = questions.filter(q => q.type === 'mcq');
  const blankQs = questions.filter(q => q.type === 'blank');

  const mcqCorrect = Object.entries(selectedMCQ).filter(([i,v]) => v === mcqQs[i]?.correct).length;
  const blankCorrect = Object.entries(checked).filter(([i]) =>
    answers[i]?.trim().toLowerCase() === blankQs[i]?.answer?.trim().toLowerCase()
  ).length;
  const totalCorrect = mcqCorrect + blankCorrect;
  const total        = questions.length;

  if (finished) {
    const pct = Math.round((totalCorrect/total)*100);
    return (
      <motion.div initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }}
        className="flex flex-col items-center text-center gap-6 py-10">
        <div className="text-7xl">{pct>=80?'🎉':pct>=50?'💪':'📚'}</div>
        <h2 className="font-display text-3xl font-bold text-ink dark:text-white">{pct}%</h2>
        <p className="text-ink/50">{totalCorrect} / {total} correct</p>
        <div className="flex gap-4 text-sm">
          <span className="text-lavender-600">MCQ: {mcqCorrect}/{mcqQs.length}</span>
          <span className="text-blue-500">Blanks: {blankCorrect}/{blankQs.length}</span>
        </div>
        <button onClick={() => { setSelectedMCQ({}); setRevealedMCQ({}); setAnswers({}); setChecked({}); setFinished(false); }}
          className="btn-primary flex items-center gap-2">
          <RotateCcw size={15} /> Retry
        </button>
      </motion.div>
    );
  }

  let mcqIdx   = 0;
  let blankIdx = 0;

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      {questions.map((q, i) => {
        if (q.type === 'mcq') {
          const mi = mcqIdx++;
          return (
            <MCQQuestion key={i} q={q} idx={i}
              selected={selectedMCQ[mi]}
              revealed={!!revealedMCQ[mi]}
              onChoose={(v) => !revealedMCQ[mi] && setSelectedMCQ(s => ({...s,[mi]:v}))}
              onReveal={() => setRevealedMCQ(r => ({...r,[mi]:true}))}
            />
          );
        } else {
          const bi = blankIdx++;
          return (
            <BlankQuestion key={i} q={q} idx={i}
              answer={answers[bi]}
              checked={!!checked[bi]}
              onChange={(v) => setAnswers(a => ({...a,[bi]:v}))}
              onCheck={() => setChecked(c => ({...c,[bi]:true}))}
            />
          );
        }
      })}
      <button onClick={() => setFinished(true)} className="btn-primary justify-center mt-2">
        See my score
      </button>
    </div>
  );
}

// ── Flashcards ────────────────────────────────────────────────
function Flashcards({ cards }) {
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known,   setKnown]   = useState(new Set());
  const [done,    setDone]    = useState(false);

  const next = () => {
    setFlipped(false);
    setTimeout(() => {
      if (current < cards.length-1) setCurrent(c=>c+1);
      else setDone(true);
    }, 150);
  };
  const markKnown = () => { setKnown(k => new Set([...k, current])); next(); };

  if (done) {
    return (
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
        className="flex flex-col items-center gap-6 py-10 text-center">
        <div className="text-7xl">🃏</div>
        <h2 className="font-display text-2xl font-bold text-ink dark:text-white">
          {known.size} / {cards.length} mastered
        </h2>
        <button onClick={() => { setCurrent(0); setFlipped(false); setKnown(new Set()); setDone(false); }}
          className="btn-primary flex items-center gap-2">
          <RotateCcw size={15} /> Review again
        </button>
      </motion.div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex justify-between mb-4 text-xs font-semibold">
        <span className="text-ink/40">{current+1} / {cards.length}</span>
        <span className="text-sage-600">{known.size} mastered</span>
      </div>
      <div className="relative h-64 cursor-pointer mb-6" onClick={() => setFlipped(f=>!f)} style={{ perspective:1000 }}>
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration:0.4, ease:'easeInOut' }}
          className="relative w-full h-full"
          style={{ transformStyle:'preserve-3d' }}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center"
            style={{ ...cardGlass, backfaceVisibility:'hidden' }}>
            <span className="text-xs font-bold uppercase tracking-widest text-lavender-500 mb-4">Question</span>
            <p className="font-display font-bold text-ink dark:text-white text-lg leading-snug">{cards[current].front}</p>
            <p className="text-xs text-ink/30 mt-4">Tap to reveal</p>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center"
            style={{ ...cardGlass, backfaceVisibility:'hidden', transform:'rotateY(180deg)', background:'rgba(124,106,240,0.08)', border:'1px solid rgba(124,106,240,0.20)' }}>
            <span className="text-xs font-bold uppercase tracking-widest text-lavender-500 mb-4">Answer</span>
            <p className="text-ink dark:text-white leading-relaxed">{cards[current].back}</p>
          </div>
        </motion.div>
      </div>
      <div className="flex gap-3">
        <button onClick={next} className="flex-1 rounded-2xl py-3 text-sm font-semibold"
          style={{ background:'rgba(255,122,99,0.12)', border:'1px solid rgba(255,122,99,0.25)', color:'#FF7A63' }}>
          Still learning
        </button>
        <button onClick={markKnown} className="flex-1 rounded-2xl py-3 text-sm font-semibold"
          style={{ background:'rgba(76,195,138,0.12)', border:'1px solid rgba(76,195,138,0.25)', color:'#2DA76E' }}>
          ✓ Got it!
        </button>
      </div>
      <div className="flex gap-2 justify-center mt-5">
        {cards.map((_,i) => (
          <div key={i} className="h-1.5 w-5 rounded-full transition-all"
            style={{ background: known.has(i) ? '#4CC38A' : i===current ? '#7C6AF0' : 'rgba(124,106,240,0.15)' }} />
        ))}
      </div>
    </div>
  );
}

// ── Slide Deck ────────────────────────────────────────────────
function SlideDeck({ slides }) {
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
              Slide {current+1} / {slides.length}
            </span>
            <div className="flex gap-1">
              {slides.map((_,i) => (
                <button key={i} onClick={() => setCurrent(i)}
                  className="h-1.5 rounded-full transition-all"
                  style={{ width: i===current?24:6, background: i===current?'#7C6AF0':'rgba(124,106,240,0.20)' }} />
              ))}
            </div>
          </div>
          <h2 className="font-display text-2xl font-bold text-ink dark:text-white mb-6 leading-snug">{slide.title}</h2>
          <div className="flex flex-col gap-3 flex-1">
            {slide.bullets?.map((b,i) => (
              <motion.div key={i} initial={{ opacity:0, x:10 }} animate={{ opacity:1, x:0 }} transition={{ delay:i*0.06 }}
                className="flex items-start gap-3">
                <div className="mt-1.5 h-2 w-2 rounded-full bg-lavender-400 shrink-0" />
                <p className="text-sm text-ink/75 dark:text-white/65 leading-relaxed">{b}</p>
              </motion.div>
            ))}
          </div>
          {slide.note && (
            <div className="mt-6 pt-4 border-t border-ink/8">
              <p className="text-xs text-ink/35 italic">📝 {slide.note}</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      <div className="flex items-center justify-between mt-4">
        <button onClick={() => setCurrent(c=>Math.max(0,c-1))} disabled={current===0}
          className="flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold disabled:opacity-30" style={glass}>
          <ChevronLeft size={16} /> Previous
        </button>
        <span className="text-xs text-ink/40">{current+1} of {slides.length}</span>
        <button onClick={() => setCurrent(c=>Math.min(slides.length-1,c+1))} disabled={current===slides.length-1}
          className="flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold disabled:opacity-30" style={glass}>
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function ExamAssistant() {
  const toast = useToast();

  const [mode,       setMode]       = useState('mcq');
  const [difficulty, setDifficulty] = useState('medium');
  const [count,      setCount]      = useState(10);
  const [duration,   setDuration]   = useState(15);
  const [notes,      setNotes]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [result,     setResult]     = useState(null);

  const fileRef = useRef(null);

  // ── File upload ───────────────────────────────────────────────
  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadedFile(file.name);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(
        `${window.location.hostname === 'localhost' ? 'http://localhost:4000' : 'https://lifeos-0l81.onrender.com'}/api/exam/extract`,
        {
          method:  'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('aurora_auth_token')}` },
          body:    formData,
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setNotes(data.text);
      toast.success(`${file.name} extracted successfully!`);
    } catch (err) {
      toast.error(err.message);
      setUploadedFile(null);
    } finally {
      setUploading(false);
    }
  }, [toast]);

  const onDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // ── Generate ──────────────────────────────────────────────────
  const generate = async () => {
    if (!notes.trim()) { toast.error('Add notes or upload a file first.'); return; }
    setLoading(true);
    setResult(null);

    let prompt = '';
    if (mode === 'mcq') {
      prompt = `Generate a ${difficulty} multiple choice exam with exactly ${count} questions based on these notes.
CRITICAL: Cover ALL topics. Do not skip any concept.
Return ONLY a valid JSON array. Each object: { question, options (array of 4), correct (0-indexed), explanation }
Notes:\n${notes}`;
    } else if (mode === 'blanks') {
      prompt = `Generate a ${difficulty} fill-in-the-blank exercise with exactly ${count} questions based on these notes.
CRITICAL: Cover ALL key terms and concepts.
Return ONLY a valid JSON array. Each object: { sentence (with ___), answer, hint }
Notes:\n${notes}`;
    } else if (mode === 'mixed') {
      const half = Math.ceil(count/2);
      prompt = `Generate a ${difficulty} mixed exam based on these notes: ${half} MCQ questions and ${count-half} fill-in-the-blank questions.
CRITICAL: Cover ALL topics. Interleave the question types.
Return ONLY a valid JSON array. Each object has a "type" field ("mcq" or "blank") plus:
- mcq: { type:"mcq", question, options (array of 4), correct (0-indexed), explanation }
- blank: { type:"blank", sentence (with ___), answer, hint }
Notes:\n${notes}`;
    } else if (mode === 'flashcards') {
      prompt = `Generate exactly ${count} flashcards from these notes.
CRITICAL: Every important concept, term, date, formula must appear. Do not skip anything.
Return ONLY a valid JSON array. Each object: { front, back }
Notes:\n${notes}`;
    } else if (mode === 'slides') {
      prompt = `Create a comprehensive slide deck from these notes.
CRITICAL: Include 100% of the information. Do not summarize, compress, or omit ANY detail. Create as many slides as needed.
Return ONLY a valid JSON array. Each object: { title, bullets (array of detailed strings), note }
Notes:\n${notes}`;
    }

    try {
      const res = await api.post('/chat', {
        messages: [{ role:'user', content: prompt }],
      });
      let parsed = [];
      try {
        const clean = res.text.replace(/```json|```/g,'').trim();
        parsed = JSON.parse(clean);
      } catch (_) {
        const match = res.text.match(/\[[\s\S]*\]/);
        if (match) parsed = JSON.parse(match[0]);
        else throw new Error('Could not parse response');
      }
      if (!Array.isArray(parsed) || !parsed.length) throw new Error('Empty result');
      setResult({ mode, data: parsed });
      toast.success(`Generated ${parsed.length} ${mode === 'slides' ? 'slides' : mode === 'flashcards' ? 'cards' : 'questions'}`);
    } catch (_) {
      toast.error('Generation failed. Try again or simplify your notes.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setResult(null); };

  return (
    <div>
      <PageHeader
        eyebrow="Lumi · Exam Assistant"
        title="Study smarter, not harder"
        subtitle="Upload any file or paste notes — Lumi generates exams, flashcards, and slides."
      />

      {!result ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Config */}
          <div className="lg:col-span-1 flex flex-col gap-4">

            {/* Mode */}
            <div className="rounded-3xl p-5" style={glass}>
              <p className="text-xs font-bold uppercase tracking-widest text-ink/40 mb-3">Study type</p>
              <div className="flex flex-col gap-2">
                {MODES.map((m) => (
                  <button key={m.key} onClick={() => setMode(m.key)}
                    className="flex items-start gap-3 rounded-2xl px-4 py-3 text-left transition-all"
                    style={mode===m.key
                      ? { background:'rgba(124,106,240,0.12)', border:'1px solid rgba(124,106,240,0.30)' }
                      : { background:'rgba(255,255,255,0.40)', border:'1px solid rgba(255,255,255,0.50)' }}>
                    <span className="text-xl shrink-0">{m.icon}</span>
                    <div>
                      <p className={`text-sm font-semibold ${mode===m.key ? 'text-lavender-700 dark:text-lavender-300' : 'text-ink/70 dark:text-white/60'}`}>
                        {m.label}
                      </p>
                      <p className="text-[11px] text-ink/40 mt-0.5">{m.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty */}
            <div className="rounded-3xl p-5" style={glass}>
              <p className="text-xs font-bold uppercase tracking-widest text-ink/40 mb-3">Difficulty</p>
              <div className="flex gap-2">
                {DIFFICULTIES.map((d) => (
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

            {/* Count + Duration */}
            <div className="rounded-3xl p-5" style={glass}>
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-widest text-ink/40 mb-2">
                  {mode==='slides' ? 'Min slides' : mode==='flashcards' ? 'Cards' : 'Questions'}: {count}
                </p>
                <input type="range" min={5} max={30} value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="w-full accent-lavender-600" />
                <div className="flex justify-between text-[10px] text-ink/30 mt-1">
                  <span>5</span><span>30</span>
                </div>
              </div>
              {(mode==='mcq' || mode==='blanks' || mode==='mixed') && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-ink/40 mb-2">
                    Duration: {duration} min
                  </p>
                  <input type="range" min={5} max={120} step={5} value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full accent-lavender-600" />
                  <div className="flex justify-between text-[10px] text-ink/30 mt-1">
                    <span>5 min</span><span>2 hr</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Notes + Upload */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="rounded-3xl p-6 flex flex-col gap-4" style={glass}>

              {/* File upload zone */}
              <div
                onDrop={onDrop}
                onDragOver={(e) => e.preventDefault()}
                className="relative rounded-2xl border-2 border-dashed transition-all cursor-pointer"
                style={{ borderColor:'rgba(124,106,240,0.30)', background:'rgba(124,106,240,0.04)' }}
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPTED}
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files[0])}
                />
                <div className="flex items-center justify-center gap-3 px-5 py-4">
                  {uploading ? (
                    <div className="flex items-center gap-2 text-lavender-600">
                      <div className="h-5 w-5 rounded-full border-2 border-lavender-400 border-t-lavender-600 animate-spin" />
                      <span className="text-sm font-medium">Extracting text…</span>
                    </div>
                  ) : uploadedFile ? (
                    <div className="flex items-center gap-2 text-sage-600">
                      <FileText size={18} />
                      <span className="text-sm font-medium truncate max-w-xs">{uploadedFile}</span>
                      <Check size={16} />
                    </div>
                  ) : (
                    <>
                      <Upload size={18} className="text-lavender-500 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-lavender-600">
                          Drop a file or click to upload
                        </p>
                        <p className="text-[11px] text-ink/40 mt-0.5">
                          PDF, PPTX, DOCX, TXT, or image — max 25MB
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-ink/8" />
                <span className="text-xs text-ink/30 font-medium">or paste notes below</span>
                <div className="flex-1 h-px bg-ink/8" />
              </div>

              {/* Notes textarea */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-ink/40 mb-2">Notes</p>
                <textarea
                  className="w-full rounded-2xl p-4 text-sm text-ink dark:text-white bg-white/60 dark:bg-white/[0.05] border border-white/65 outline-none resize-none placeholder:text-ink/30 focus:border-lavender-400 transition"
                  rows={10}
                  placeholder={`Paste lecture notes, textbook content, or describe a topic…

Lumi will cover ALL of it — nothing gets left out.`}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Stats */}
              {notes.trim() && (
                <div className="flex gap-3 flex-wrap">
                  {[
                    { icon:<FileText size={12}/>,  label:`${notes.split(/\s+/).filter(Boolean).length} words` },
                    { icon:<Clock size={12}/>,      label:`~${duration} min exam` },
                    { icon:<BarChart2 size={12}/>,  label:difficulty },
                  ].map(({ icon, label }) => (
                    <span key={label} className="flex items-center gap-1.5 text-[11px] text-ink/45 font-medium">
                      {icon} {label}
                    </span>
                  ))}
                </div>
              )}

              <motion.button
                whileHover={{ scale:1.01 }} whileTap={{ scale:0.98 }}
                onClick={generate}
                disabled={loading || !notes.trim()}
                className="btn-primary justify-center py-3.5 text-base disabled:opacity-40"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    Generating…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Sparkles size={18} />
                    Generate {MODES.find(m=>m.key===mode)?.label}
                  </span>
                )}
              </motion.button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{MODES.find(m=>m.key===result.mode)?.icon}</span>
              <div>
                <h2 className="font-display font-bold text-ink dark:text-white">
                  {MODES.find(m=>m.key===result.mode)?.label}
                </h2>
                <p className="text-xs text-ink/40">
                  {result.data.length} {result.mode==='slides'?'slides':result.mode==='flashcards'?'cards':'questions'} · {difficulty}
                </p>
              </div>
            </div>
            <button onClick={reset}
              className="flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-ink/55 transition" style={glass}>
              <RotateCcw size={14} /> New session
            </button>
          </div>

          {result.mode === 'mcq'        && <MCQExam     questions={result.data} />}
          {result.mode === 'blanks'     && <FillBlanks  questions={result.data} />}
          {result.mode === 'mixed'      && <MixedExam   questions={result.data} />}
          {result.mode === 'flashcards' && <Flashcards  cards={result.data}     />}
          {result.mode === 'slides'     && <SlideDeck   slides={result.data}    />}
        </div>
      )}
    </div>
  );
}