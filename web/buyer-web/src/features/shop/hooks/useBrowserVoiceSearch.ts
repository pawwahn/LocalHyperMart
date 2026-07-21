import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal?: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

/** STT often appends "." / "?" — strip so "milk." still matches products. */
function normalizeVoiceTranscript(raw: string): string {
  return raw
    .trim()
    .replace(/^[\s.!?…,;:'"„«»]+|[\s.!?…,;:'"„«»]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Browser voice search (Chrome/Edge). Used on buyer-web portal. */
export function useBrowserVoiceSearch(onResult: (transcript: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recogRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const w = window as SpeechWindow;
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  const stop = useCallback(() => {
    try {
      recogRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    setError(null);
    const w = window as SpeechWindow;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setError('Voice search needs Chrome or Edge');
      return;
    }
    try {
      const recog = new Ctor();
      recogRef.current = recog;
      recog.lang = 'en-IN';
      recog.interimResults = false;
      recog.continuous = false;
      recog.onresult = (event) => {
        const transcript = normalizeVoiceTranscript(event.results?.[0]?.[0]?.transcript ?? '');
        if (transcript) onResult(transcript);
        setListening(false);
      };
      recog.onerror = (event) => {
        setListening(false);
        if (event.error === 'aborted' || event.error === 'no-speech') return;
        setError(event.error === 'not-allowed' ? 'Allow microphone in the browser' : 'Voice search failed');
      };
      recog.onend = () => setListening(false);
      recog.start();
      setListening(true);
    } catch {
      setError('Could not start microphone');
      setListening(false);
    }
  }, [onResult]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  useEffect(() => () => stop(), [stop]);

  return { listening, supported, error, start, stop, toggle };
}
