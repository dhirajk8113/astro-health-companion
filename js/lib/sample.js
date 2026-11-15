// AeroNYX: the sample submitter's simulated run.
//
// AI disclosure: written with an AI coding assistant (Claude). See AI-USE.md.
//
// No analyser is connected. A run produces one value per indicator in the
// panel, within three percent of that indicator's last reading, so the demo
// can show a sample going in and results coming out. Every value is logged as
// simulated.

import { getIndicator } from '../data/indicators.js';
import { readingsFor } from './assess.js';
import { gaugeFor } from './gauge.js';

export const PANELS = {
  blood: { label: 'Blood sample', detail: 'Finger-stick: glucose, vitamin D, potassium', ids: ['glucose', 'vitd', 'potassium'] },
  urine: { label: '24-hour urine collection', detail: 'Volume and calcium', ids: ['urine_vol', 'urine_ca'] },
};

// A small repeatable random number, so a test can fix the seed.
function generator(seed) {
  let x = (seed >>> 0) || 1;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x / 4294967296;
  };
}

export function simulateSample(kind, state, seed) {
  const panel = PANELS[kind];
  if (!panel) return [];
  const next = generator(seed);
  return panel.ids.map((id) => {
    const indicator = getIndicator(id);
    const list = readingsFor(state.readings, id);
    const gauge = gaugeFor(indicator);
    const last = list.length
      ? Number(list[list.length - 1].value)
      : ((gauge.lo ?? gauge.min) + (gauge.hi ?? gauge.max)) / 2;
    const step = indicator.input.step || 1;
    const raw = last * (1 + (next() - 0.5) * 0.06);
    const inside = Math.min(indicator.input.max, Math.max(indicator.input.min, raw));
    return { indicatorId: id, value: Number((Math.round(inside / step) * step).toFixed(4)) };
  });
}
