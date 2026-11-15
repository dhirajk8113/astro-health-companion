// Aeronyx: tests for the real NASA data features.
// AI disclosure: written with an AI coding assistant (Claude). See AI-USE.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { earthMarsDistanceAU, marsLightSeconds, formatDelay } from '../js/lib/ephemeris.js';
import { summarise, normaliseDonki, flareStrength, fetchDonki } from '../js/lib/spaceweather.js';
import { parseUpdate, issTimestampToMs, cabinStatus, formatAge, ISS_ITEMS, connectIss } from '../js/lib/isslive.js';
import { RADLAB_ISS, QUALITY_FACTOR, radlabMeanMsvPerDay, doseRateFor, DONKI_MAY_2024, I4_PANEL } from '../js/data/nasa-snapshots.js';
import { MEDICATIONS } from '../js/data/medications.js';
import { demoState } from '../js/data/demo.js';
import { viewEnvironment, viewReadings, viewSurgeon, viewToday, viewMeds, delayNow } from '../js/views.js';

const NOW = '2026-11-15T01:20:00.000Z';
const idleEnv = () => ({ donki: { status: 'idle', data: null, at: 0 }, replay: false, iss: { state: 'idle', values: {} } });

test('Earth to Mars distance matches published close approaches', () => {
  assert.ok(Math.abs(earthMarsDistanceAU(new Date('2025-01-12T12:00:00Z')) - 0.6423) < 0.005);
  assert.ok(Math.abs(earthMarsDistanceAU(new Date('2027-02-20T00:00:00Z')) - 0.6779) < 0.005);
  assert.ok(Math.abs(earthMarsDistanceAU(new Date('2003-08-27T10:00:00Z')) - 0.3727) < 0.005);
  for (let y = 2020; y < 2045; y += 1) {
    for (let m = 0; m < 12; m += 1) {
      const minutes = marsLightSeconds(new Date(Date.UTC(y, m, 15))) / 60;
      assert.ok(minutes > 3 && minutes < 22.5, `${y}-${m + 1}: ${minutes}`);
    }
  }
  assert.equal(formatDelay(657), '10 minutes 57 seconds');
  assert.equal(formatDelay(1), '1 second');
  assert.equal(formatDelay(120), '2 minutes');
});

test('the Mars delay on the flight surgeon screen is computed for the date', () => {
  const d = delayNow('mars', NOW);
  assert.ok(d.seconds > 600 && d.seconds < 720);
  assert.match(d.text, /^10 minutes \d+ seconds each way today/);
  assert.match(delayNow('iss', NOW).text, /about 1 second each way/);
  const state = demoState(NOW);
  state.profile.mission = 'mars';
  assert.match(viewSurgeon(state, NOW), /computed from the positions of Earth and Mars/);
});

test('space weather: the stored May 2024 storm raises an alert, forecasts do not', () => {
  const d = DONKI_MAY_2024;
  const s = summarise({ sep: d.sep, flares: d.flares, flareCount: d.flareCount, storms: d.storms }, Date.parse(d.replayNow));
  assert.equal(s.particleEvents, 10);
  assert.equal(s.flareCount, 181);
  assert.equal(s.strongestFlare.c, 'X8.7');
  assert.equal(s.topStorm.kp, 9);
  assert.equal(s.alert.event.t, '2024-05-11T04:07Z');
  assert.ok(s.alert.hoursAgo < 2);
  const quiet = summarise({ sep: [{ t: '2024-05-09T13:59Z', inst: 'MODEL: REleASE' }], flares: [], storms: [] }, Date.parse('2024-05-09T15:00Z'));
  assert.equal(quiet.alert, null);
  assert.equal(summarise({ sep: d.sep, flares: d.flares, storms: d.storms }, Date.parse('2024-06-01T00:00Z')).alert, null);
  assert.ok(flareStrength('X1.0') > flareStrength('M9.9'));
});

test('space weather: DONKI responses are normalised and failures reject', async () => {
  const raw = { sep: [{ eventTime: '2026-11-01T00:00Z', instruments: [{ displayName: 'GOES-P: SEISS >10 MeV' }] }], flr: [{ peakTime: '2026-11-05T18:33Z', classType: 'M3.5' }], gst: [{ startTime: '2026-10-31T18:00Z', allKpIndex: [{ kpIndex: 5 }, { kpIndex: 6 }] }] };
  const n = normaliseDonki(raw);
  assert.deepEqual(n.sep[0], { t: '2026-11-01T00:00Z', inst: 'GOES-P: SEISS >10 MeV' });
  assert.equal(n.storms[0].kp, 6);
  const calls = [];
  const fake = async (url) => { calls.push(url); return { ok: true, text: async () => (url.includes('/SEP') ? JSON.stringify(raw.sep) : '') }; };
  const data = await fetchDonki(Date.parse(NOW), 30, fake);
  assert.equal(calls.length, 3);
  assert.match(calls[0], /^https:\/\/ccmc\.gsfc\.nasa\.gov\/DONKI\/WS\/get\/SEP\?startDate=2026-10-16&endDate=2026-11-15$/);
  assert.equal(data.sep.length, 1);
  assert.equal(data.flareCount, 0);
  await assert.rejects(fetchDonki(Date.parse(NOW), 30, async () => ({ ok: false, status: 503 })));
});

