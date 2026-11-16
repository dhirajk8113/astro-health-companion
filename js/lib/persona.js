// How Astro appears and sounds: a character, a sprite or a plain speech
// bubble, drawn in code, and the tablet's own voice.
//
// The idea that Astro is a character that speaks, and the three forms offered
// here, are the team's. The drawings are AI-made and carry a visible mark.
//
// AI disclosure: written and drawn with an AI coding assistant (Claude). See AI-USE.md.

export const LOOKS = Object.freeze(['character', 'sprite', 'bubble']);
export const LOOK_NAMES = Object.freeze({ character: 'Character', sprite: 'Sprite', bubble: 'Bubble' });
export const DEFAULT_LOOK = 'character';

const LOOK_KEY = 'aeronyx.astro.look.v1';
const VOICE_KEY = 'aeronyx.astro.voice.v1';

export function loadLook(storage) {
  try {
    const v = storage.getItem(LOOK_KEY);
    return LOOKS.includes(v) ? v : DEFAULT_LOOK;
  } catch (err) {
    return DEFAULT_LOOK;
  }
}

export function saveLook(storage, look) {
  if (!LOOKS.includes(look)) return;
  try { storage.setItem(LOOK_KEY, look); } catch (err) { /* private mode: the choice lasts for this visit */ }
}

// The voice is on until it is switched off.
export function loadVoicePref(storage) {
  try { return storage.getItem(VOICE_KEY) !== 'off'; } catch (err) { return true; }
}

export function saveVoicePref(storage, on) {
  try { storage.setItem(VOICE_KEY, on ? 'on' : 'off'); } catch (err) { /* private mode */ }
}

// Picks a voice that runs on the tablet itself. A voice that sends text to a
// server is never used: nothing Astro says may leave the device, and a
// spacecraft has no such server to call.
const PREFERRED = ['Samantha', 'Karen', 'Moira', 'Microsoft Aria', 'Microsoft Jenny', 'Microsoft Zira', 'Google UK English Female', 'Google US English'];

export function pickVoice(voices) {
  const local = (voices || []).filter((v) => v && v.localService && /^en(-|_|$)/i.test(v.lang || ''));
  if (!local.length) return null;
  // A device's better voices say so in their names.
  const fine = local.find((v) => /premium|enhanced|natural|neural/i.test(String(v.name)));
  if (fine) return fine;
  for (const name of PREFERRED) {
    const hit = local.find((v) => String(v.name).includes(name));
    if (hit) return hit;
  }
  return local.find((v) => v.default) || local[0];
}

// How long Astro's mouth keeps moving for a line when no voice reports its end.
export function speakingMs(text) {
  const n = String(text || '').length;
  return Math.min(20000, 700 + n * 62);
}

// How many characters to reveal on each tick so any line is written out in about two seconds.
export function typingStep(length, ticks = 85) {
  return Math.max(1, Math.ceil(length / ticks));
}

// A small ringed planet with a face. Original to this project.
const CHARACTER = `<svg class="persona persona-character" viewBox="0 0 120 120" aria-hidden="true">
  <ellipse class="p-ring" cx="60" cy="70" rx="54" ry="12" transform="rotate(-14 60 70)"/>
  <circle class="p-body" cx="60" cy="58" r="34"/>
  <path class="p-shine" d="M40 40c5-7 12-10 20-10"/>
  <path class="p-ring p-ring-front" d="M6 70A54 12 0 0 0 114 70" transform="rotate(-14 60 70)"/>
  <ellipse class="p-eye" cx="48" cy="52" rx="4" ry="5.2"/>
  <ellipse class="p-eye" cx="72" cy="52" rx="4" ry="5.2"/>
  <path class="p-smile" d="M51 64c3 3.6 6 5 9 5s6-1.4 9-5"/>
  <ellipse class="p-mouth" cx="60" cy="66" rx="6" ry="3"/>
</svg>`;

// A glowing point of light with a sound wave in it.
const SPRITE = `<svg class="persona persona-sprite" viewBox="0 0 120 120" aria-hidden="true">
  <circle class="s-halo s-halo-2" cx="60" cy="60" r="52"/>
  <circle class="s-halo s-halo-1" cx="60" cy="60" r="42"/>
  <circle class="s-core" cx="60" cy="60" r="30"/>
  <g class="s-wave">
    <rect x="42" y="56" width="5" height="8" rx="2.5"/>
    <rect x="50" y="56" width="5" height="8" rx="2.5"/>
    <rect x="58" y="56" width="5" height="8" rx="2.5"/>
    <rect x="66" y="56" width="5" height="8" rx="2.5"/>
    <rect x="74" y="56" width="5" height="8" rx="2.5"/>
  </g>
</svg>`;

// The drawing for a look. The bubble look has none: the speech bubble is Astro.
export function personaSvg(look) {
  if (look === 'character') return CHARACTER;
  if (look === 'sprite') return SPRITE;
  return '';
}
