// AeroNYX: the concept device drawn around the screen, shaded to look like
// hardware, in the graphite finish the team chose. It follows the team's
// sketch: the screen, a sample port on the left, a medication dispenser on the
// right and attachment points on top. A specimen tube goes into the port when
// a sample is run, and a capsule drops into the cup when a dose is dispensed.
//
// It is a drawing. No hardware exists, and the device says so on its lower edge.
//
// AI disclosure: drawn and written with an AI coding assistant (Claude). See AI-USE.md.

const GRAPHITE = {
  bg: ['#252e40', '#05070b'], shell: ['#474e5c', '#2a2f39', '#1c2028'], pod: ['#15181e', '#4a515f', '#2c313b', '#14171c'],
  ink: '#d5dae3', metal: ['#d3d9e3', '#7b8494', '#3d4450'], accent: '#7ea6ff', seam: '#0d0f13', grain: 0.5,
};
const AMBER = '#f3c06b';
const GREEN = '#6fd596';
const SPECIMEN = { blood: { liquid: '#b3202f', cap: '#7a2bbf' }, urine: { liquid: '#e2b93b', cap: '#e8c23a' } };

const n1 = (v) => Number(v.toFixed(1));
// A rounded rectangle as a path, so two of them can cut a hole with fill-rule="evenodd".
function rr(b, r) {
  return `M${n1(b.x + r)} ${n1(b.y)}h${n1(b.w - 2 * r)}a${r} ${r} 0 0 1 ${r} ${r}v${n1(b.h - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${r}h${n1(-(b.w - 2 * r))}a${r} ${r} 0 0 1 ${-r} ${-r}v${n1(-(b.h - 2 * r))}a${r} ${r} 0 0 1 ${r} ${-r}z`;
}

// Where the moving parts sit, worked out from where the app has put its screen and side units.
// geo: { W, H, scr, shell, sample, meds } with each box as { x, y, w, h }, and clips as a list of { x, y }.
export function skinParts(geo) {
  const { sample: sp, meds: mp } = geo;
  return {
    slot: { cx: sp.x + sp.w / 2, cy: sp.y + 52, rx: 27, ry: 10 },
    ring: { cx: sp.x + sp.w / 2, cy: sp.y + 136, r: 21 },
    readout: { x: sp.x + 18, y: sp.y + 232, w: 54, h: 150 },
    chute: { x: mp.x + 18, y: mp.y + 40, w: 54, h: 16 },
    cup: { x: mp.x + 21, y: mp.y + 160, w: 48, h: 62 },
  };
}