test('ISS telemetry: updates, timestamps and limits', () => {
  assert.deepEqual(parseUpdate('U,1,2,23.32|7657.32', 2), { item: 2, fields: { 0: '23.32', 1: '7657.32' } });
  assert.deepEqual(parseUpdate('U,1,7,27566439117|7657.34|', 3), { item: 7, fields: { 0: '27566439117', 1: '7657.34' } });
  assert.deepEqual(parseUpdate('U,1,3,|7700.5', 2), { item: 3, fields: { 1: '7700.5' } });
  assert.deepEqual(parseUpdate('U,1,3,#|^1', 2), { item: 3, fields: { 0: null } });
  assert.equal(parseUpdate('SUBOK,1,7,3', 2), null);
  assert.equal(new Date(issTimestampToMs(7657.3333, 2026)).toISOString().slice(0, 16), '2026-11-15T01:19');
  const temp = ISS_ITEMS.find((i) => i.id === 'USLAB000059');
  const co2 = ISS_ITEMS.find((i) => i.id === 'USLAB000055');
  assert.equal(cabinStatus(temp, 23.3, 1).status, 'ok');
  assert.equal(cabinStatus(temp, 28.1, 1).status, 'attention');
  assert.equal(cabinStatus(temp, 17.9, 1).status, 'attention');
  assert.equal(cabinStatus(co2, 2.4, 1).status, 'ok');
  assert.equal(cabinStatus(co2, 3.0, 1).status, 'attention');
  assert.equal(cabinStatus(co2, 2.4, 17000).status, 'stale');
  assert.equal(cabinStatus(ISS_ITEMS.find((i) => i.id === 'USLAB000058'), 758, 1).status, 'info');
  assert.equal(cabinStatus(temp, NaN, NaN).status, 'none');
  const tank = ISS_ITEMS.find((i) => i.id === 'NODE3000005');
  assert.equal(cabinStatus(tank, 49, 73).status, 'info');
  assert.equal(cabinStatus(tank, 49, 3000).status, 'stale');
  assert.equal(formatAge(0.2), 'seconds ago');
  assert.equal(formatAge(17300), '12 days ago');
});

test('ISS telemetry: the client speaks the feed protocol', () => {
  const sent = [];
  let socket;
  class FakeSocket { constructor(url, protocol) { this.url = url; this.protocol = protocol; socket = this; } send(m) { sent.push(m); } close() { this.closed = true; } }
  const snaps = [];
  const stop = connectIss((s) => snaps.push(s), FakeSocket);
  socket.onopen();
  socket.onmessage({ data: 'WSOK\r\n' });
  socket.onmessage({ data: 'CONOK,S123,50000,5000,*\r\n' });
  socket.onmessage({ data: 'SUBOK,1,6,2\r\nU,1,1,23.5|7657.3333\r\nU,1,3,2.43|7359.0\r\n' });
  socket.onmessage({ data: 'U,1,1,23.6|\r\n' });
  assert.equal(sent[0], 'wsok');
  assert.match(sent[1], /^create_session\r\nLS_adapter_set=ISSLIVE&/);
  assert.match(sent[2], /LS_group=USLAB000059%20USLAB000058%20USLAB000055%20NODE3000005%20NODE3000008%20NODE3000009&LS_schema=Value%20TimeStamp&LS_snapshot=true&LS_session=S123$/);
  const last = snaps[snaps.length - 1];
  assert.equal(last.state, 'live');
  assert.equal(last.values.USLAB000059.value, 23.6);
  assert.equal(new Date(last.values.USLAB000059.t).getUTCHours(), 1);
  assert.equal(last.values.USLAB000055.value, 2.43);
  stop();
  assert.equal(socket.closed, true);
});

