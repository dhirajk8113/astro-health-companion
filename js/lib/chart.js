// AeroNYX: a small SVG line chart with no dependencies.
//
// AI disclosure: written with an AI coding assistant (Claude). See AI-USE.md.

const W = 640;
const H = 200;
const PAD = { l: 46, r: 14, t: 14, b: 26 };

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function niceStep(span) {
  const raw = span / 4;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const norm = raw / mag;
  let step = 10;
  if (norm <= 1) step = 1;
  else if (norm <= 2) step = 2;
  else if (norm <= 5) step = 5;
  return step * mag;
}

// readings: [{ t, value, value2? }] sorted by time.
// opts: { band: {lo?, hi?}, baseline, unit, name, markAt (ISO), markLabel }
export function lineChart(readings, opts = {}) {
  if (!readings.length) {
    return '<p class="muted">No readings yet.</p>';
  }
  const times = readings.map((r) => new Date(r.t).getTime());
  const values = readings.flatMap((r) => (Number.isFinite(r.value2) ? [r.value, r.value2] : [r.value]));
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (Number.isFinite(opts.baseline)) {
    lo = Math.min(lo, opts.baseline);
    hi = Math.max(hi, opts.baseline);
  }
  if (opts.band) {
    // Stretch the scale to a band edge only when it is close to the data. A far
    // edge (vitamin D's upper bound of 90, say) would flatten the line, so the
    // band is clipped at the plot edge instead. A band may have one open side.
    const span = Math.max(hi - lo, Math.abs(hi) * 0.05, 1e-9);
    const near = (v) => Number.isFinite(v) && v >= lo - span * 1.5 && v <= hi + span * 1.5;
    const bandLo = opts.band.lo;
    const bandHi = opts.band.hi;
    if (near(bandLo)) lo = Math.min(lo, bandLo);
    if (near(bandHi)) hi = Math.max(hi, bandHi);
  }
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const padY = (hi - lo) * 0.08;
  lo -= padY;
  hi += padY;
  const t0 = times[0];
  const t1 = times[times.length - 1] === t0 ? t0 + 1 : times[times.length - 1];
  const x = (t) => PAD.l + ((t - t0) / (t1 - t0)) * (W - PAD.l - PAD.r);
  const y = (v) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);

  const parts = [];
  parts.push(`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.name || 'Readings')} over time, ${readings.length} readings">`);

  if (opts.band) {
    const top = y(Number.isFinite(opts.band.hi) ? Math.max(lo, Math.min(hi, opts.band.hi)) : hi);
    const bottom = y(Number.isFinite(opts.band.lo) ? Math.min(hi, Math.max(lo, opts.band.lo)) : lo);
    parts.push(`<rect class="chart-band" x="${PAD.l}" y="${top.toFixed(1)}" width="${W - PAD.l - PAD.r}" height="${Math.max(0, bottom - top).toFixed(1)}"></rect>`);
  }

  const step = niceStep(hi - lo);
  const first = Math.ceil(lo / step) * step;
  for (let v = first; v <= hi; v += step) {
    const yy = y(v).toFixed(1);
    const label = Math.abs(step) < 1 ? v.toFixed(1) : String(Math.round(v));
    parts.push(`<line class="chart-grid" x1="${PAD.l}" x2="${W - PAD.r}" y1="${yy}" y2="${yy}"></line>`);
    parts.push(`<text class="chart-tick" x="${PAD.l - 6}" y="${yy}" text-anchor="end" dominant-baseline="middle">${esc(label)}</text>`);
  }

  if (Number.isFinite(opts.baseline)) {
    const yy = y(opts.baseline).toFixed(1);
    parts.push(`<line class="chart-baseline" x1="${PAD.l}" x2="${W - PAD.r}" y1="${yy}" y2="${yy}"></line>`);
    parts.push(`<text class="chart-note" x="${W - PAD.r}" y="${(Number(yy) - 5).toFixed(1)}" text-anchor="end">your baseline</text>`);
  }

  if (opts.markAt) {
    const mt = new Date(opts.markAt).getTime();
    if (mt >= t0 && mt <= t1) {
      const xx = x(mt).toFixed(1);
      parts.push(`<line class="chart-mark" x1="${xx}" x2="${xx}" y1="${PAD.t}" y2="${H - PAD.b}"></line>`);
      parts.push(`<text class="chart-note" x="${(Number(xx) + 5).toFixed(1)}" y="${PAD.t + 10}">${esc(opts.markLabel || 'started')}</text>`);
    }
  }

  const path = (key) => readings
    .filter((r) => Number.isFinite(r[key]))
    .map((r, i) => `${i ? 'L' : 'M'}${x(new Date(r.t).getTime()).toFixed(1)},${y(r[key]).toFixed(1)}`)
    .join(' ');
  parts.push(`<path class="chart-line" d="${path('value')}"></path>`);
  if (readings.some((r) => Number.isFinite(r.value2))) {
    parts.push(`<path class="chart-line chart-line-2" d="${path('value2')}"></path>`);
  }
  const showDots = readings.length <= 40;
  if (showDots) {
    for (const r of readings) {
      parts.push(`<circle class="chart-dot" cx="${x(new Date(r.t).getTime()).toFixed(1)}" cy="${y(r.value).toFixed(1)}" r="3"></circle>`);
    }
  }

  const fmt = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  parts.push(`<text class="chart-tick" x="${PAD.l}" y="${H - 6}">${esc(fmt(t0))}</text>`);
  parts.push(`<text class="chart-tick" x="${W - PAD.r}" y="${H - 6}" text-anchor="end">${esc(fmt(t1))}</text>`);
  parts.push('</svg>');
  return parts.join('');
}
