const SOUND_URL = '/sounds/order-received.wav';

let unlockAudio: HTMLAudioElement | null = null;
let audioUnlocked = false;
const unlockListeners = new Set<(ready: boolean) => void>();

function getUnlockAudio(): HTMLAudioElement {
  if (!unlockAudio) {
    unlockAudio = new Audio(SOUND_URL);
    unlockAudio.preload = 'auto';
    unlockAudio.volume = 1;
  }
  return unlockAudio;
}

export function subscribeOrderAlertAudio(listener: (ready: boolean) => void): () => void {
  unlockListeners.add(listener);
  listener(audioUnlocked);
  return () => {
    unlockListeners.delete(listener);
  };
}

function setUnlocked(ready: boolean) {
  audioUnlocked = ready;
  unlockListeners.forEach((fn) => fn(ready));
}

/** Call from a click so the browser allows later autoplay. */
export async function unlockOrderAlertAudio(): Promise<boolean> {
  try {
    const audio = getUnlockAudio();
    audio.muted = true;
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
    audio.muted = false;
    setUnlocked(true);
    return true;
  } catch {
    setUnlocked(false);
    return false;
  }
}

function normalizedMessage(message?: string): string {
  return message?.trim() || 'Order received';
}

function speakFallback(message = 'Order received') {
  try {
    if (!window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    synth.resume();
    const utter = new SpeechSynthesisUtterance(normalizedMessage(message));
    utter.lang = 'en-IN';
    utter.rate = 1;
    utter.volume = 1;
    const voices = synth.getVoices();
    const preferred =
      voices.find((v) => /en-IN/i.test(v.lang)) ?? voices.find((v) => /^en/i.test(v.lang));
    if (preferred) utter.voice = preferred;
    synth.speak(utter);
  } catch {
    /* ignore */
  }
}

/** Play recorded “Order received” (falls back to browser speech). Works in background tabs after unlock. */
export function playOrderReceivedVoice(message = 'Order received') {
  const phrase = normalizedMessage(message);
  if (phrase.toLocaleLowerCase() !== 'order received') {
    speakFallback(phrase);
    return;
  }
  try {
    // Fresh Audio each time — cloneNode of constructor-created Audio often has empty src.
    const clip = new Audio(SOUND_URL);
    clip.volume = 1;
    const playPromise = clip.play();
    if (playPromise) {
      void playPromise
        .then(() => {
          if (!audioUnlocked) setUnlocked(true);
        })
        .catch(() => {
          // Autoplay blocked (no user gesture yet) — try speech, then give up.
          speakFallback(phrase);
        });
    }
  } catch {
    speakFallback(phrase);
  }
}

let loopClip: HTMLAudioElement | null = null;
let speechTimer: number | null = null;
let loopMessage: string | null = null;

function startSpeechLoop(message: string) {
  speakFallback(message);
  if (speechTimer != null) window.clearInterval(speechTimer);
  speechTimer = window.setInterval(() => speakFallback(message), 4000);
}

/** Loop the order-received clip until stopOrderAlertLoop(). One loop only. */
export function startOrderAlertLoop(message = 'Order received') {
  const phrase = normalizedMessage(message);
  if (loopMessage === phrase && ((loopClip && !loopClip.paused) || speechTimer != null)) return;
  stopOrderAlertLoop();
  loopMessage = phrase;
  if (phrase.toLocaleLowerCase() !== 'order received') {
    startSpeechLoop(phrase);
    return;
  }
  try {
    loopClip = new Audio(SOUND_URL);
    loopClip.loop = true;
    loopClip.volume = 1;
    const playPromise = loopClip.play();
    if (playPromise) {
      void playPromise
        .then(() => {
          if (!audioUnlocked) setUnlocked(true);
        })
        .catch(() => {
          startSpeechLoop(phrase);
        });
    }
  } catch {
    startSpeechLoop(phrase);
  }
}

export function stopOrderAlertLoop() {
  if (loopClip) {
    try {
      loopClip.pause();
      loopClip.loop = false;
      loopClip.removeAttribute('src');
      loopClip.load();
    } catch {
      /* ignore */
    }
    loopClip = null;
  }
  if (speechTimer != null) {
    window.clearInterval(speechTimer);
    speechTimer = null;
  }
  loopMessage = null;
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}

/** Returns whether autoplay was unlocked by a prior user gesture. */
export function isOrderAlertAudioUnlocked(): boolean {
  return audioUnlocked;
}

export function notifyBrowserOrder(title: string, body: string) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'granted') {
    try {
      // System notification sound still helps when our WAV is blocked in background.
      new Notification(title, {
        body,
        tag: 'hlm-vendor-new-order',
        silent: false,
        requireInteraction: true,
      });
    } catch {
      /* ignore */
    }
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const perm = await Notification.requestPermission();
  return perm === 'granted';
}
