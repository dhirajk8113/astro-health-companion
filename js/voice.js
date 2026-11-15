// Astro's voice: the tablet's own speech, with nothing sent anywhere.
//
// AI disclosure: written with an AI coding assistant (Claude). See AI-USE.md.

import { pickVoice } from './lib/persona.js';

const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
let voices = [];

function refresh() {
  try { voices = synth.getVoices(); } catch (err) { voices = []; }
}

if (synth) {
  refresh();
  if (typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', refresh);
}

// True when this browser can speak at all. Whether it has a voice of its own is known only once the voices load.
export function hasSpeech() {
  return Boolean(synth) && typeof window.SpeechSynthesisUtterance !== 'undefined';
}

// True when the tablet has a voice of its own to speak with.
export function canSpeak() {
  if (!synth || typeof window.SpeechSynthesisUtterance === 'undefined') return false;
  if (!voices.length) refresh();
  return Boolean(pickVoice(voices));
}

// Says a line aloud. Returns false when there is no on-device voice; onEnd
// then never fires and the caller keeps time itself.
export function speak(text, onEnd) {
  if (!canSpeak()) return false;
  try {
    synth.cancel();
    const u = new window.SpeechSynthesisUtterance(String(text));
    const voice = pickVoice(voices);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.94;
    u.pitch = 1;
    u.onend = () => onEnd && onEnd();
    u.onerror = () => onEnd && onEnd();
    synth.speak(u);
    return true;
  } catch (err) {
    return false;
  }
}

export function hush() {
  try { if (synth) synth.cancel(); } catch (err) { /* nothing was speaking */ }
}