// The two drawings: the device itself, which never changes, and the parts that move.
export function skinMarkup(geo) {
  const f = GRAPHITE;
  const { W, H, scr, shell, sample: sp, meds: mp } = geo;
  const p = skinParts(geo);
  const glass = { x: scr.x - 8, y: scr.y - 10, w: scr.w + 16, h: scr.h + 20 };
  const mid = sp.x + sp.w / 2;
  const medMid = mp.x + mp.w / 2;
  const clips = (geo.clips || []).map((c) => `
      <path d="M${n1(c.x)} ${n1(c.y + 22)}V${n1(c.y + 2)}a8 8 0 0 1 8-8h36a8 8 0 0 1 8 8v20z" fill="url(#sk-metal)" stroke="${f.seam}" stroke-width="1"/>
      <rect x="${n1(c.x + 4)}" y="${n1(c.y - 3)}" width="44" height="3" rx="1.5" fill="#fff" opacity="0.35"/>
      <circle cx="${n1(c.x + 26)}" cy="${n1(c.y + 9)}" r="6.5" fill="${f.metal[2]}" stroke="${f.seam}" stroke-width="1"/>
      <circle cx="${n1(c.x + 26)}" cy="${n1(c.y + 9)}" r="3" fill="#05070a"/>`).join('');
  const screw = (x, y) => `<circle cx="${n1(x)}" cy="${n1(y)}" r="4.2" fill="url(#sk-metal)" stroke="${f.seam}" stroke-width="0.8"/><path d="M${n1(x - 2.6)} ${n1(y - 1.6)}l5.2 3.2" stroke="${f.metal[2]}" stroke-width="1.2" stroke-linecap="round"/>`;
  // The grip ridges are left off a short unit, where they would run into the readout.
  const gripTop = sp.y + sp.h - 158;
  const grip = sp.h >= 600 ? Array.from({ length: 9 }, (_, k) => `<rect x="${n1(sp.x + 20)}" y="${n1(gripTop + k * 9)}" width="50" height="3.4" rx="1.7" fill="${f.seam}" opacity="0.55"/><rect x="${n1(sp.x + 20)}" y="${n1(gripTop + 3.4 + k * 9)}" width="50" height="1" rx="0.5" fill="#fff" opacity="0.12"/>`).join('') : '';
  const medsPath = `M${n1(mp.x)} ${n1(mp.y + 14)}a14 14 0 0 1 14-14h${n1(mp.w - 54)}a40 40 0 0 1 40 40v${n1(mp.h - 80)}a40 40 0 0 1-40 40h${n1(-(mp.w - 54))}a14 14 0 0 1-14-14z`;
  const seamY = [sp.y + 202, sp.y + 426];
  const top = shell.y + 15.5;
  const bx = shell.x + shell.w - 88;
  const by = shell.y + shell.h - 16;
  const { slot, ring, readout, chute, cup } = p;

  const still = `
<svg id="sk-still" class="sk" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="sk-bg" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="${f.bg[0]}"/><stop offset="1" stop-color="${f.bg[1]}"/></radialGradient>
    <linearGradient id="sk-shell" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${f.shell[0]}"/><stop offset="0.5" stop-color="${f.shell[1]}"/><stop offset="1" stop-color="${f.shell[2]}"/></linearGradient>
    <linearGradient id="sk-pod" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${f.pod[0]}"/><stop offset="0.3" stop-color="${f.pod[1]}"/><stop offset="0.62" stop-color="${f.pod[2]}"/><stop offset="1" stop-color="${f.pod[3]}"/></linearGradient>
    <linearGradient id="sk-metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${f.metal[0]}"/><stop offset="0.55" stop-color="${f.metal[1]}"/><stop offset="1" stop-color="${f.metal[2]}"/></linearGradient>
    <linearGradient id="sk-edge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.75"/><stop offset="0.35" stop-color="#fff" stop-opacity="0.05"/><stop offset="0.7" stop-color="#000" stop-opacity="0.1"/><stop offset="1" stop-color="#000" stop-opacity="0.6"/></linearGradient>
    <linearGradient id="sk-glare" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.07"/><stop offset="0.45" stop-color="#fff" stop-opacity="0.012"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <radialGradient id="sk-hole" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="#000"/><stop offset="0.75" stop-color="#05070a"/><stop offset="1" stop-color="#1b1f27"/></radialGradient>
    <filter id="sk-blur28" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="26"/></filter>
    <filter id="sk-blur4" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="4"/></filter>
    <filter id="sk-grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0.33 0.33 0.33 0 -0.28"/>
      <feComposite in2="SourceGraphic" operator="in"/>
    </filter>
    <mask id="sk-noscreen"><rect width="${W}" height="${H}" fill="#fff"/><path d="${rr(scr, 12)}" fill="#000"/></mask>
    <clipPath id="sk-inscreen"><path d="${rr(scr, 12)}"/></clipPath>
  </defs>
  <g mask="url(#sk-noscreen)">
    <rect width="${W}" height="${H}" fill="url(#sk-bg)"/>
    <rect x="${n1(sp.x + 12)}" y="${n1(shell.y + 36)}" width="${n1(mp.x + mp.w - sp.x - 24)}" height="${n1(shell.h - 28)}" rx="60" fill="#000" opacity="0.6" filter="url(#sk-blur28)"/>
    ${clips}
    <rect x="${n1(sp.x)}" y="${n1(sp.y)}" width="${n1(sp.w)}" height="${n1(sp.h)}" rx="45" fill="url(#sk-pod)"/>
    <rect x="${n1(sp.x)}" y="${n1(sp.y)}" width="${n1(sp.w)}" height="${n1(sp.h)}" rx="45" fill="#fff" opacity="${f.grain}" filter="url(#sk-grain)"/>
    <rect x="${n1(sp.x + 0.75)}" y="${n1(sp.y + 0.75)}" width="${n1(sp.w - 1.5)}" height="${n1(sp.h - 1.5)}" rx="44.25" fill="none" stroke="url(#sk-edge)" stroke-width="1.5"/>
    <ellipse cx="${n1(slot.cx)}" cy="${n1(slot.cy)}" rx="${slot.rx + 6}" ry="${slot.ry + 5}" fill="url(#sk-metal)" stroke="${f.seam}" stroke-width="1"/>
    <ellipse cx="${n1(slot.cx)}" cy="${n1(slot.cy)}" rx="${slot.rx}" ry="${slot.ry}" fill="url(#sk-hole)"/>
    <text x="${n1(mid)}" y="${n1(sp.y + 90)}" text-anchor="middle" font-size="10.5" font-weight="700" letter-spacing="2.4" fill="${f.ink}" opacity="0.9">SAMPLE</text>
    <circle cx="${n1(ring.cx)}" cy="${n1(ring.cy)}" r="${ring.r + 7}" fill="${f.seam}" opacity="0.85"/>
    <circle cx="${n1(ring.cx)}" cy="${n1(ring.cy)}" r="${ring.r - 7}" fill="url(#sk-hole)"/>
    <path d="M${n1(sp.x + 6)} ${n1(seamY[0])}h${n1(sp.w - 12)}M${n1(sp.x + 6)} ${n1(seamY[1])}h${n1(sp.w - 12)}" stroke="${f.seam}" stroke-width="1.6" opacity="0.8"/>
    <path d="M${n1(sp.x + 6)} ${n1(seamY[0] + 1.6)}h${n1(sp.w - 12)}M${n1(sp.x + 6)} ${n1(seamY[1] + 1.6)}h${n1(sp.w - 12)}" stroke="#fff" stroke-width="0.8" opacity="0.18"/>
    <rect x="${n1(readout.x)}" y="${n1(readout.y)}" width="${readout.w}" height="${readout.h}" rx="10" fill="#05070a" opacity="0.9"/>
    <rect x="${n1(readout.x + 0.75)}" y="${n1(readout.y + 0.75)}" width="${readout.w - 1.5}" height="${readout.h - 1.5}" rx="9.25" fill="none" stroke="#fff" stroke-opacity="0.14" stroke-width="1.5"/>
    <text x="${n1(mid)}" y="${n1(sp.y + 406)}" text-anchor="middle" font-size="8.5" font-weight="700" letter-spacing="1.8" fill="${f.ink}" opacity="0.7">ANALYSER</text>
    ${grip}
    ${screw(mid, sp.y + sp.h - 38)}
    <path d="${medsPath}" fill="url(#sk-pod)"/>
    <path d="${medsPath}" fill="#fff" opacity="${f.grain}" filter="url(#sk-grain)"/>
    <path d="${medsPath}" fill="none" stroke="url(#sk-edge)" stroke-width="1.5"/>
    <text x="${n1(medMid)}" y="${n1(mp.y + 26)}" text-anchor="middle" font-size="10.5" font-weight="700" letter-spacing="2.4" fill="${f.ink}" opacity="0.9">MEDS</text>
    <rect x="${n1(chute.x - 4)}" y="${n1(chute.y - 4)}" width="${chute.w + 8}" height="${chute.h + 8}" rx="9" fill="url(#sk-metal)" stroke="${f.seam}" stroke-width="1"/>
    <rect x="${n1(chute.x)}" y="${n1(chute.y)}" width="${chute.w}" height="${chute.h}" rx="6" fill="url(#sk-hole)"/>
    <rect x="${n1(mp.x + 14)}" y="${n1(mp.y + 74)}" width="62" height="160" rx="12" fill="#05070a" opacity="0.82"/>
    <rect x="${n1(mp.x + 14.75)}" y="${n1(mp.y + 74.75)}" width="60.5" height="158.5" rx="11.25" fill="none" stroke="#fff" stroke-opacity="0.14" stroke-width="1.5"/>
    <path d="${rr(shell, 30)} ${rr(glass, 18)}" fill="url(#sk-shell)" fill-rule="evenodd"/>
    <path d="${rr(shell, 30)} ${rr(glass, 18)}" fill="#fff" fill-rule="evenodd" opacity="${f.grain}" filter="url(#sk-grain)"/>
    <path d="${rr({ x: shell.x + 0.75, y: shell.y + 0.75, w: shell.w - 1.5, h: shell.h - 1.5 }, 29.25)}" fill="none" stroke="url(#sk-edge)" stroke-width="1.5"/>
    <path d="${rr({ x: glass.x - 1, y: glass.y - 1, w: glass.w + 2, h: glass.h + 2 }, 19)}" fill="none" stroke="#000" stroke-opacity="0.55" stroke-width="2"/>
    <path d="${rr(glass, 18)} ${rr(scr, 12)}" fill="#04060a" fill-rule="evenodd"/>
    <path d="${rr({ x: glass.x + 0.75, y: glass.y + 0.75, w: glass.w - 1.5, h: glass.h - 1.5 }, 17.25)}" fill="none" stroke="#fff" stroke-opacity="0.16" stroke-width="1"/>
    <text x="${n1(shell.x + 28)}" y="${n1(shell.y + 20)}" font-size="13" font-weight="700" letter-spacing="3.4" fill="${f.ink}">AeroNYX</text>
    <circle cx="${n1(shell.x + shell.w / 2)}" cy="${n1(shell.y + 15)}" r="5.5" fill="#05070a" stroke="${f.seam}" stroke-width="1"/>
    <circle cx="${n1(shell.x + shell.w / 2 - 1.4)}" cy="${n1(shell.y + 13.6)}" r="1.4" fill="#fff" opacity="0.5"/>
    <circle cx="${n1(shell.x + shell.w - 30.5)}" cy="${n1(top)}" r="7" fill="${GREEN}" opacity="0.25" filter="url(#sk-blur4)"/>
    <circle cx="${n1(shell.x + shell.w - 30.5)}" cy="${n1(top)}" r="3.6" fill="${GREEN}"/>
    ${screw(shell.x + shell.w - 72, top)}${screw(shell.x + 136, top)}
    <g opacity="0.85" fill="none" stroke="${f.ink}" stroke-width="1.5" stroke-linecap="round"><rect x="${n1(bx)}" y="${n1(by)}" width="15" height="11" rx="2.2"/><path d="M${n1(bx + 21)} ${n1(by + 2.5)}a4.5 4.5 0 0 1 0 6M${n1(bx + 25)} ${n1(by)}a8 8 0 0 1 0 11"/></g>
    <text x="${n1(bx + 36)}" y="${n1(by + 9.5)}" font-size="8.5" font-weight="700" letter-spacing="1.8" fill="${f.ink}" opacity="0.8">BADGE</text>
  </g>
  <g clip-path="url(#sk-inscreen)">
    <path d="${rr({ x: scr.x - 3, y: scr.y - 3, w: scr.w + 6, h: scr.h + 6 }, 15)}" fill="none" stroke="#000" stroke-opacity="0.75" stroke-width="12" filter="url(#sk-blur4)"/>
    <path d="M${n1(scr.x)} ${n1(scr.y)}h${n1(scr.w * 0.62)}L${n1(scr.x + scr.w * 0.3)} ${n1(scr.y + scr.h)}H${n1(scr.x)}z" fill="url(#sk-glare)"/>
  </g>
</svg>`;

  const moving = `
<svg id="sk-move" class="sk" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <clipPath id="sk-slot"><rect x="0" y="-300" width="${n1(sp.x + sp.w + 40)}" height="${n1(slot.cy + 300)}"/><ellipse cx="${n1(slot.cx)}" cy="${n1(slot.cy)}" rx="${slot.rx}" ry="${slot.ry}"/></clipPath>
    <clipPath id="sk-chute"><rect x="${n1(mp.x - 20)}" y="${n1(chute.y + 4)}" width="${n1(mp.w + 40)}" height="400"/></clipPath>
    <linearGradient id="sk-tube" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0.5"/><stop offset="0.25" stop-color="#fff" stop-opacity="0.12"/><stop offset="0.8" stop-color="#fff" stop-opacity="0.08"/><stop offset="1" stop-color="#fff" stop-opacity="0.38"/></linearGradient>
    <filter id="sk-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="5"/></filter>
  </defs>
  <g clip-path="url(#sk-slot)">
    <g id="sk-vial" opacity="0">
      <rect x="-15" y="14" width="30" height="80" rx="13" fill="#0c1018" opacity="0.55"/>
      <rect id="sk-liquid" x="-12" y="40" width="24" height="51" rx="11" fill="${SPECIMEN.blood.liquid}"/>
      <rect x="-15" y="14" width="30" height="80" rx="13" fill="url(#sk-tube)" stroke="#fff" stroke-opacity="0.55" stroke-width="1.2"/>
      <rect x="-9" y="52" width="18" height="20" rx="2" fill="#fff" opacity="0.9"/><path d="M-6 58h12M-6 62h9M-6 66h11" stroke="#30384a" stroke-width="1.2"/>
      <rect id="sk-cap" x="-17" y="0" width="34" height="20" rx="5" fill="${SPECIMEN.blood.cap}"/><rect x="-17" y="0" width="34" height="5" rx="2.5" fill="#fff" opacity="0.3"/>
      <path d="M-13 6v10M-7 6v10M-1 6v10M5 6v10M11 6v10" stroke="#000" stroke-opacity="0.25" stroke-width="1.2"/>
    </g>
  </g>
  <path d="M${n1(slot.cx - slot.rx - 6)} ${n1(slot.cy)}a${slot.rx + 6} ${slot.ry + 5} 0 0 0 ${2 * (slot.rx + 6)} 0l-6 0a${slot.rx} ${slot.ry} 0 0 1 ${-2 * slot.rx} 0z" fill="${f.metal[1]}" stroke="${f.seam}" stroke-width="0.8"/>
  <circle id="sk-ring-glow" cx="${n1(ring.cx)}" cy="${n1(ring.cy)}" r="${ring.r}" fill="none" stroke="${f.accent}" stroke-width="7" opacity="0.3" filter="url(#sk-glow)"/>
  <circle id="sk-ring" cx="${n1(ring.cx)}" cy="${n1(ring.cy)}" r="${ring.r}" fill="none" stroke="${f.accent}" stroke-width="5" stroke-linecap="round"/>
  <g font-weight="700" text-anchor="middle">
    <text id="sk-read-top" x="${n1(mid)}" y="${n1(readout.y + 40)}" font-size="9" letter-spacing="1.2" fill="#a0aabb">READY</text>
    <text id="sk-read-big" x="${n1(mid)}" y="${n1(readout.y + 86)}" font-size="22" fill="#e9edf5"></text>
    <rect x="${n1(mid - 19)}" y="${n1(readout.y + 112)}" width="38" height="5" rx="2.5" fill="#2a3447"/><rect id="sk-read-bar" x="${n1(mid - 19)}" y="${n1(readout.y + 112)}" width="0" height="5" rx="2.5" fill="${f.accent}"/>
  </g>
  <g clip-path="url(#sk-chute)">
    <g id="sk-pill" opacity="0">
      <rect x="-13" y="-6" width="26" height="12" rx="6" fill="#f4f1e8"/><path d="M0 -6h7a6 6 0 0 1 0 12h-7z" fill="#3d7bff"/><rect x="-10" y="-4.4" width="20" height="2.4" rx="1.2" fill="#fff" opacity="0.6"/>
    </g>
  </g>
  <path d="M${n1(cup.x)} ${n1(cup.y)}l5 ${cup.h - 8}a8 8 0 0 0 8 8h${cup.w - 26}a8 8 0 0 0 8-8l5-${cup.h - 8}z" fill="#bcd3ff" fill-opacity="0.16" stroke="#dfe8ff" stroke-opacity="0.75" stroke-width="1.4"/>
  <ellipse cx="${n1(cup.x + cup.w / 2)}" cy="${n1(cup.y)}" rx="${cup.w / 2}" ry="4.5" fill="none" stroke="#fff" stroke-opacity="0.8" stroke-width="1.4"/>
  <path d="M${n1(cup.x + 6)} ${n1(cup.y + 8)}l3.4 ${cup.h - 22}" stroke="#fff" stroke-opacity="0.5" stroke-width="2" stroke-linecap="round"/>
  <circle id="sk-med-glow" cx="${n1(medMid)}" cy="${n1(chute.y + 8)}" r="20" fill="${f.accent}" opacity="0" filter="url(#sk-glow)"/>
</svg>`;
  return { still, moving };
}

