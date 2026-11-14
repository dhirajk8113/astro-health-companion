// Run with: node --test tests/
// AI disclosure: written with an AI coding assistant (Claude). See AI-USE.md.

import test from 'node:test';
import assert from 'node:assert/strict';

import { INDICATORS, getIndicator, STATUS } from '../js/data/indicators.js';
import { MEDICATIONS, getMedication } from '../js/data/medications.js';
import { demoState, emptyState } from '../js/data/demo.js';
import {
  classify, baselineDelta, assessReading, trend, beforeAfter, adherence, nextDose,
  commDelay, overview, counts, astroSummary, buildReport, readingsFor, worst,
} from '../js/lib/assess.js';
import { scoreCheckin, sustainedLow, pickActivities, astroReply, isCrisisText, LEVEL } from '../js/lib/checkin.js';

const NOW = '2026-11-14T18:00:00.000Z';
const ind = (id) => getIndicator(id);

test('every indicator is complete and classifies a mid-range value', () => {
  const ids = new Set();
  for (const i of INDICATORS) {
    assert.ok(!ids.has(i.id), `duplicate id ${i.id}`);
    ids.add(i.id);
    for (const key of ['name', 'unit', 'group', 'sample', 'hazard', 'why', 'how', 'limitNote']) {
      assert.ok(i[key], `${i.id} is missing ${key}`);
    }
    assert.ok(i.actions.ok && i.actions.watch && i.actions.attention, `${i.id} needs three actions`);
    assert.ok(i.sources.length >= 1 && i.sources.every((s) => s && s.url.startsWith('https://')), `${i.id} needs sources`);
  }
});

test('glucose bands follow the fasting ranges', () => {
  const g = ind('glucose');
  assert.equal(classify(g, 88).status, STATUS.OK);
  assert.equal(classify(g, 99.5).status, STATUS.OK);
  assert.equal(classify(g, 100).status, STATUS.WATCH);
  assert.equal(classify(g, 125).status, STATUS.WATCH);
  assert.equal(classify(g, 126).status, STATUS.ATTENTION);
  assert.equal(classify(g, 69.5).status, STATUS.WATCH);
  assert.equal(classify(g, 53).status, STATUS.ATTENTION);
});

test('blood pressure uses the worse of the two numbers', () => {
  const bp = ind('bp');
  assert.equal(classify(bp, 115, 75).status, STATUS.OK);
  assert.equal(classify(bp, 125, 75).status, STATUS.WATCH);
  assert.equal(classify(bp, 115, 85).status, STATUS.WATCH);
  assert.equal(classify(bp, 115, 92).status, STATUS.ATTENTION);
  assert.equal(classify(bp, 145, 70).status, STATUS.ATTENTION);
  assert.equal(classify(bp, 85, 55).status, STATUS.WATCH);
  assert.equal(classify(bp, 78, 55).status, STATUS.ATTENTION);
  assert.throws(() => classify(bp, 120));
});

test('aerobic capacity applies the NASA 80 percent limit', () => {
  const f = ind('fitness');
  assert.equal(classify(f, 95).status, STATUS.OK);
  assert.equal(classify(f, 88).status, STATUS.WATCH);
  assert.equal(classify(f, 80).status, STATUS.WATCH);
  assert.equal(classify(f, 79).status, STATUS.ATTENTION);
});

