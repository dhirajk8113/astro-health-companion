// Astro's voice. Every line Astro can say is recorded in a warm, natural voice
// and shipped with the app, so it plays with no connection and sounds the same
// on every device. Where there are no recordings, the tablet's own speech is
// used instead. Either way nothing is sent anywhere.
//
// AI disclosure: written with an AI coding assistant (Claude). See AI-USE.md.

import { pickVoice } from './lib/persona.js';
import { VOICE_LINES } from './data/voice-lines.js';

const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
let voices = [];

function refresh() {
  try { voices = synth.getVoices(); } catch (err) { voices = []; }
}

if (synth) {
  refresh();
  if (typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', refresh);
}

let player = null;

// True when Astro's lines are recorded.
export function hasRecordings() {
  return Object.keys(VOICE_LINES).length > 0;
}

// How long the recording of a line runs, in milliseconds, or 0 when there is none.
export function recordingMs(text) {
  const entry = VOICE_LINES[text];
  return entry ? Math.round(entry.seconds * 1000) : 0;
}

// Plays the recording of a line. Returns false when there is none.
function playRecording(text, onEnd) {
  const entry = VOICE_LINES[text];
  if (!entry || typeof window.Audio === 'undefined') return false;
  try {
    const audio = new window.Audio(`media/voice/${entry.file}`);
    player = audio;
    let over = false;
    const end = () => {
      if (over) return;
      over = true;
      if (onEnd) onEnd();
    };
    audio.addEventListener('ended', end);
    audio.addEventListener('error', end);
    const started = audio.play();
    // A browser that refuses to play without a tap leaves Astro silent rather than failing.
    if (started && typeof started.catch === 'function') started.catch(end);
    return true;
  } catch (err) {
    return false;
  }
}

// True when Astro can be heard here: its lines are recorded, or this browser can speak.
export function hasSpeech() {
  return hasRecordings() || (Boolean(synth) && typeof window.SpeechSynthesisUtterance !== 'undefined');
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
  hush();
  if (playRecording(text, onEnd)) return true;
  // With recordings in place, a line that has none is left unspoken: two voices in one conversation is worse than a pause.
  if (hasRecordings()) return false;
  if (!canSpeak()) return false;
  try {
    synth.cancel();
    const u = new window.SpeechSynthesisUtterance(String(text));
    const voice = pickVoice(voices);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.9;
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
  if (player) {
    try { player.pause(); } catch (err) { /* already stopped */ }
    player = null;
  }
}
