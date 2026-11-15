// AeroNYX: assessment logic.
//
// AI disclosure: written with an AI coding assistant (Claude). See AI-USE.md.
//
// Everything in this file is a fixed, readable rule. Astro compares a reading
// with a reference band and with the crew member's own baseline, and says when
// to involve a person. It does not diagnose.

import { STATUS, INDICATORS, getIndicator } from '../data/indicators.js';

const RANK = { [STATUS.OK]: 0, [STATUS.WATCH]: 1, [STATUS.ATTENTION]: 2 };
const DAY_MS = 24 * 60 * 60 * 1000;

export function worst(a, b) {
  return RANK[a] >= RANK[b] ? a : b;
}

function matches(rule, v) {
  if (rule.lt !== undefined && !(v < rule.lt)) return false;
  if (rule.lte !== undefined && !(v <= rule.lte)) return false;
  if (rule.gt !== undefined && !(v > rule.gt)) return false;
  if (rule.gte !== undefined && !(v >= rule.gte)) return false;
  return true;
}

function applyRules(rules, v) {
  for (const rule of rules || []) {
    if (matches(rule, v)) return { status: rule.status, label: rule.label };
  }
  return { status: STATUS.OK, label: 'within the reference range' };
}

// Status from the reference band alone.
export function classify(indicator, value, value2) {
  if (!Number.isFinite(value)) throw new Error('A reading needs a number.');
  const first = applyRules(indicator.rules, value);
  if (!indicator.pair) return first;
  if (!Number.isFinite(value2)) throw new Error(`${indicator.name} needs two numbers.`);
  const second = applyRules(indicator.rules2, value2);
  if (RANK[second.status] > RANK[first.status]) return second;
  return first;
}

// Change from the crew member's own baseline.
export function baselineDelta(indicator, value, baseline) {
  if (!Number.isFinite(baseline) || !Number.isFinite(value)) return null;
  const abs = value - baseline;
  const pct = baseline === 0 ? null : (abs / baseline) * 100;
  let status = STATUS.OK;
  const cfg = indicator.baseline;
  if (cfg) {
    const measure = cfg.mode === 'pct' ? pct : abs;
    if (measure !== null) {
      let size;
      if (cfg.direction === 'down') size = -measure;
      else if (cfg.direction === 'up') size = measure;
      else size = Math.abs(measure);
      if (size >= cfg.attention) status = STATUS.ATTENTION;
      else if (size >= cfg.watch) status = STATUS.WATCH;
    }
  }
  return { abs, pct, status };
}

export function assessReading(indicator, reading, baseline) {
  const range = classify(indicator, reading.value, reading.value2);
  const delta = baselineDelta(indicator, reading.value, baseline);
  const status = delta ? worst(range.status, delta.status) : range.status;
  let reason = range.label;
  if (delta && RANK[delta.status] > RANK[range.status]) {
    const amount = indicator.baseline.mode === 'pct'
      ? `${Math.abs(delta.pct).toFixed(1)} percent`
      : `${Math.abs(delta.abs).toFixed(1)} ${indicator.unit}`;
    reason = `${amount} ${delta.abs < 0 ? 'below' : 'above'} your baseline`;
  }
  return { status, reason, rangeStatus: range.status, delta };
}

export function readingsFor(readings, indicatorId) {
  return readings
    .filter((r) => r.indicatorId === indicatorId)
    .sort((a, b) => new Date(a.t) - new Date(b.t));
}

export function latestReading(readings, indicatorId) {
  const list = readingsFor(readings, indicatorId);
  return list.length ? list[list.length - 1] : null;
}

// Least-squares slope over the most recent readings, reported per week.
export function trend(readings, maxPoints = 8) {
  const pts = readings.slice(-maxPoints);
  if (pts.length < 3) return { direction: 'unknown', perWeek: 0, n: pts.length };
  const t0 = new Date(pts[0].t).getTime();
  const xs = pts.map((r) => (new Date(r.t).getTime() - t0) / DAY_MS);
  const ys = pts.map((r) => r.value);
  const n = pts.length;
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return { direction: 'steady', perWeek: 0, n };
  const perWeek = (num / den) * 7;
  const scale = Math.abs(my) || 1;
  // Under 2 percent of the mean per week counts as steady.
  let direction = 'steady';
  if (Math.abs(perWeek) / scale >= 0.02) direction = perWeek > 0 ? 'rising' : 'falling';
  return { direction, perWeek, n };
}