test('sleep, temperature, urine and dose bands', () => {
  assert.equal(classify(ind('sleep'), 7.5).status, STATUS.OK);
  assert.equal(classify(ind('sleep'), 6.5).status, STATUS.WATCH);
  assert.equal(classify(ind('sleep'), 5.9).status, STATUS.ATTENTION);
  assert.equal(classify(ind('temp'), 36.8).status, STATUS.OK);
  assert.equal(classify(ind('temp'), 37.7).status, STATUS.WATCH);
  assert.equal(classify(ind('temp'), 38.0).status, STATUS.ATTENTION);
  assert.equal(classify(ind('urine_vol'), 2.1).status, STATUS.OK);
  assert.equal(classify(ind('urine_vol'), 1.6).status, STATUS.WATCH);
  assert.equal(classify(ind('urine_vol'), 0.8).status, STATUS.ATTENTION);
  assert.equal(classify(ind('urine_ca'), 240).status, STATUS.OK);
  assert.equal(classify(ind('urine_ca'), 250).status, STATUS.WATCH);
  assert.equal(classify(ind('urine_ca'), 301).status, STATUS.ATTENTION);
  assert.equal(classify(ind('dose'), 27).status, STATUS.OK);
  assert.equal(classify(ind('dose'), 600).status, STATUS.ATTENTION);
  assert.throws(() => classify(ind('sleep'), Number.NaN));
});

test('body mass is judged against the preflight baseline only', () => {
  const m = ind('mass');
  assert.equal(assessReading(m, { value: 76.0 }, 78).status, STATUS.OK); // -2.6%
  assert.equal(assessReading(m, { value: 73.9 }, 78).status, STATUS.WATCH); // -5.3%
  const big = assessReading(m, { value: 69.0 }, 78); // -11.5%
  assert.equal(big.status, STATUS.ATTENTION);
  assert.match(big.reason, /below your baseline/);
  assert.equal(assessReading(m, { value: 84.0 }, 78).status, STATUS.OK); // gains are not flagged
  assert.equal(assessReading(m, { value: 70.0 }, undefined).status, STATUS.OK); // no baseline, no flag
});

test('heart rate and mood use baseline change as well as the band', () => {
  const hr = ind('hr');
  assert.equal(assessReading(hr, { value: 60 }, 58).status, STATUS.OK);
  assert.equal(assessReading(hr, { value: 72 }, 58).status, STATUS.WATCH); // +24%
  assert.equal(assessReading(hr, { value: 80 }, 58).status, STATUS.ATTENTION); // +38%
  const mood = ind('mood');
  assert.equal(assessReading(mood, { value: 7 }, 8).status, STATUS.OK);
  assert.equal(assessReading(mood, { value: 6 }, 8).status, STATUS.WATCH); // 2 below baseline
  assert.equal(assessReading(mood, { value: 2 }, 8).status, STATUS.ATTENTION);
  const d = baselineDelta(hr, 58, 58);
  assert.equal(d.pct, 0);
  assert.equal(baselineDelta(hr, 60, undefined), null);
});

test('worst picks the more serious status', () => {
  assert.equal(worst(STATUS.OK, STATUS.WATCH), STATUS.WATCH);
  assert.equal(worst(STATUS.ATTENTION, STATUS.WATCH), STATUS.ATTENTION);
  assert.equal(worst(STATUS.OK, STATUS.OK), STATUS.OK);
});

test('trend reports direction and weekly change', () => {
  const mk = (vals) => vals.map((v, i) => ({ t: new Date(Date.UTC(2026, 9, 1 + i * 7)).toISOString(), value: v }));
  const up = trend(mk([180, 200, 220, 240]));
  assert.equal(up.direction, 'rising');
  assert.ok(Math.abs(up.perWeek - 20) < 1e-6);
  assert.equal(trend(mk([240, 220, 200, 180])).direction, 'falling');
  assert.equal(trend(mk([100, 100.5, 99.8, 100.2])).direction, 'steady');
  assert.equal(trend(mk([100, 120])).direction, 'unknown');
});

test('before and after comparison around a prescription start', () => {
  const start = '2026-10-15T09:00:00.000Z';
  const r = (day, v) => ({ t: new Date(Date.UTC(2026, 9, day, 10)).toISOString(), value: v });
  const cmp = beforeAfter([r(1, 280), r(8, 290), r(14, 300), r(16, 270), r(23, 250), r(30, 230)], start);
  assert.equal(cmp.before.n, 3);
  assert.equal(cmp.after.n, 3);
  assert.equal(cmp.before.mean, 290);
  assert.equal(cmp.after.mean, 250);
  assert.equal(cmp.diff, -40);
  assert.ok(cmp.enough);
  const thin = beforeAfter([r(16, 270)], start);
  assert.equal(thin.before.mean, null);
  assert.equal(thin.enough, false);
});

