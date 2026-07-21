const SOUND_URL = '/sounds/order-received.wav';

let sharedAudio: HTMLAudioElement | null = null;
let audioUnlocked = false;

function getAudio(): HTMLAudioElement {
  if (!sharedAudio) {
    sharedAudio = new Audio(SOUND_URL);
    sharedAudio.preload = 'auto';
    sharedAudio.volume = 1;
  }
  return sharedAudio;
}

/** Call from a click so the browser allows later autoplay. */
export async function unlockOrderAlertAudio(): Promise<boolean> {
  try {
    const audio = getAudio();
    audio.muted = true;
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
    audio.muted = false;
    audioUnlocked = true;
    return true;
  } catch {
    return false;
  }
}

function speakFallback() {
  try {
    if (!window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    synth.resume();
    const utter = new SpeechSynthesisUtterance('Order received');
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
export function playOrderReceivedVoice() {
  try {
    const audio = getAudio();
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 1;
    // Clone so overlapping alerts still sound if a previous clip is mid-play.
    const clip = audio.cloneNode(true) as HTMLAudioElement;
    clip.volume = 1;
    const playPromise = clip.play();
    if (playPromise) {
      void playPromise.catch(() => {
        // Autoplay blocked (no user gesture yet) — try speech, then give up.
        speakFallback();
      });
    }
  } catch {
    speakFallback();
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
