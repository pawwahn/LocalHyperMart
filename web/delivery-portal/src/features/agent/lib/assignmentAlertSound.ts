const SOUND_URL = '/sounds/order-received.wav';
const DEFAULT_PHRASE = 'New delivery assigned';

let audioUnlocked = false;
const unlockListeners = new Set<(ready: boolean) => void>();

let loopClip: HTMLAudioElement | null = null;
let speechTimer: number | null = null;
let loopMessage: string | null = null;
let vibrateTimer: number | null = null;

function getUnlockAudio(): HTMLAudioElement {
  const audio = new Audio(SOUND_URL);
  audio.preload = 'auto';
  audio.volume = 1;
  return audio;
}

export function subscribeAssignmentAlertAudio(listener: (ready: boolean) => void): () => void {
  unlockListeners.add(listener);
  listener(audioUnlocked);
  return () => unlockListeners.delete(listener);
}

function setUnlocked(ready: boolean) {
  audioUnlocked = ready;
  unlockListeners.forEach((fn) => fn(ready));
}

export async function unlockAssignmentAlertAudio(): Promise<boolean> {
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
  return message?.trim() || DEFAULT_PHRASE;
}

function speak(message: string) {
  try {
    if (!window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    synth.resume();
    const utter = new SpeechSynthesisUtterance(message);
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

function playWebAudioChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    void ctx.close();
  } catch {
    /* ignore */
  }
}

export function vibrateForAssignment() {
  try {
    if (!navigator.vibrate) return;
    navigator.vibrate([180, 90, 180, 90, 280]);
  } catch {
    /* ignore */
  }
}

function startVibrateLoop() {
  vibrateForAssignment();
  if (vibrateTimer != null) window.clearInterval(vibrateTimer);
  vibrateTimer = window.setInterval(() => vibrateForAssignment(), 4500);
}

function stopVibrateLoop() {
  if (vibrateTimer != null) {
    window.clearInterval(vibrateTimer);
    vibrateTimer = null;
  }
  try {
    navigator.vibrate?.(0);
  } catch {
    /* ignore */
  }
}

function startSpeechLoop(message: string) {
  speak(message);
  if (speechTimer != null) window.clearInterval(speechTimer);
  speechTimer = window.setInterval(() => speak(message), 4000);
}

export function playAssignmentAlertSound(message = DEFAULT_PHRASE) {
  const phrase = normalizedMessage(message);
  try {
    const clip = new Audio(SOUND_URL);
    clip.volume = 1;
    void clip
      .play()
      .then(() => {
        if (!audioUnlocked) setUnlocked(true);
      })
      .catch(() => {
        playWebAudioChime();
        speak(phrase);
      });
  } catch {
    playWebAudioChime();
    speak(phrase);
  }
}

/** Repeat alert until stopAssignmentAlertLoop() — helps on mobile when the tab is open. */
export function startAssignmentAlertLoop(message = DEFAULT_PHRASE) {
  const phrase = normalizedMessage(message);
  if (loopMessage === phrase && ((loopClip && !loopClip.paused) || speechTimer != null)) return;
  stopAssignmentAlertLoop();
  loopMessage = phrase;
  startVibrateLoop();

  try {
    loopClip = new Audio(SOUND_URL);
    loopClip.volume = 1;
    loopClip.loop = true;
    void loopClip.play().catch(() => {
      loopClip = null;
      startSpeechLoop(phrase);
    });
  } catch {
    startSpeechLoop(phrase);
  }
}

export function stopAssignmentAlertLoop() {
  stopVibrateLoop();
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

export async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const perm = await Notification.requestPermission();
  return perm === 'granted';
}

export function notifyAgentAssignment(title: string, body: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      tag: 'hlm-agent-new-assignment',
      silent: false,
      requireInteraction: true,
    });
  } catch {
    /* ignore */
  }
}