test('adherence and next dose', () => {
  const p = { id: 'p', everyHours: 24, start: '2026-11-10T09:00:00.000Z', end: null };
  const doses = [
    { prescriptionId: 'p', status: 'taken' },
    { prescriptionId: 'p', status: 'taken' },
    { prescriptionId: 'p', status: 'skipped' },
    { prescriptionId: 'other', status: 'taken' },
  ];
  const a = adherence(p, doses, NOW); // 10, 11, 12, 13, 14 Nov at 09:00 = 5 due
  assert.equal(a.due, 5);
  assert.equal(a.taken, 2);
  assert.equal(a.skipped, 1);
  assert.equal(a.pct, 40);
  const n = nextDose(p, doses, NOW);
  assert.equal(n.dueNow, true);
  assert.equal(n.at, '2026-11-13T09:00:00.000Z');
  const prn = { id: 'q', everyHours: 0, start: '2026-11-10T09:00:00.000Z' };
  assert.equal(adherence(prn, [], NOW).asNeeded, true);
  assert.equal(nextDose(prn, [], NOW).dueNow, false);
  const future = { id: 'f', everyHours: 24, start: '2026-12-01T09:00:00.000Z' };
  assert.equal(adherence(future, [], NOW).due, 0);
  assert.equal(nextDose(future, [], NOW).dueNow, false);
});

test('communication delay grows with distance', () => {
  assert.ok(commDelay('iss').oneWaySeconds < commDelay('moon').oneWaySeconds);
  assert.ok(commDelay('moon').oneWaySeconds < commDelay('mars').oneWaySeconds);
  assert.equal(commDelay('mars').oneWaySeconds, 1200);
  assert.equal(commDelay('nowhere').name, commDelay('iss').name);
});

test('medication kit entries point at real indicators', () => {
  for (const m of MEDICATIONS) {
    assert.ok(m.name && m.defaultDose && m.purpose && m.source.url);
    if (m.linkedIndicator) assert.ok(getIndicator(m.linkedIndicator), `${m.id} links to a missing indicator`);
  }
  assert.equal(getMedication('nope'), null);
});

test('demo state is simulated, in the past, and assessable', () => {
  const state = demoState(NOW);
  assert.equal(state.profile.simulated, true);
  const now = new Date(NOW).getTime();
  assert.ok(state.readings.length > 300);
  assert.ok(state.readings.every((r) => new Date(r.t).getTime() <= now), 'no reading may be in the future');
  assert.ok(state.readings.every((r) => r.source === 'simulated'));
  const items = overview(state);
  assert.equal(items.length, INDICATORS.length);
  assert.ok(items.every((i) => i.assessment), 'every indicator has demo data');
  const c = counts(items);
  assert.equal(c.ok + c.watch + c.attention, INDICATORS.length);
  assert.ok(c.watch + c.attention >= 2, 'the demo should show something to look at');
  assert.equal(typeof astroSummary(items), 'string');
  // The potassium citrate story: urinary calcium lower after the start date.
  const p2 = state.prescriptions.find((p) => p.medId === 'kcitrate');
  const cmp = beforeAfter(readingsFor(state.readings, 'urine_ca'), p2.start);
  assert.ok(cmp.enough);
  assert.ok(cmp.diff < 0);
  // A dose is due today in the demo.
  assert.equal(nextDose(p2, state.doses, NOW).dueNow, true);
  // Same seed, same data.
  assert.deepEqual(demoState(NOW).readings, state.readings);
});

test('empty state summary invites a first reading', () => {
  const items = overview(emptyState());
  assert.equal(counts(items).none, INDICATORS.length);
  assert.match(astroSummary(items), /No readings yet/);
});

