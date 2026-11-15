// Small line icons, drawn in code so the app needs no image files.
//
// AI disclosure: drawn with an AI coding assistant (Claude). See AI-USE.md.

const SUN = '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>';
const DROP = '<path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z"/>';
const THERMO = '<path d="M10 5a2 2 0 0 1 4 0v8a4 4 0 1 1-4 0z"/>';
const DIAL = '<path d="M4 15a8 8 0 0 1 16 0"/><path d="M12 15l4-5"/>';

const PATHS = {
  // one per reading, keyed by indicator id
  urine_vol: '<path d="M6 4h12l-1.5 15a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2z"/><path d="M7 11h10"/>',
  glucose: DROP,
  vitd: SUN,
  sleep: '<path d="M20 14a8 8 0 1 1-10-10 6 6 0 0 0 10 10z"/>',
  hr: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
  bp: DIAL,
  temp: THERMO,
  mass: '<rect x="4" y="5" width="16" height="14" rx="3"/><path d="M9 9h6"/>',
  fitness: '<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>',
  potassium: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/>',
  urine_ca: '<path d="M8 8l8 8"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  dose: '<circle cx="12" cy="12" r="1.6"/><ellipse cx="12" cy="12" rx="9" ry="4"/><ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(120 12 12)"/>',
  mood: '<circle cx="12" cy="12" r="9"/><path d="M8 14c1.2 1.6 2.5 2.3 4 2.3s2.8-.7 4-2.3"/><path d="M9 9.5v.5M15 9.5v.5"/>',
  // status and controls
  warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
  watch: '<circle cx="12" cy="12" r="8"/><path d="M12 8v5M12 16v.5"/>',
  ok: '<path d="M4 12l5 5 11-11"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  sound: '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11"/>',
  mute: '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M17 9.5l4 5M21 9.5l-4 5"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  badge: '<rect x="6" y="3" width="12" height="18" rx="2"/><circle cx="12" cy="10" r="2.5"/><path d="M9 16h6M10 3v2h4V3"/>',
  back: '<path d="M21 5H9l-6 7 6 7h12zM12 9l5 6M17 9l-5 6"/>',
  // the Space screen
  sun: SUN,
  flare: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>',
  particle: '<circle cx="6" cy="18" r="2"/><path d="M8 16L19 5M14 5h5v5"/>',
  magnet: '<path d="M6 4v8a6 6 0 0 0 12 0V4h-4v8a2 2 0 0 1-4 0V4zM6 8h4M14 8h4"/>',
  thermo: THERMO,
  dial: DIAL,
  air: '<path d="M3 9h11a3 3 0 1 0-3-3M3 14h15a3 3 0 1 1-3 3M3 19h7"/>',
  tank: DROP,
  signal: '<path d="M5 19a14 14 0 0 1 14 0M8 15a9 9 0 0 1 8 0"/><circle cx="12" cy="11" r="1.5"/>',
};

export function hasIcon(name) {
  return Object.prototype.hasOwnProperty.call(PATHS, name);
}

// An icon as inline SVG. Decorative: the text beside it carries the meaning.
export function icon(name, size = 18) {
  if (!hasIcon(name)) return '';
  return `<svg class="ico" aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24">${PATHS[name]}</svg>`;
}
