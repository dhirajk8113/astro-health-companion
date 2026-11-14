// Run with: npm test
// AI disclosure: written with an AI coding assistant (Claude). See AI-USE.md.

import test from 'node:test';
import assert from 'node:assert/strict';

import { INDICATORS } from '../js/data/indicators.js';
import { demoState, emptyState } from '../js/data/demo.js';
import { buildReport } from '../js/lib/assess.js';
import { scoreCheckin, astroReply, pickActivities } from '../js/lib/checkin.js';
import { lineChart } from '../js/lib/chart.js';
import { viewToday, viewReadings, viewMeds, viewCheckin, viewSurgeon, viewSetup, viewAbout, esc } from '../js/views.js';

const NOW = '2026-11-14T18:00:00.000Z';

function clean(html, name) {
  assert.equal(typeof html, 'string');
  assert.ok(html.length > 200, `${name} is too short`);
  assert.ok(!/\bundefined\b/.test(html), `${name} contains "undefined"`);
  assert.ok(!/\bNaN\b/.test(html), `${name} contains "NaN"`);
  assert.ok(!/\[object Object\]/.test(html), `${name} contains an object dump`);
}

test('every screen renders with demo data', () => {
  const state = demoState(NOW);
  clean(viewToday(state), 'today');
  for (const i of INDICATORS) clean(viewReadings(state, i.id), `readings/${i.id}`);
  clean(viewReadings(state, 'not-a-real-id'), 'readings fallback');
  clean(viewMeds(state, NOW), 'meds');
  clean(viewCheckin(state), 'checkin');
  clean(viewSurgeon(state, NOW), 'surgeon');
  clean(viewSetup(state), 'setup');
  clean(viewAbout(), 'about');
});

test('every screen renders with no data at all', () => {
  const state = emptyState();
  clean(viewToday(state), 'today');
  assert.match(viewToday(state), /Load simulated demo data/);
  clean(viewReadings(state, 'bp'), 'readings');
  clean(viewMeds(state, NOW), 'meds');
  clean(viewCheckin(state), 'checkin');
  clean(viewSurgeon(state, NOW), 'surgeon');
  clean(viewSetup(state), 'setup');
});

test('simulated data is labelled on every data screen', () => {
  const state = demoState(NOW);
  for (const html of [viewToday(state), viewReadings(state, 'hr'), viewMeds(state, NOW), viewSurgeon(state, NOW)]) {
    assert.match(html, /Simulated data/);
  }
  assert.doesNotMatch(viewToday(emptyState()), /Simulated data\./);
});

test('today shows the flagged readings with an action', () => {
  const html = viewToday(demoState(NOW));
  assert.match(html, /Worth a look/);
  assert.match(html, /What to do:/);
  assert.match(html, /Needs attention/);
  assert.match(html, /not a doctor or a therapist/);
});

test('medication screen describes the trend without claiming cause', () => {
  const html = viewMeds(demoState(NOW), NOW);
  assert.match(html, /Potassium citrate/);
  assert.match(html, /Dose due/);
  assert.match(html, /lower/);
  assert.match(html, /does not prove the medication caused it/);
  assert.match(html, /Astro does not choose medications or doses/);
});

test('check-in results render for each level', () => {
  const state = demoState(NOW);
  for (const ratings of [{ mood: 8, stress: 2, loneliness: 2 }, { mood: 4, stress: 7, loneliness: 6 }, { mood: 2, stress: 9, loneliness: 9 }]) {
    const score = scoreCheckin(ratings);
    const html = viewCheckin(state, { result: { score, reply: astroReply(score), activities: pickActivities(score) } });
    clean(html, `checkin ${score.level}`);
  }
  const score = scoreCheckin({ mood: 2, stress: 9, loneliness: 9 });
  const handoff = viewCheckin(state, { result: { score, reply: astroReply(score), activities: pickActivities(score) } });
  assert.match(handoff, /needs a person/);
  assert.doesNotMatch(handoff, /Box breathing/);
});

test('flight surgeon screen shows transit, delivery and the Mars warning', () => {
  const state = demoState(NOW);
  state.profile.mission = 'mars';
  state.outbox.push({ id: 'o1', createdAt: NOW, deliverAt: '2026-11-14T18:00:15.000Z', payload: buildReport(state, NOW, 'note') });
  let html = viewSurgeon(state, NOW);
  assert.match(html, /In transit, 15 s/);
  assert.match(html, /20 minutes each way/);
  assert.match(html, /onboard medical checklist/);
  assert.match(html, /No reports have arrived yet/);
  html = viewSurgeon(state, '2026-11-14T18:00:20.000Z');
  assert.match(html, /Delivered/);
  assert.match(html, /Report received/);
});

test('user text is escaped', () => {
  const state = demoState(NOW);
  state.profile.name = '<img src=x onerror=alert(1)>';
  state.readings.push({ id: 'x', indicatorId: 'hr', t: NOW, value: 61, source: 'manual', note: '<script>alert(1)</script>' });
  state.inbox.push({ id: 'm', from: '<b>x</b>', sentAt: NOW, deliverAt: NOW, text: '<script>bad()</script>' });
  for (const html of [viewToday(state), viewReadings(state, 'hr'), viewSurgeon(state, NOW), viewSetup(state)]) {
    assert.ok(!html.includes('<script>'), 'raw script tag leaked');
    assert.ok(!html.includes('<img src=x'), 'raw img tag leaked');
  }
  assert.equal(esc('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
});

test('chart handles empty, single and paired series', () => {
  assert.match(lineChart([]), /No readings yet/);
  const one = lineChart([{ t: NOW, value: 60 }], { name: 'Heart rate' });
  assert.match(one, /<svg/);
  assert.ok(!/NaN/.test(one));
  const pair = lineChart([
    { t: '2026-11-01T08:00:00.000Z', value: 118, value2: 76 },
    { t: '2026-11-08T08:00:00.000Z', value: 112, value2: 70 },
  ], { band: { lo: 90, hi: 120 }, baseline: 118, name: 'Blood pressure', markAt: '2026-11-04T08:00:00.000Z', markLabel: 'Started' });
  assert.match(pair, /chart-line-2/);
  assert.match(pair, /chart-mark/);
  assert.ok(!/NaN/.test(pair));
});

test('about lists where each limit comes from, and a one-sided band draws', () => {
  const html = viewAbout();
  assert.match(html, /Where each limit comes from/);
  assert.match(html, /NASA reference value/);
  assert.match(html, /NASA standard/);
  const svg = lineChart([{ t: '2026-11-01T10:00:00Z', value: 240 }, { t: '2026-11-08T10:00:00Z', value: 290 }], { band: { hi: 250 } });
  assert.match(svg, /chart-band/);
  assert.doesNotMatch(svg, /NaN/);
});
