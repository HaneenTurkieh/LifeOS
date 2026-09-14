import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff } from 'lucide-react';
import useVoiceDictation from '../hooks/useVoiceDictation.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

// Drop-in mic button for any text input/textarea — dictation only (see
// useVoiceDictation.js for why). `onText` receives each finalized
// chunk of speech as plain text; the caller decides how to merge it
// into whatever field it owns (append with a space is the common
// case, handled by the two convenience wrappers below).
//
// Sized to sit inline next to a label or inside an input's corner —
// pass `size="sm"` for the compact 28px version used next to titles,
// default is 32px for standalone use next to a textarea.
export default function VoiceInputButton({ onText, size = 'md', className = '' }) {
  const { lang, t } = useLanguage();
  const toast = useToast();

  const { supported, listening, interimText, toggle } = useVoiceDictation({
    lang,
    onResult: (text) => onText?.(text),
    onError: () => {
      toast.error(lang === 'ar'
        ? 'تعذّر التعرّف على الصوت — تحقّق من إذن الميكروفون'
        : "Couldn't hear you — check the microphone permission");
    },
  });

  if (!supported) return null; // Firefox etc. — no silent-failure button

  const dim = size === 'sm' ? 28 : 32;
  const iconSize = size === 'sm' ? 13 : 15;

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={toggle}
        title={listening
          ? (lang === 'ar' ? 'إيقاف الاستماع' : 'Stop listening')
          : (lang === 'ar' ? 'أملِ بصوتك' : 'Dictate with your voice')}
        className={`relative flex shrink-0 items-center justify-center rounded-full transition ${className}`}
        style={{
          width: dim, height: dim,
          background: listening ? 'rgba(255,90,90,0.16)' : 'rgb(var(--accent-500) / 0.10)',
          border: `1px solid ${listening ? 'rgba(255,90,90,0.40)' : 'rgb(var(--accent-500) / 0.22)'}`,
          color: listening ? '#FF5A5A' : 'rgb(var(--accent-500))',
        }}
      >
        <AnimatePresence>
          {listening && (
            <motion.span
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 1.8, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut' }}
              className="absolute inset-0 rounded-full"
              style={{ background: 'rgba(255,90,90,0.35)' }}
            />
          )}
        </AnimatePresence>
        {listening ? <MicOff size={iconSize} /> : <Mic size={iconSize} />}
      </button>

      {/* Live partial transcript — the browser's speech engine only
          calls onResult once it decides a phrase is FINAL (after
          detecting a pause), which used to be the only thing shown
          anywhere. That made dictation feel slow/unresponsive even
          though the engine was already recognizing words in real
          time — useVoiceDictation was tracking interimText the whole
          time, it just wasn't surfaced. This bubble shows those
          in-progress words the instant the engine reports them, so
          catching speech reads as fast as it actually is; the field
          itself still only updates with the committed final chunk. */}
      <AnimatePresence>
        {listening && interimText && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
            className="absolute bottom-full start-1/2 -translate-x-1/2 mb-2 max-w-[220px] px-2.5 py-1.5 rounded-xl text-xs font-medium text-center pointer-events-none z-30"
            style={{
              background: 'rgba(30,34,51,0.88)',
              color: 'white',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            }}
          >
            {interimText}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Convenience: appends each recognized chunk onto whatever's already in
// the field, with a separating space — the shape every text field in
// this app wants (title, description, notes, milestone list...).
export function appendText(current, chunk) {
  const trimmed = (current || '').trimEnd();
  return trimmed ? `${trimmed} ${chunk}` : chunk;
}