test('report carries scores but never check-in text', () => {
  const state = demoState(NOW);
  state.checkins.push({ id: 'x', t: NOW, mood: 2, stress: 9, loneliness: 9, level: 'handoff', text: 'private words' });
  const report = buildReport(state, NOW, 'Feeling tired this week.');
  assert.equal(report.simulated, true);
  assert.equal(report.handoffRequested, true);
  assert.equal(report.urgent, true);
  assert.equal(report.indicators.length, INDICATORS.length);
  assert.equal(report.medications.length, 2);
  const kc = report.medications.find((m) => m.name === 'Potassium citrate');
  assert.ok(kc.adherencePct > 50 && kc.adherencePct <= 100);
  assert.ok(kc.afterMean < kc.beforeMean);
  assert.ok(!JSON.stringify(report).includes('private words'));
  assert.equal(report.note, 'Feeling tired this week.');
});

test('check-in levels', () => {
  assert.equal(scoreCheckin({ mood: 8, stress: 3, loneliness: 2 }).level, LEVEL.STEADY);
  assert.equal(scoreCheckin({ mood: 4, stress: 3, loneliness: 2 }).level, LEVEL.SUPPORT);
  assert.equal(scoreCheckin({ mood: 7, stress: 6, loneliness: 2 }).level, LEVEL.SUPPORT);
  assert.equal(scoreCheckin({ mood: 7, stress: 2, loneliness: 7 }).level, LEVEL.SUPPORT);
  assert.equal(scoreCheckin({ mood: 2, stress: 2, loneliness: 2 }).level, LEVEL.HANDOFF);
  assert.equal(scoreCheckin({ mood: 7, stress: 9, loneliness: 2 }).level, LEVEL.HANDOFF);
  assert.equal(scoreCheckin({ mood: 7, stress: 2, loneliness: 10 }).level, LEVEL.HANDOFF);
  assert.throws(() => scoreCheckin({ mood: 7, stress: 2 }));
});

test('crisis words always hand off, whatever the ratings', () => {
  const s = scoreCheckin({ mood: 8, stress: 1, loneliness: 1, text: 'Some days I do not want to be here.' });
  assert.equal(s.level, LEVEL.HANDOFF);
  assert.equal(s.crisis, true);
  assert.equal(isCrisisText('I want to hurt myself'), true);
  assert.equal(isCrisisText('I can\'t go on like this'), true);
  assert.equal(isCrisisText('Long day, the treadmill hurt my knee'), false);
  assert.equal(isCrisisText(''), false);
  const reply = astroReply(s);
  assert.match(reply.title, /needs a person/);
  assert.ok(reply.lines.some((l) => /crew medical officer/.test(l)));
});

test('activities match the biggest need and replies stay in bounds', () => {
  const lonely = pickActivities(scoreCheckin({ mood: 7, stress: 2, loneliness: 8 }));
  assert.equal(lonely[0].id, 'message');
  const stressed = pickActivities(scoreCheckin({ mood: 7, stress: 8, loneliness: 1 }));
  assert.equal(stressed[0].id, 'breathing');
  assert.ok(lonely.length <= 3 && new Set(lonely.map((a) => a.id)).size === lonely.length);
  const steady = astroReply(scoreCheckin({ mood: 8, stress: 2, loneliness: 2 }));
  assert.match(steady.title, /Steady/);
  const support = astroReply(scoreCheckin({ mood: 4, stress: 7, loneliness: 2 }), { sustained: true });
  assert.ok(support.lines.some((l) => /private conference/.test(l)));
});

test('sustained low mood needs three check-ins in a row', () => {
  const c = (day, mood) => ({ t: new Date(Date.UTC(2026, 10, day)).toISOString(), mood });
  assert.equal(sustainedLow([c(1, 6), c(2, 5), c(3, 6)], 8), true);
  assert.equal(sustainedLow([c(1, 6), c(2, 8), c(3, 6)], 8), false);
  assert.equal(sustainedLow([c(1, 5), c(2, 5)], 8), false);
  assert.equal(sustainedLow([c(1, 5), c(2, 5), c(3, 5)], undefined), false);
});
