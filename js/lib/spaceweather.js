// Aeronyx: space weather events from NASA DONKI.
//
// AI disclosure: written with an AI coding assistant (Claude). See AI-USE.md.
//
// DONKI is NASA's Space Weather Database Of Notifications, Knowledge,
// Information, run by the Community Coordinated Modeling Center. Its web
// service needs no key and can be read straight from a web page.
// DONKI reports that an event happened and which instrument saw it. It
// carries no dose, so Astro never turns an event into a dose figure.

export const DONKI_BASE = 'https://ccmc.gsfc.nasa.gov/DONKI/WS/get/';

const FLARE_SCALE = { A: 1e-8, B: 1e-7, C: 1e-6, M: 1e-5, X: 1e-4 };

// "X5.8" -> a number that sorts flares by strength.
export function flareStrength(cls) {
  const m = /^([ABCMX])(\d+(\.\d+)?)/.exec(cls || '');
  return m ? FLARE_SCALE[m[1]] * parseFloat(m[2]) : 0;
}

// Turns the three DONKI responses into the small shape Astro uses.
export function normaliseDonki({ sep = [], flr = [], gst = [] }) {
  return {
    sep: sep.map((e) => ({ t: e.eventTime, inst: (e.instruments || []).map((i) => i.displayName).join('; ') })),
    flareCount: flr.length,
    flares: flr.map((f) => ({ t: f.peakTime || f.beginTime, c: f.classType })),
    storms: gst.map((g) => ({ t: g.startTime, kp: Math.max(0, ...(g.allKpIndex || []).map((k) => k.kpIndex)) })),
  };
}

// A model forecast is not a detection, so it never raises an alert.
export const isMeasured = (event) => !/^MODEL/i.test(event.inst || '');

export function summarise(data, nowMs, alertHours = 72) {
  const measured = (data.sep || []).filter(isMeasured);
  const past = measured.filter((e) => Date.parse(e.t) <= nowMs).sort((a, b) => Date.parse(b.t) - Date.parse(a.t));
  const latest = past[0] || null;
  const hoursAgo = latest ? (nowMs - Date.parse(latest.t)) / 3.6e6 : null;
  const strongest = (data.flares || []).reduce((best, f) => (flareStrength(f.c) > flareStrength(best ? best.c : '') ? f : best), null);
  const topStorm = (data.storms || []).reduce((best, s) => (!best || s.kp > best.kp ? s : best), null);
  return {
    particleEvents: measured.length,
    flareCount: data.flareCount == null ? (data.flares || []).length : data.flareCount,
    strongestFlare: strongest,
    stormCount: (data.storms || []).length,
    topStorm,
    latestParticleEvent: latest,
    alert: latest && hoursAgo <= alertHours ? { event: latest, hoursAgo } : null,
  };
}

const day = (ms) => new Date(ms).toISOString().slice(0, 10);

// Reads the last `days` days from DONKI. Rejects on any failure or after 10 s.
export async function fetchDonki(nowMs = Date.now(), days = 30, fetchImpl = fetch) {
  const range = `?startDate=${day(nowMs - days * 864e5)}&endDate=${day(nowMs)}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 10000);
  try {
    const get = async (type) => {
      const res = await fetchImpl(`${DONKI_BASE}${type}${range}`, { signal: ctl.signal });
      if (!res.ok) throw new Error(`DONKI ${type} answered ${res.status}`);
      const text = await res.text();
      return text ? JSON.parse(text) : [];
    };
    const [sep, flr, gst] = await Promise.all([get('SEP'), get('FLR'), get('GST')]);
    return { ...normaliseDonki({ sep, flr, gst }), range: [day(nowMs - days * 864e5), day(nowMs)] };
  } finally {
    clearTimeout(timer);
  }
}
