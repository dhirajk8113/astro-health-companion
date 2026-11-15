// Astro health companion: how long a message takes to cross to Mars today.
//
// AI disclosure: written with an AI coding assistant (Claude). See AI-USE.md.
//
// Positions come from NASA JPL's "Keplerian Elements for Approximate Positions
// of the Major Planets" (Table 1, valid 1800 to 2050):
//   https://ssd.jpl.nasa.gov/planets/approx_pos.html
// JPL states an error of about 25,000 km for Mars with this method, which is
// under a tenth of a light-second. JPL's live Horizons service cannot be
// called from a web page, so the calculation is done here.

const DEG = Math.PI / 180;

// [value at J2000, change per Julian century]. "earth" is the Earth-Moon barycentre.
const ELEMENTS = {
  earth: { a: [1.00000261, 0.00000562], e: [0.01671123, -0.00004392], I: [-0.00001531, -0.01294668], L: [100.46457166, 35999.37244981], peri: [102.93768193, 0.32327364], node: [0, 0] },
  mars: { a: [1.52371034, 0.00001847], e: [0.09339410, 0.00007882], I: [1.84969142, -0.00813131], L: [-4.55343205, 19140.30268499], peri: [-23.94362959, 0.44441088], node: [49.55953891, -0.29257343] },
};

export const AU_KM = 149597870.7;
export const LIGHT_SECONDS_PER_AU = 499.004784;

// Heliocentric position in the J2000 ecliptic plane, in astronomical units.
export function heliocentric(body, date) {
  const el = ELEMENTS[body];
  const T = (date.getTime() / 86400000 + 2440587.5 - 2451545.0) / 36525;
  const v = (k) => el[k][0] + el[k][1] * T;
  const a = v('a');
  const e = v('e');
  const I = v('I') * DEG;
  const node = v('node') * DEG;
  const w = v('peri') * DEG - node;
  const M = ((((v('L') - v('peri')) % 360) + 540) % 360 - 180) * DEG;
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 12; i += 1) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w);
  const sw = Math.sin(w);
  const cO = Math.cos(node);
  const sO = Math.sin(node);
  const cI = Math.cos(I);
  const sI = Math.sin(I);
  return {
    x: (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    y: (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    z: sw * sI * xp + cw * sI * yp,
  };
}

export function earthMarsDistanceAU(date) {
  const e = heliocentric('earth', date);
  const m = heliocentric('mars', date);
  return Math.hypot(m.x - e.x, m.y - e.y, m.z - e.z);
}

// One-way light time from Earth to Mars in seconds on the given date.
export function marsLightSeconds(date) {
  return earthMarsDistanceAU(date) * LIGHT_SECONDS_PER_AU;
}

// "12 minutes 40 seconds", "1 second", "8 seconds".
export function formatDelay(seconds) {
  const s = Math.round(seconds);
  if (s < 60) return `${s} second${s === 1 ? '' : 's'}`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m} minute${m === 1 ? '' : 's'}${rest ? ` ${rest} second${rest === 1 ? '' : 's'}` : ''}`;
}
