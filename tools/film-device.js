// The AeroNYX concept device as it is drawn for the demo video: the same
// layout as the team's sketch (screen, sample port on the left, medication
// dispenser on the right, attachment points on top), shaded to look like
// hardware. It is a drawing. No hardware exists.
//
// Loaded by tools/film-demo.py into the page being filmed, at 1280 x 720.
// window.__filmDevice.build(finish) draws it; window.__filmDevice.set(state)
// moves the specimen, the pill and the lights for one frame.
//
// AI disclosure: drawn by an AI coding assistant (Claude). The video carries a visible AI mark.
(() => {
  const FINISHES = {
    graphite: {
      name: 'Graphite', bg: ['#252e40', '#05070b'], shell: ['#474e5c', '#2a2f39', '#1c2028'], pod: ['#15181e', '#4a515f', '#2c313b', '#14171c'],
      ink: '#d5dae3', metal: ['#d3d9e3', '#7b8494', '#3d4450'], accent: '#7ea6ff', seam: '#0d0f13', grain: 0.5, brushed: false,
    },
    aluminium: {
      name: 'Aluminium', bg: ['#2b3344', '#06080c'], shell: ['#e6e9ee', '#b9c0ca', '#8c94a1'], pod: ['#7f8793', '#eceff3', '#bfc6cf', '#727a86'],
      ink: '#2b313c', metal: ['#f6f7f9', '#a3abb8', '#5a6270'], accent: '#3d7bff', seam: '#5b626e', grain: 0.75, brushed: true,
    },
    white: {
      name: 'White', bg: ['#3a4457', '#0a0d13'], shell: ['#fbfbfc', '#e6e9ee', '#c6ccd6'], pod: ['#b9bfc9', '#ffffff', '#e9ecf0', '#b0b7c2'],
      ink: '#414a59', metal: ['#eef0f4', '#a0a8b5', '#5d6573'], accent: '#ff8a3d', seam: '#9aa2ae', grain: 0.3, brushed: false,
    },
  };
  // Where the app puts its screen and side units at 1280 x 720.
  const SCR = { x: 114, y: 74, w: 1052, h: 598, r: 12 };
  const CASE = { x: 96, y: 34, w: 1088, h: 668, r: 30 };
  const SP = { x: 18, y: 60, w: 90, h: 618 };
  const MP = { x: 1172, y: 388, w: 90, h: 250 };
  const rr = (b, r) => `M${b.x + r} ${b.y}h${b.w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${b.h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(b.w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(b.h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;
  const GLASS = { x: 106, y: 64, w: 1068, h: 618, r: 18 };
  const SLOT = { cx: 63, cy: 112, rx: 27, ry: 10 };
  const RING = { cx: 63, cy: 196, r: 21 };
  const CUP = { x: 1193, y: 548, w: 48, h: 62 };
  const CHUTE = { x: 1190, y: 428, w: 54, h: 16 };

  function build(finishName) {
    const f = FINISHES[finishName] || FINISHES.graphite;
    document.querySelectorAll('#f-dev, #f-dev-move, #f-dev-style').forEach((el) => el.remove());
    const style = document.createElement('style');
    style.id = 'f-dev-style';
    style.textContent = `
      .dv-case, .dv-screen, .dv-pod, .dv-clips, .dv-brand, .dv-led, .dv-chin { visibility: hidden !important; }
      #f-dev, #f-dev-move { position: fixed; left: 0; top: 0; width: 1280px; height: 720px; pointer-events: none; }
      #f-dev { z-index: 60; will-change: transform; }
      #f-dev-move { z-index: 61; }
      #f-dev text, #f-dev-move text { font-family: Inter, system-ui, sans-serif; }
    `;
    document.head.appendChild(style);
    const clipXs = [211, 479.7, 748.3, 1017];
    const clips = clipXs.map((x) => `
      <path d="M${x} 40V20a8 8 0 0 1 8-8h36a8 8 0 0 1 8 8v20z" fill="url(#fd-metal)" stroke="${f.seam}" stroke-width="1"/>
      <rect x="${x + 4}" y="15" width="44" height="3" rx="1.5" fill="#fff" opacity="0.35"/>
      <circle cx="${x + 26}" cy="27" r="6.5" fill="${f.metal[2]}" stroke="${f.seam}" stroke-width="1"/>
      <circle cx="${x + 26}" cy="27" r="3" fill="#05070a"/>`).join('');
    const screw = (x, y) => `<circle cx="${x}" cy="${y}" r="4.2" fill="url(#fd-metal)" stroke="${f.seam}" stroke-width="0.8"/><path d="M${x - 2.6} ${y - 1.6}l5.2 3.2" stroke="${f.metal[2]}" stroke-width="1.2" stroke-linecap="round"/>`;
    const grille = Array.from({ length: 13 }, (_, k) => `<circle cx="${592 + k * 8}" cy="692" r="1.7" fill="${f.seam}"/>`).join('');
    const grip = Array.from({ length: 9 }, (_, k) => `<rect x="38" y="${520 + k * 9}" width="50" height="3.4" rx="1.7" fill="${f.seam}" opacity="0.55"/><rect x="38" y="${523.4 + k * 9}" width="50" height="1" rx="0.5" fill="#fff" opacity="0.12"/>`).join('');
    const medsPath = `M${MP.x} ${MP.y + 14}a14 14 0 0 1 14-14h36a40 40 0 0 1 40 40v${MP.h - 80}a40 40 0 0 1-40 40h-36a14 14 0 0 1-14-14z`;
    const svg = `
<svg id="f-dev" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="fd-bg" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="${f.bg[0]}"/><stop offset="1" stop-color="${f.bg[1]}"/></radialGradient>
    <linearGradient id="fd-shell" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${f.shell[0]}"/><stop offset="0.5" stop-color="${f.shell[1]}"/><stop offset="1" stop-color="${f.shell[2]}"/></linearGradient>
    <linearGradient id="fd-pod" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${f.pod[0]}"/><stop offset="0.3" stop-color="${f.pod[1]}"/><stop offset="0.62" stop-color="${f.pod[2]}"/><stop offset="1" stop-color="${f.pod[3]}"/></linearGradient>
    <linearGradient id="fd-metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${f.metal[0]}"/><stop offset="0.55" stop-color="${f.metal[1]}"/><stop offset="1" stop-color="${f.metal[2]}"/></linearGradient>
    <linearGradient id="fd-edge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.75"/><stop offset="0.35" stop-color="#fff" stop-opacity="0.05"/><stop offset="0.7" stop-color="#000" stop-opacity="0.1"/><stop offset="1" stop-color="#000" stop-opacity="0.6"/></linearGradient>
    <linearGradient id="fd-glare" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.09"/><stop offset="0.45" stop-color="#fff" stop-opacity="0.015"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <radialGradient id="fd-hole" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="#000"/><stop offset="0.75" stop-color="#05070a"/><stop offset="1" stop-color="#1b1f27"/></radialGradient>
    <filter id="fd-blur28" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="26"/></filter>
    <filter id="fd-blur4" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="4"/></filter>
    <filter id="fd-grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="${f.brushed ? '0.9 0.012' : '0.85'}" numOctaves="2" seed="7" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0.33 0.33 0.33 0 -0.28"/>
      <feComposite in2="SourceGraphic" operator="in"/>
    </filter>
    <mask id="fd-noscreen"><rect width="1280" height="720" fill="#fff"/><path d="${rr(SCR, SCR.r)}" fill="#000"/></mask>
    <clipPath id="fd-inscreen"><path d="${rr(SCR, SCR.r)}"/></clipPath>
  </defs>
  <g mask="url(#fd-noscreen)">
    <rect width="1280" height="720" fill="url(#fd-bg)"/>
    <!-- the shadow the device throws on the wall behind it -->
    <rect x="30" y="70" width="1230" height="640" rx="60" fill="#000" opacity="0.6" filter="url(#fd-blur28)"/>
    ${clips}
    <!-- sample unit -->
    <rect x="${SP.x}" y="${SP.y}" width="${SP.w}" height="${SP.h}" rx="45" fill="url(#fd-pod)"/>
    <rect x="${SP.x}" y="${SP.y}" width="${SP.w}" height="${SP.h}" rx="45" fill="#fff" opacity="${f.grain}" filter="url(#fd-grain)"/>
    <rect x="${SP.x + 0.75}" y="${SP.y + 0.75}" width="${SP.w - 1.5}" height="${SP.h - 1.5}" rx="44.25" fill="none" stroke="url(#fd-edge)" stroke-width="1.5"/>
    <ellipse cx="${SLOT.cx}" cy="${SLOT.cy}" rx="${SLOT.rx + 6}" ry="${SLOT.ry + 5}" fill="url(#fd-metal)" stroke="${f.seam}" stroke-width="1"/>
    <ellipse cx="${SLOT.cx}" cy="${SLOT.cy}" rx="${SLOT.rx}" ry="${SLOT.ry}" fill="url(#fd-hole)"/>
    <text x="63" y="150" text-anchor="middle" font-size="10.5" font-weight="700" letter-spacing="2.4" fill="${f.ink}" opacity="0.9">SAMPLE</text>
    <circle cx="${RING.cx}" cy="${RING.cy}" r="${RING.r + 7}" fill="${f.seam}" opacity="0.85"/>
    <circle cx="${RING.cx}" cy="${RING.cy}" r="${RING.r - 7}" fill="url(#fd-hole)"/>
    <path d="M24 262h78M24 486h78" stroke="${f.seam}" stroke-width="1.6" opacity="0.8"/><path d="M24 263.6h78M24 487.6h78" stroke="#fff" stroke-width="0.8" opacity="0.18"/>
    <rect x="36" y="292" width="54" height="150" rx="10" fill="#05070a" opacity="0.9"/><rect x="36.75" y="292.75" width="52.5" height="148.5" rx="9.25" fill="none" stroke="#fff" stroke-opacity="0.14" stroke-width="1.5"/>
    <text x="63" y="466" text-anchor="middle" font-size="8.5" font-weight="700" letter-spacing="1.8" fill="${f.ink}" opacity="0.7">ANALYSER</text>
    ${grip}
    ${screw(63, 640)}
    <!-- medication dispenser -->
    <path d="${medsPath}" fill="url(#fd-pod)"/>
    <path d="${medsPath}" fill="#fff" opacity="${f.grain}" filter="url(#fd-grain)"/>
    <path d="${medsPath}" fill="none" stroke="url(#fd-edge)" stroke-width="1.5"/>
    <text x="1217" y="414" text-anchor="middle" font-size="10.5" font-weight="700" letter-spacing="2.4" fill="${f.ink}" opacity="0.9">MEDS</text>
    <rect x="${CHUTE.x - 4}" y="${CHUTE.y - 4}" width="${CHUTE.w + 8}" height="${CHUTE.h + 8}" rx="9" fill="url(#fd-metal)" stroke="${f.seam}" stroke-width="1"/>
    <rect x="${CHUTE.x}" y="${CHUTE.y}" width="${CHUTE.w}" height="${CHUTE.h}" rx="6" fill="url(#fd-hole)"/>
    <rect x="1186" y="462" width="62" height="160" rx="12" fill="#05070a" opacity="0.82"/><rect x="1186.75" y="462.75" width="60.5" height="158.5" rx="11.25" fill="none" stroke="#fff" stroke-opacity="0.14" stroke-width="1.5"/>
    <!-- the casing -->
    <path d="${rr(CASE, CASE.r)} ${rr(GLASS, GLASS.r)}" fill="url(#fd-shell)" fill-rule="evenodd"/>
    <path d="${rr(CASE, CASE.r)} ${rr(GLASS, GLASS.r)}" fill="#fff" fill-rule="evenodd" opacity="${f.grain}" filter="url(#fd-grain)"/>
    <path d="${rr({ x: CASE.x + 0.75, y: CASE.y + 0.75, w: CASE.w - 1.5, h: CASE.h - 1.5 }, CASE.r - 0.75)}" fill="none" stroke="url(#fd-edge)" stroke-width="1.5"/>
    <path d="${rr({ x: GLASS.x - 1, y: GLASS.y - 1, w: GLASS.w + 2, h: GLASS.h + 2 }, GLASS.r + 1)}" fill="none" stroke="#000" stroke-opacity="0.55" stroke-width="2"/>
    <!-- black glass around the display -->
    <path d="${rr(GLASS, GLASS.r)} ${rr(SCR, SCR.r)}" fill="#04060a" fill-rule="evenodd"/>
    <path d="${rr({ x: GLASS.x + 0.75, y: GLASS.y + 0.75, w: GLASS.w - 1.5, h: GLASS.h - 1.5 }, GLASS.r - 0.75)}" fill="none" stroke="#fff" stroke-opacity="0.16" stroke-width="1"/>
    <text x="124" y="54" font-size="13" font-weight="700" letter-spacing="3.4" fill="${f.ink}">AeroNYX</text>
    <circle cx="640" cy="49" r="5.5" fill="#05070a" stroke="${f.seam}" stroke-width="1"/><circle cx="638.6" cy="47.6" r="1.4" fill="#fff" opacity="0.5"/>
    <circle cx="1153.5" cy="49.5" r="7" fill="#6fd596" opacity="0.25" filter="url(#fd-blur4)"/><circle cx="1153.5" cy="49.5" r="3.6" fill="#6fd596"/>
    ${screw(1112, 49.5)}${screw(232, 49.5)}
    ${grille}
    <g opacity="0.85" fill="none" stroke="${f.ink}" stroke-width="1.5" stroke-linecap="round"><rect x="1096" y="686" width="15" height="11" rx="2.2"/><path d="M1117 688.5a4.5 4.5 0 0 1 0 6M1121 686a8 8 0 0 1 0 11"/></g>
    <text x="1132" y="695.5" font-size="8.5" font-weight="700" letter-spacing="1.8" fill="${f.ink}" opacity="0.8">BADGE</text>
  </g>
  <!-- the display sits a little below the glass: a soft shadow along its edges, and a faint reflection -->
  <g clip-path="url(#fd-inscreen)">
    <path d="${rr({ x: SCR.x - 3, y: SCR.y - 3, w: SCR.w + 6, h: SCR.h + 6 }, SCR.r + 3)}" fill="none" stroke="#000" stroke-opacity="0.75" stroke-width="12" filter="url(#fd-blur4)"/>
    <path d="M${SCR.x} ${SCR.y}h${SCR.w * 0.62}L${SCR.x + SCR.w * 0.3} ${SCR.y + SCR.h}H${SCR.x}z" fill="url(#fd-glare)"/>
  </g>
</svg>
<svg id="f-dev-move" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <clipPath id="fm-slot"><rect x="0" y="-300" width="140" height="${SLOT.cy + 300}"/><ellipse cx="${SLOT.cx}" cy="${SLOT.cy}" rx="${SLOT.rx}" ry="${SLOT.ry}"/></clipPath>
    <clipPath id="fm-chute"><rect x="1150" y="${CHUTE.y + 4}" width="130" height="400"/></clipPath>
    <linearGradient id="fm-glass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0.5"/><stop offset="0.25" stop-color="#fff" stop-opacity="0.12"/><stop offset="0.8" stop-color="#fff" stop-opacity="0.08"/><stop offset="1" stop-color="#fff" stop-opacity="0.38"/></linearGradient>
    <filter id="fm-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="5"/></filter>
    <filter id="fm-shadow" x="-50%" y="-20%" width="200%" height="150%"><feGaussianBlur stdDeviation="5"/></filter>
  </defs>
  <!-- the specimen tube, clipped where it passes into the port -->
  <g clip-path="url(#fm-slot)">
    <g id="fm-vial" opacity="0">
      <rect x="-13" y="6" width="34" height="88" rx="12" fill="#000" opacity="0.35" filter="url(#fm-shadow)"/>
      <rect x="-15" y="14" width="30" height="80" rx="13" fill="#0c1018" opacity="0.55"/>
      <rect id="fm-liquid" x="-12" y="40" width="24" height="51" rx="11" fill="#b3202f"/>
      <rect x="-15" y="14" width="30" height="80" rx="13" fill="url(#fm-glass)" stroke="#fff" stroke-opacity="0.55" stroke-width="1.2"/>
      <rect x="-9" y="52" width="18" height="20" rx="2" fill="#fff" opacity="0.9"/><path d="M-6 58h12M-6 62h9M-6 66h11" stroke="#30384a" stroke-width="1.2"/>
      <rect id="fm-cap" x="-17" y="0" width="34" height="20" rx="5" fill="#7a2bbf"/><rect x="-17" y="0" width="34" height="5" rx="2.5" fill="#fff" opacity="0.3"/>
      <path d="M-13 6v10M-7 6v10M-1 6v10M5 6v10M11 6v10" stroke="#000" stroke-opacity="0.25" stroke-width="1.2"/>
    </g>
  </g>
  <!-- the near lip of the port, in front of the tube -->
  <path d="M${SLOT.cx - SLOT.rx - 6} ${SLOT.cy}a${SLOT.rx + 6} ${SLOT.ry + 5} 0 0 0 ${2 * (SLOT.rx + 6)} 0l-6 0a${SLOT.rx} ${SLOT.ry} 0 0 1 ${-2 * SLOT.rx} 0z" fill="${f.metal[1]}" stroke="${f.seam}" stroke-width="0.8"/>
  <!-- status ring on the sample unit -->
  <circle id="fm-ring-glow" cx="${RING.cx}" cy="${RING.cy}" r="${RING.r}" fill="none" stroke="${f.accent}" stroke-width="7" opacity="0.35" filter="url(#fm-glow)"/>
  <circle id="fm-ring" cx="${RING.cx}" cy="${RING.cy}" r="${RING.r}" fill="none" stroke="${f.accent}" stroke-width="5" stroke-linecap="round"/>
  <g id="fm-screen" font-weight="700" text-anchor="middle">
    <text id="fm-screen-top" x="63" y="332" font-size="9" letter-spacing="1.2" fill="#a0aabb">READY</text>
    <text id="fm-screen-big" x="63" y="378" font-size="22" fill="#e9edf5"></text>
    <rect x="44" y="404" width="38" height="5" rx="2.5" fill="#2a3447"/><rect id="fm-screen-bar" x="44" y="404" width="0" height="5" rx="2.5" fill="${f.accent}"/>
  </g>
  <!-- the dispensed capsule, and the cup it lands in -->
  <g clip-path="url(#fm-chute)">
    <g id="fm-pill" opacity="0">
      <rect x="-13" y="-6" width="26" height="12" rx="6" fill="#f4f1e8"/><path d="M0 -6h7a6 6 0 0 1 0 12h-7z" fill="#3d7bff"/><rect x="-10" y="-4.4" width="20" height="2.4" rx="1.2" fill="#fff" opacity="0.6"/>
    </g>
  </g>
  <path d="M${CUP.x} ${CUP.y}l5 ${CUP.h - 8}a8 8 0 0 0 8 8h${CUP.w - 26}a8 8 0 0 0 8-8l5-${CUP.h - 8}z" fill="#bcd3ff" fill-opacity="0.16" stroke="#dfe8ff" stroke-opacity="0.75" stroke-width="1.4"/>
  <ellipse cx="${CUP.x + CUP.w / 2}" cy="${CUP.y}" rx="${CUP.w / 2}" ry="4.5" fill="none" stroke="#fff" stroke-opacity="0.8" stroke-width="1.4"/>
  <path d="M${CUP.x + 6} ${CUP.y + 8}l3.4 ${CUP.h - 22}" stroke="#fff" stroke-opacity="0.5" stroke-width="2" stroke-linecap="round"/>
  <circle id="fm-med-glow" cx="1217" cy="${CHUTE.y + 8}" r="20" fill="${f.accent}" opacity="0" filter="url(#fm-glow)"/>
</svg>`;
    const holder = document.createElement('div');
    holder.innerHTML = svg;
    [...holder.children].forEach((el) => document.body.appendChild(el));
    set({});
    return f.name;
  }

  const SPECIMEN = { blood: { liquid: '#b3202f', cap: '#7a2bbf' }, urine: { liquid: '#e2b93b', cap: '#e8c23a' } };
  const AMBER = '#f3c06b';
  const GREEN = '#6fd596';

  // One frame of the moving parts.
  // vial: { kind, t } with t from 0 (held above the port) to 1 (seated); ring: 'idle' | 'busy' | 'done' with phase 0..1;
  // pill: t from 0 (in the chute) to 1 (at rest in the cup), or null; medGlow: 0..1.
  function set(s) {
    const $ = (id) => document.getElementById(id);
    if (!$('f-dev-move')) return;
    const vial = $('fm-vial');
    if (s.vial) {
      const kind = SPECIMEN[s.vial.kind] || SPECIMEN.blood;
      $('fm-liquid').setAttribute('fill', kind.liquid);
      $('fm-cap').setAttribute('fill', kind.cap);
      const t = Math.max(0, Math.min(1, s.vial.t));
      // held above the unit, then lowered until only the cap shows
      const y = -92 + (SLOT.cy - 4 + 92) * t;
      const x = SLOT.cx + (1 - t) * 34;
      vial.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${((1 - t) * 9).toFixed(2)})`);
      vial.setAttribute('opacity', s.vial.o == null ? 1 : s.vial.o);
    } else vial.setAttribute('opacity', 0);
    const mode = s.ring || 'idle';
    const ring = $('fm-ring');
    const glow = $('fm-ring-glow');
    const len = 2 * Math.PI * RING.r;
    const base = ring.dataset.base || (ring.dataset.base = ring.getAttribute('stroke'));
    const colour = mode === 'busy' ? AMBER : mode === 'done' ? GREEN : base;
    ring.setAttribute('stroke', colour);
    glow.setAttribute('stroke', colour);
    const phase = s.phase || 0;
    if (mode === 'busy') {
      ring.setAttribute('stroke-dasharray', `${(len * 0.3).toFixed(1)} ${(len * 0.7).toFixed(1)}`);
      ring.setAttribute('stroke-dashoffset', (-len * phase * 3).toFixed(1));
      glow.setAttribute('opacity', (0.45 + 0.3 * Math.sin(phase * Math.PI * 8)).toFixed(2));
    } else {
      ring.removeAttribute('stroke-dasharray');
      ring.removeAttribute('stroke-dashoffset');
      glow.setAttribute('opacity', mode === 'done' ? 0.7 : 0.3);
    }
    $('fm-screen-top').textContent = mode === 'busy' ? 'ANALYSING' : mode === 'done' ? 'DONE' : 'READY';
    $('fm-screen-big').textContent = mode === 'busy' ? `${Math.round(phase * 100)}%` : mode === 'done' ? '✓' : '';
    $('fm-screen-big').setAttribute('fill', mode === 'done' ? GREEN : '#e9edf5');
    $('fm-screen-bar').setAttribute('width', mode === 'busy' ? (38 * phase).toFixed(1) : mode === 'done' ? 38 : 0);
    $('fm-screen-bar').setAttribute('fill', mode === 'done' ? GREEN : AMBER);
    const pill = $('fm-pill');
    if (s.pill != null) {
      const t = Math.max(0, Math.min(1, s.pill));
      // falls under gravity, then settles on the bottom of the cup
      const fall = Math.min(1, t / 0.7);
      const y = CHUTE.y + 8 + (CUP.y + CUP.h - 13 - CHUTE.y - 8) * fall * fall;
      const settle = t > 0.7 ? Math.sin(((t - 0.7) / 0.3) * Math.PI) * -5 * (1 - (t - 0.7) / 0.3) : 0;
      pill.setAttribute('transform', `translate(1217 ${(y + settle).toFixed(2)}) rotate(${(fall * 205 - 25).toFixed(1)})`);
      pill.setAttribute('opacity', 1);
    } else pill.setAttribute('opacity', 0);
    $('fm-med-glow').setAttribute('opacity', (0.55 * (s.medGlow || 0)).toFixed(2));
  }

  window.__filmDevice = { build, set, finishes: Object.keys(FINISHES) };
})();