const clamp = (t) => Math.max(0, Math.min(1, t));

// Where the tube and the capsule are for a pose. Pure, so it can be checked without a browser.
// pose: { vial: { kind, t, o }, ring: 'idle' | 'busy' | 'done', phase, pill, medGlow }
export function skinPose(parts, pose) {
  const out = { vial: null, pill: null };
  if (pose.vial) {
    const t = clamp(pose.vial.t);
    // Held above the unit and to one side, then lowered until only the cap shows.
    out.vial = { x: parts.slot.cx + (1 - t) * 34, y: -92 + (parts.slot.cy - 4 + 92) * t, turn: (1 - t) * 9, o: pose.vial.o == null ? 1 : pose.vial.o };
  }
  if (pose.pill != null) {
    const t = clamp(pose.pill);
    const fall = Math.min(1, t / 0.7);
    const rest = parts.cup.y + parts.cup.h - 13;
    const start = parts.chute.y + 8;
    // Falls faster as it goes, then settles on the bottom of the cup.
    const bounce = t > 0.7 ? Math.sin(((t - 0.7) / 0.3) * Math.PI) * -5 * (1 - (t - 0.7) / 0.3) : 0;
    out.pill = { x: parts.chute.x + parts.chute.w / 2, y: start + (rest - start) * fall * fall + bounce, turn: fall * 205 - 25 };
  }
  return out;
}

