// Run with: npm test
// AI disclosure: written with an AI coding assistant (Claude). See AI-USE.md.

import test from 'node:test';
import assert from 'node:assert/strict';

import { INDICATORS } from '../js/data/indicators.js';
import { demoState, emptyState } from '../js/data/demo.js';
import { buildReport } from '../js/lib/assess.js';
import { lineChart } from '../js/lib/chart.js';
import { readFileSync } from 'node:fs';
import { viewToday, viewReadings, viewMeds, viewAstro, viewSurgeon, viewSetup, viewAbout, esc } from '../js/views.js';

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
  clean(viewAstro(state), 'astro');
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
  clean(viewAstro(state), 'astro');
  clean(viewSurgeon(state, NOW), 'surgeon');
  clean(viewSetup(state), 'setup');
});

test('simulated data is labelled on every data screen', () => {
  const state = demoState(NOW);
  for (const html of [viewReadings(state, 'hr'), viewMeds(state, NOW), viewSurgeon(state, NOW)]) {
    assert.match(html, /Simulated data/);
  }
  assert.doesNotMatch(viewReadings(emptyState(), 'hr'), /Simulated data\./);
  // The home screen carries no banner: the "Demo data" label in the page header covers every screen.
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(page, /id="demo-chip"[^>]*hidden>Demo data</);
});

test('today shows one gauge per reading, flagged readings first', () => {
  const html = viewToday(demoState(NOW));
  const rows = [...html.matchAll(/<a class="gauge gauge-(\w+)" href="#readings\/(\w+)"/g)].map((m) => [m[1], m[2]]);
  assert.equal(rows.length, INDICATORS.length);
  assert.deepEqual(rows[0], ['attention', 'urine_vol']);
  const statuses = rows.map((r) => r[0]);
  assert.deepEqual(statuses, [...statuses].sort((a, b) => ['attention', 'watch', 'ok'].indexOf(a) - ['attention', 'watch', 'ok'].indexOf(b)));
  assert.match(html, /1 needs attention/);
  assert.match(html, /9 in range/);
  // every reading is drawn against its safe range, and the status is there for screen readers
  assert.equal((html.match(/class="gauge-band"/g) || []).length, INDICATORS.length);
  assert.match(html, /<span class="sr-only">Needs attention<\/span>/);
  assert.match(html, /Green is the safe range/);
  // far less text than the old home screen
  assert.ok(html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length < 110, 'home screen has grown wordy again');
});

test('medication screen describes the trend without claiming cause', () => {
  const html = viewMeds(demoState(NOW), NOW);
  assert.match(html, /Potassium citrate/);
  assert.match(html, /Dose due/);
  assert.match(html, /lower/);
  assert.match(html, /A trend, not proof of cause/);
  assert.match(html, /AeroNYX does not choose medications or doses/);
});

test('flight surgeon screen shows transit, delivery and the Mars warning', () => {
  const state = demoState(NOW);
  state.profile.mission = 'mars';
  state.outbox.push({ id: 'o1', createdAt: NOW, deliverAt: '2026-11-14T18:00:15.000Z', payload: buildReport(state, NOW, 'note') });
  let html = viewSurgeon(state, NOW);
  assert.match(html, /In transit, 15 s/);
  assert.match(html, /minutes( \d+ seconds)? each way today, computed/);
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