test('saved NASA data is intact', () => {
  assert.equal(RADLAB_ISS.daily.length, 61);
  assert.ok(RADLAB_ISS.daily.every((v) => v > 200 && v < 320));
  assert.ok(Math.abs(QUALITY_FACTOR.value - 2.262) < 0.001);
  assert.ok(Math.abs(radlabMeanMsvPerDay() - 0.594) < 0.005);
  assert.ok(Math.abs(doseRateFor('moon') - 1.22) < 0.01);
  assert.equal(doseRateFor('mars'), 1.8);
  assert.equal(DONKI_MAY_2024.sep.length, 14);
  assert.equal(DONKI_MAY_2024.flares.length, 21);
  assert.equal(I4_PANEL.glucose.draws.length, 7);
  assert.equal(I4_PANEL.potassium.draws.length, 7);
  for (const key of ['glucose', 'potassium']) for (const d of I4_PANEL[key].draws) assert.ok(d.min <= d.max);
});

test('the demo radiation dose replays the measured ISS days', () => {
  const state = demoState(NOW);
  const dose = state.readings.filter((r) => r.indicatorId === 'dose');
  const total = RADLAB_ISS.daily.slice(0, 60).reduce((a, b) => a + b, 0) * QUALITY_FACTOR.value / 1000;
  assert.equal(dose[dose.length - 1].value, Number(total.toFixed(1)));
  assert.ok(dose.every((r, i) => i === 0 || r.value > dose[i - 1].value));
  assert.ok(dose.every((r) => r.source === 'radlab'));
});

test('kit items from the NASA list are marked, countermeasures are not', () => {
  const ids = (fn) => MEDICATIONS.filter(fn).map((m) => m.id).sort();
  assert.deepEqual(ids((m) => !m.kit), ['alendronate', 'kcitrate', 'vitd3']);
  assert.ok(MEDICATIONS.filter((m) => m.kit).every((m) => /Medication Pack$/.test(m.kit) && m.source.url.includes('medical_kit_checklist')));
  const z = MEDICATIONS.find((m) => m.id === 'sleepaid');
  assert.equal(`${z.name} ${z.defaultDose}`, 'Zolpidem (Ambien) 10 mg');
  const html = viewMeds(demoState(NOW), NOW);
  assert.match(html, /NASA ISS medical kit, Convenience Medication Pack/);
  assert.match(html, /Not in NASA&#39;s 2015 kit list/);
});

test('environment screen renders in every state', () => {
  const state = demoState(NOW);
  const env = idleEnv();
  let html = viewEnvironment(state, env, NOW);
  for (const text of ['Space weather events', 'Measured dose on the ISS', 'Cabin air and water', 'Distance from Earth', '10 minutes']) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /NaN|undefined/);
  env.replay = true;
  html = viewEnvironment(state, env, NOW);
  assert.match(html, /Solar particle event 2 hours ago/);
  assert.match(html, /X8\.7/);
  assert.match(viewToday(state, env), /Space weather \(replay of May 2024\)/);
  env.replay = false;
  env.donki = { status: 'live', at: Date.parse(NOW), data: { range: ['2026-10-16', '2026-11-15'], sep: [], flareCount: 14, flares: [{ t: '2026-11-05T18:33Z', c: 'M3.5' }], storms: [{ t: '2026-10-31T18:00Z', kp: 6 }] } };
  env.iss = { state: 'live', values: { USLAB000059: { value: 23.32, t: Date.parse(NOW) - 60000 }, USLAB000055: { value: 2.435, t: Date.parse(NOW) - 12 * 864e5 } } };
  html = viewEnvironment(state, env, NOW);
  assert.match(html, /Live from NASA DONKI, 2026-10-16 to 2026-11-15/);
  assert.match(html, /No solar particle event in the last 72 hours/);
  assert.match(html, /23\.3 °C/);
  assert.match(html, /Within limit/);
  assert.match(html, /Not updating/);
  assert.doesNotMatch(viewToday(state, env), /Space weather/);
  assert.doesNotMatch(html, /NaN|undefined/);
});

test('glucose and potassium show the Inspiration4 crew range, other readings do not', () => {
  const state = demoState(NOW);
  assert.match(viewReadings(state, 'glucose'), /A real crew: Inspiration4/);
  assert.match(viewReadings(state, 'potassium'), /3\.5 to 5\.3 mmol\/L/);
  assert.doesNotMatch(viewReadings(state, 'hr'), /Inspiration4/);
  assert.match(viewReadings(state, 'dose'), /Real data\./);
  assert.match(viewReadings(state, 'hr'), /with one exception/);
  const old = demoState(NOW);
  old.readings.forEach((r) => { r.source = 'simulated'; });
  assert.doesNotMatch(viewReadings(old, 'dose'), /Real data\./);
  assert.doesNotMatch(viewReadings(old, 'hr'), /with one exception/);
});