// ---------- in the browser ----------

let parts = null;
let pose = {};
let timers = [];

function box(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

function draw() {
  const $ = (id) => document.getElementById(id);
  if (!parts || !$('sk-move')) return;
  const at = skinPose(parts, pose);
  const vial = $('sk-vial');
  if (at.vial) {
    const kind = SPECIMEN[pose.vial.kind] || SPECIMEN.blood;
    $('sk-liquid').setAttribute('fill', kind.liquid);
    $('sk-cap').setAttribute('fill', kind.cap);
    vial.setAttribute('transform', `translate(${at.vial.x.toFixed(2)} ${at.vial.y.toFixed(2)}) rotate(${at.vial.turn.toFixed(2)})`);
    vial.setAttribute('opacity', at.vial.o);
  } else vial.setAttribute('opacity', 0);
  const mode = pose.ring || 'idle';
  const phase = pose.phase || 0;
  const ring = $('sk-ring');
  const glow = $('sk-ring-glow');
  const colour = mode === 'busy' ? AMBER : mode === 'done' ? GREEN : GRAPHITE.accent;
  const len = 2 * Math.PI * parts.ring.r;
  ring.setAttribute('stroke', colour);
  glow.setAttribute('stroke', colour);
  if (mode === 'busy') {
    ring.setAttribute('stroke-dasharray', `${(len * 0.3).toFixed(1)} ${(len * 0.7).toFixed(1)}`);
    ring.setAttribute('stroke-dashoffset', (-len * phase * 3).toFixed(1));
    glow.setAttribute('opacity', (0.45 + 0.3 * Math.sin(phase * Math.PI * 8)).toFixed(2));
  } else {
    ring.removeAttribute('stroke-dasharray');
    ring.removeAttribute('stroke-dashoffset');
    glow.setAttribute('opacity', mode === 'done' ? 0.7 : 0.3);
  }
  $('sk-read-top').textContent = mode === 'busy' ? 'ANALYSING' : mode === 'done' ? 'DONE' : 'READY';
  $('sk-read-big').textContent = mode === 'busy' ? `${Math.round(phase * 100)}%` : mode === 'done' ? '✓' : '';
  $('sk-read-big').setAttribute('fill', mode === 'done' ? GREEN : '#e9edf5');
  $('sk-read-bar').setAttribute('width', mode === 'busy' ? (38 * phase).toFixed(1) : mode === 'done' ? 38 : 0);
  $('sk-read-bar').setAttribute('fill', mode === 'done' ? GREEN : AMBER);
  const pill = $('sk-pill');
  if (at.pill) {
    pill.setAttribute('transform', `translate(${at.pill.x.toFixed(2)} ${at.pill.y.toFixed(2)}) rotate(${at.pill.turn.toFixed(1)})`);
    pill.setAttribute('opacity', 1);
  } else pill.setAttribute('opacity', 0);
  $('sk-med-glow').setAttribute('opacity', (0.55 * (pose.medGlow || 0)).toFixed(2));
}

// Runs step(u) with u from 0 to 1 over a time, or jumps to the end when motion is unwelcome.
function run(ms, step, done) {
  const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (calm) {
    step(1);
    draw();
    if (done) done();
    return;
  }
  const t0 = performance.now();
  const tick = (now) => {
    const u = clamp((now - t0) / ms);
    step(u);
    draw();
    if (u < 1) window.requestAnimationFrame(tick);
    else if (done) done();
  };
  window.requestAnimationFrame(tick);
}

const ease = (u) => u * u * (3 - 2 * u);
const later = (ms, fn) => { timers.push(window.setTimeout(fn, ms)); };

// A specimen goes in, the analyser runs for as long as the app's own analysis, then it reads "done".
function sampleRun(kind) {
  timers.forEach((t) => window.clearTimeout(t));
  timers = [];
  pose.vial = { kind, t: 0, o: 1 };
  pose.ring = 'idle';
  run(800, (u) => { pose.vial.t = ease(u); }, () => {
    pose.ring = 'busy';
    run(1800, (u) => { pose.phase = u; }, () => {
      pose.ring = 'done';
      draw();
      later(5000, () => {
        run(400, (u) => { if (pose.vial) pose.vial.o = 1 - u; }, () => {
          pose.vial = null;
          pose.ring = 'idle';
          draw();
        });
      });
    });
  });
}

function doseDrop() {
  pose.pill = 0;
  run(1100, (u) => {
    pose.pill = u;
    pose.medGlow = Math.sin(Math.min(1, u * 1.6) * Math.PI);
  }, () => {
    pose.medGlow = 0;
    draw();
    later(6000, () => { pose.pill = null; draw(); });
  });
}

function mount() {
  const root = document.documentElement;
  if (root.dataset.skin === 'film') return; // the film script draws its own
  document.querySelectorAll('#sk-still, #sk-move').forEach((el) => el.remove());
  const holder = document.querySelector('.dv');
  const scr = document.querySelector('.dv-screen');
  const shell = document.querySelector('.dv-case');
  const sample = document.querySelector('.dv-sample');
  const meds = document.querySelector('.dv-meds');
  const shown = holder && root.dataset.device === 'on' && window.getComputedStyle(holder).display !== 'none';
  if (!shown || !scr || !shell || !sample || !meds) {
    root.dataset.skin = 'off';
    parts = null;
    return;
  }
  // Measure with the plain device showing, then draw over it.
  root.dataset.skin = 'off';
  const geo = {
    W: window.innerWidth, H: window.innerHeight, scr: box(scr), shell: box(shell), sample: box(sample), meds: box(meds),
    clips: [...document.querySelectorAll('.dv-clips span')].map((el) => { const b = box(el); return { x: b.x, y: b.y }; }),
  };
  if (geo.scr.w < 200 || geo.scr.h < 200) return;
  const svg = skinMarkup(geo);
  const tmp = document.createElement('div');
  tmp.innerHTML = svg.still + svg.moving;
  [...tmp.children].forEach((el) => holder.appendChild(el));
  parts = skinParts(geo);
  root.dataset.skin = 'on';
  draw();
}

export function initSkin() {
  try {
    mount();
  } catch (err) {
    document.documentElement.dataset.skin = 'off'; // the plain drawing stays
  }
  let wait = 0;
  const again = () => {
    window.clearTimeout(wait);
    wait = window.setTimeout(() => { try { mount(); } catch (err) { document.documentElement.dataset.skin = 'off'; } }, 120);
  };
  window.addEventListener('resize', again);
  document.addEventListener('click', (event) => { if (event.target.closest('[data-device-toggle]')) again(); });
  document.addEventListener('aeronyx:sample', (event) => { if (parts) sampleRun(event.detail && event.detail.kind === 'urine' ? 'urine' : 'blood'); });
  document.addEventListener('aeronyx:dose', () => { if (parts) doseDrop(); });
}