export function mean(values) {
  if (!values.length) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

// Readings of one indicator before and after a prescription started.
// This is a description of the trend, not proof that the medication worked.
export function beforeAfter(readings, startISO, windowDays = 28) {
  const start = new Date(startISO).getTime();
  const before = [];
  const after = [];
  for (const r of readings) {
    const t = new Date(r.t).getTime();
    if (t < start && t >= start - windowDays * DAY_MS) before.push(r.value);
    else if (t >= start) after.push(r.value);
  }
  const mb = mean(before);
  const ma = mean(after);
  const diff = mb !== null && ma !== null ? ma - mb : null;
  const pct = diff !== null && mb !== 0 ? (diff / mb) * 100 : null;
  return {
    before: { n: before.length, mean: mb },
    after: { n: after.length, mean: ma },
    diff,
    pct,
    enough: before.length >= 2 && after.length >= 2,
  };
}

// Doses due since the prescription started, counting the first dose at start.
// Lower-cases only the first letter, so "Vitamin D (25-OH)" reads "vitamin D (25-OH)" mid-sentence.
export function lowerFirst(text) {
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : '';
}

export function adherence(prescription, doses, nowISO) {
  const mine = doses.filter((d) => d.prescriptionId === prescription.id);
  const taken = mine.filter((d) => d.status === 'taken').length;
  const skipped = mine.filter((d) => d.status === 'skipped').length;
  if (!prescription.everyHours) {
    return { due: null, taken, skipped, pct: null, asNeeded: true };
  }
  const start = new Date(prescription.start).getTime();
  const endLimit = prescription.end ? new Date(prescription.end).getTime() : Infinity;
  const now = Math.min(new Date(nowISO).getTime(), endLimit);
  if (now < start) return { due: 0, taken, skipped, pct: null, asNeeded: false };
  const interval = prescription.everyHours * 60 * 60 * 1000;
  const due = Math.floor((now - start) / interval) + 1;
  // A prescription whose first dose has only just come due has no adherence to report yet.
  const fresh = due <= 1 && taken + skipped === 0;
  const pct = due > 0 && !fresh ? Math.min(100, (taken / due) * 100) : null;
  return { due, taken, skipped, pct, asNeeded: false, fresh };
}

// When the next scheduled dose falls, given the doses already logged.
export function nextDose(prescription, doses, nowISO) {
  if (!prescription.everyHours) return { asNeeded: true, dueNow: false, at: null };
  const interval = prescription.everyHours * 60 * 60 * 1000;
  const start = new Date(prescription.start).getTime();
  const logged = doses.filter((d) => d.prescriptionId === prescription.id).length;
  const at = start + logged * interval;
  const now = new Date(nowISO).getTime();
  const ended = prescription.end && at > new Date(prescription.end).getTime();
  return { asNeeded: false, dueNow: !ended && at <= now, at: ended ? null : new Date(at).toISOString(), ended: Boolean(ended) };
}

// One-way signal delay to the ground. Real delays vary; these are the round
// figures used in the demo, with Mars compressed so a demo does not stall.
export const MISSIONS = {
  iss: { name: 'Low Earth orbit (ISS)', oneWaySeconds: 1, demoSeconds: 1, note: 'Near real-time contact with the ground.' },
  moon: { name: 'Lunar mission', oneWaySeconds: 8, demoSeconds: 8, note: 'NASA plans for 5 to 12 seconds one way on Artemis missions.' },
  mars: { name: 'Mars transit', oneWaySeconds: 1200, demoSeconds: 20, note: 'Up to about 20 minutes one way. The demo compresses this to 20 seconds.' },
};

export function commDelay(missionId) {
  return MISSIONS[missionId] || MISSIONS.iss;
}

// Latest reading and status for every indicator that has data.
export function overview(state) {
  const items = [];
  for (const indicator of INDICATORS) {
    const list = readingsFor(state.readings, indicator.id);
    if (!list.length) {
      items.push({ indicator, latest: null, assessment: null, trend: null, count: 0 });
      continue;
    }
    const latest = list[list.length - 1];
    const assessment = assessReading(indicator, latest, state.profile.baselines[indicator.id]);
    items.push({ indicator, latest, assessment, trend: trend(list), count: list.length });
  }
  return items;
}

export function counts(items) {
  const c = { ok: 0, watch: 0, attention: 0, none: 0 };
  for (const item of items) {
    if (!item.assessment) c.none += 1;
    else c[item.assessment.status] += 1;
  }
  return c;
}

// The one-paragraph summary Astro shows on the Today screen. Fixed wording
// built from the rules above, never generated text.
export function astroSummary(items) {
  const flagged = items.filter((i) => i.assessment && i.assessment.status !== STATUS.OK);
  const urgent = flagged.filter((i) => i.assessment.status === STATUS.ATTENTION);
  const withData = items.filter((i) => i.assessment);
  if (!withData.length) {
    return 'No readings yet. Add your first one, or load the simulated demo data to see how AeroNYX works.';
  }
  if (!flagged.length) {
    return `All ${withData.length} indicators with readings are within their reference bands and close to your baseline.`;
  }
  const names = (list) => list.map((i) => lowerFirst(i.indicator.name)).join(', ');
  if (urgent.length) {
    const rest = flagged.length - urgent.length;
    return `${urgent.length === 1 ? 'One reading needs' : `${urgent.length} readings need`} attention now: ${names(urgent)}. ${rest ? `${rest} more ${rest === 1 ? 'is' : 'are'} worth watching. ` : ''}Recheck, then send a report to your flight surgeon.`;
  }
  return `${flagged.length === 1 ? 'One reading is' : `${flagged.length} readings are`} worth watching: ${names(flagged)}. Nothing needs urgent action.`;
}

// The structured report sent to the flight surgeon. Check-in scores are
// included; anything the crew member typed to Astro is not.
export function buildReport(state, nowISO, note = '') {
  const items = overview(state);
  const indicators = items
    .filter((i) => i.assessment)
    .map((i) => ({
      id: i.indicator.id,
      name: i.indicator.name,
      unit: i.indicator.unit,
      value: i.latest.value,
      value2: i.latest.value2 ?? null,
      takenAt: i.latest.t,
      status: i.assessment.status,
      reason: i.assessment.reason,
      changeFromBaselinePct: i.assessment.delta && i.assessment.delta.pct !== null ? Number(i.assessment.delta.pct.toFixed(1)) : null,
      trend: i.trend.direction,
      readings: i.count,
    }));
  const medications = state.prescriptions.map((p) => {
    const a = adherence(p, state.doses, nowISO);
    const linked = p.linkedIndicator ? getIndicator(p.linkedIndicator) : null;
    const cmp = linked ? beforeAfter(readingsFor(state.readings, linked.id), p.start) : null;
    return {
      id: p.id,
      name: p.name,
      dose: p.dose,
      everyHours: p.everyHours,
      start: p.start,
      dosesDue: a.due,
      dosesTaken: a.taken,
      dosesSkipped: a.skipped,
      adherencePct: a.pct === null ? null : Math.round(a.pct),
      linkedIndicator: linked ? linked.name : null,
      beforeMean: cmp && cmp.before.mean !== null ? Number(cmp.before.mean.toFixed(1)) : null,
      afterMean: cmp && cmp.after.mean !== null ? Number(cmp.after.mean.toFixed(1)) : null,
      readingsBefore: cmp ? cmp.before.n : 0,
      readingsAfter: cmp ? cmp.after.n : 0,
    };
  });
  const recent = [...state.checkins].sort((a, b) => new Date(a.t) - new Date(b.t)).slice(-5);
  const checkins = recent.map((c) => ({ t: c.t, mood: c.mood, stress: c.stress, loneliness: c.loneliness, level: c.level }));
  const handoffRequested = recent.some((c) => c.level === 'handoff');
  const c = counts(items);
  return {
    crew: state.profile.name,
    mission: state.profile.mission,
    createdAt: nowISO,
    simulated: Boolean(state.profile.simulated),
    summary: { attention: c.attention, watch: c.watch, ok: c.ok },
    urgent: c.attention > 0 || handoffRequested,
    indicators,
    medications,
    checkins,
    handoffRequested,
    note: String(note || '').slice(0, 2000),
  };
}
