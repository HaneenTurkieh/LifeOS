import { useRef, useState, useCallback, useEffect } from 'react';

// Thin wrapper around the browser's built-in Web Speech API
// (SpeechRecognition / webkitSpeechRecognition) — no server round-trip,
// no API cost, works offline of any AI provider entirely. This is
// deliberately "dictation only": it turns speech into text and hands
// that text back to whoever's using the hook, same as if the person
// had typed it themselves. It has no idea what a "task" or "deadline"
// is — that's a distinct, heavier feature (parsing intent out of a full
// sentence) that would need an actual AI call per use, which is the
// opposite of what a free/low-traffic student project wants.
//
// Browser support: Chrome, Edge, and Safari (16.4+) support this.
// Firefox does not implement SpeechRecognition at all — `supported`
// comes back false there, so callers should hide/disable the mic
// button entirely rather than show something that silently fails.
//
// Arabic works the same way as English here — it's just a different
// BCP-47 locale tag passed to the same browser API. Recognition
// quality depends on the browser/OS's own speech engine (Chrome's is
// generally solid for Modern Standard Arabic), not on anything this
// app controls.
const LOCALE = { en: 'en-US', ar: 'ar-SA' };

export default function useVoiceDictation({ lang = 'en', onResult, onError } = {}) {
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef(null);
  const onResultRef = useRef(onResult);
  const onErrorRef  = useRef(onError);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { onErrorRef.current  = onError;  }, [onError]);

  const SpeechRecognitionCtor =
    typeof window !== 'undefined'
      ? (window.SpeechRecognition || window.webkitSpeechRecognition)
      : null;
  const supported = !!SpeechRecognitionCtor;

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      // onend below handles resetting `listening` — calling stop() lets
      // the recognizer flush any final result it's mid-processing,
      // instead of abort() which would drop it.
      recognitionRef.current.stop();
    }
  }, []);

  const start = useCallback(() => {
    if (!supported || listening) return;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang            = LOCALE[lang] || LOCALE.en;
    recognition.continuous      = true;
    recognition.interimResults  = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let finalChunk = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalChunk += chunk;
        else interim += chunk;
      }
      if (finalChunk.trim()) onResultRef.current?.(finalChunk.trim());
      setInterimText(interim);
    };
    recognition.onerror = (event) => {
      // 'no-speech' and 'aborted' fire routinely (someone paused, or
      // clicked stop) — not real errors worth surfacing to the person.
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        onErrorRef.current?.(event.error);
      }
    };
    recognition.onend = () => {
      setListening(false);
      setInterimText('');
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setListening(true);
    try { recognition.start(); }
    catch (_) { setListening(false); recognitionRef.current = null; }
  }, [supported, listening, lang, SpeechRecognitionCtor]);

  const toggle = useCallback(() => {
    if (listening) stop(); else start();
  }, [listening, start, stop]);

  useEffect(() => () => { recognitionRef.current?.stop(); }, []);

  return { supported, listening, interimText, start, stop, toggle };
}
