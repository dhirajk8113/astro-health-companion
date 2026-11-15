// Aeronyx: the gauge rows on the home screen.
//
// AI disclosure: written with an AI coding assistant (Claude). See AI-USE.md.
//
// Each reading is drawn as a marker on a bar. The green part of the bar is the
// acceptable range, taken from the same limits the status rules use, so the
// picture and the status can never disagree about where the range lies.

// Short name, short unit and the two ends of the bar for each indicator.
const SPEC = {
  hr: { short: 'Heart rate', unit: 'bpm', min: 40, max: 120 },
  bp: { short: 'Blood pressure', unit: 'mmHg', min: 80, max: 150 },
  temp: { short: 'Temperature', unit: '°C', min: 35, max: 39 },
  mass: { short: 'Body mass', unit: 'kg' },
  fitness: { short: 'Fitness', unit: '% of preflight', min: 60, max: 110 },
  glucose: { short: 'Glucose', unit: 'mg/dL', min: 55, max: 125 },
  vitd: { short: 'Vitamin D', unit: 'ng/mL', min: 10, max: 100 },
  potassium: { short: 'Potassium', unit: 'mmol/L', min: 3, max: 5.5 },
  urine_vol: { short: 'Urine volume', unit: 'L', min: 1, max: 3.5 },
  urine_ca: { short: 'Urine calcium', unit: 'mg', min: 100, max: 350 },
  // NASA's career limit is 600 mSv (NASA-STD-3001 V1 4030).
  dose: { short: 'Radiation', unit: 'of 600 mSv', min: 0, max: 700, hi: 600 },
  sleep: { short: 'Sleep', unit: 'hours', min: 4, max: 10 },
  mood: { short: 'Mood', unit: 'of 10', min: 1, max: 10 },
};

const round1 = (n) => Math.round(n * 10) / 10;

// The bar for one indicator. Body mass has no fixed range: its bar is drawn
// around the crew member's own preflight mass, green down to a 5 percent loss.
export function gaugeFor(indicator, baseline) {
  const spec = SPEC[indicator.id] || { short: indicator.name, unit: indicator.unit };
  const band = indicator.chart || {};
  let { min, max } = spec;
  let lo = Number.isFinite(band.lo) ? band.lo : undefined;
  const hi = Number.isFinite(spec.hi) ? spec.hi : (Number.isFinite(band.hi) ? band.hi : undefined);
  if (indicator.id === 'mass' && Number.isFinite(baseline) && baseline > 0) {
    min = baseline * 0.87;
    max = baseline * 1.05;
    lo = baseline * 0.95;
  }
  const drawable = Number.isFinite(min) && Number.isFinite(max) && max > min && (lo !== undefined || hi !== undefined);
  return { short: spec.short, unit: spec.unit, min, max, lo, hi, drawable };
}

function percent(gauge, value) {
  return Math.min(100, Math.max(0, ((value - gauge.min) / (gauge.max - gauge.min)) * 100));
}

// Where the green band and the marker sit, as percentages of the bar's width.
export function gaugePosition(gauge, value) {
  if (!gauge.drawable || !Number.isFinite(value)) return null;
  const left = gauge.lo === undefined ? 0 : percent(gauge, gauge.lo);
  const right = gauge.hi === undefined ? 100 : percent(gauge, gauge.hi);
  return { marker: round1(percent(gauge, value)), bandLeft: round1(left), bandWidth: round1(Math.max(0, right - left)) };
}
