// AeroNYX: tests for the gauges, the Astro chat companion and the concept device.
// Run with: npm test
// AI disclosure: written with an AI coding assistant (Claude). See AI-USE.md.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { INDICATORS, getIndicator } from '../js/data/indicators.js';
import { demoState, emptyState } from '../js/data/demo.js';
import { classify } from '../js/lib/assess.js';
import { LEVEL, ACTIVITIES } from '../js/lib/checkin.js';
import { chatReply, parseRating, CHECKIN_STEPS, OPENING, HANDOFF_TEXT } from '../js/lib/chat.js';
import { gaugeFor, gaugePosition } from '../js/lib/gauge.js';
import { deviceFits, loadDevicePref, saveDevicePref, usesSampleSubmitter } from '../js/lib/device.js';
import { viewAstro } from '../js/views.js';

const NOW = '2026-11-14T18:00:00.000Z';

// ---------- gauges ----------

test('every indicator has a gauge with a band and a short name', () => {
  for (const i of INDICATORS) {
    const g = gaugeFor(i, 78);
    assert.ok(g.drawable, `${i.id} has no drawable gauge`);
    assert.ok(g.short.length <= 14, `${i.id} short name is long`);
    assert.ok(g.min < g.max);
  }
});

test('the green band is the range the status rules call in range', () => {
  for (const i of INDICATORS) {
    if (i.pair || i.id === 'mass') continue;
    const g = gaugeFor(i);
    const lo = g.lo === undefined ? g.min : g.lo;
    const hi = g.hi === undefined ? g.max : g.hi;
    const middle = (lo + hi) / 2;
    assert.equal(classify(i, middle).status, 'ok', `${i.id}: the middle of the band (${middle}) is not in range`);
  }
});

test('gauge positions stay on the bar and put the marker in the right place', () => {
  const vol = gaugeFor(getIndicator('urine_vol'));
  const low = gaugePosition(vol, 1.4);
  assert.ok(low.marker < low.bandLeft, 'a low reading sits left of the band');
  const ok = gaugePosition(vol, 2.4);
  assert.ok(ok.marker > ok.bandLeft && ok.marker < ok.bandLeft + ok.bandWidth);
  assert.equal(gaugePosition(vol, 99).marker, 100);
  assert.equal(gaugePosition(vol, -5).marker, 0);
  assert.equal(gaugePosition(vol, NaN), null);
  // radiation: green up to NASA's 600 mSv career limit
  const dose = gaugePosition(gaugeFor(getIndicator('dose')), 35.7);
  assert.equal(dose.bandLeft, 0);
  assert.ok(dose.bandWidth > 80 && dose.marker < 10);
  // body mass is drawn around the crew member's own preflight mass
  const mass = gaugeFor(getIndicator('mass'), 80);
  assert.equal(mass.lo, 76);
  assert.equal(gaugeFor(getIndicator('mass')).drawable, false);
});

// ---------- Astro ----------

test('Astro hands off to people on crisis words, whatever else is said', () => {
  for (const text of ['I want to end it all', "I don't want to be here anymore", 'I don\u2019t want to live', 'thinking about hurting myself, also stressed', 'I wish I was dead', 'sometimes I want to die']) {
    const r = chatReply(text);
    assert.equal(r.level, LEVEL.HANDOFF, text);
    assert.equal(r.text, HANDOFF_TEXT);
    assert.deepEqual(r.activities, []);
  }
  assert.match(HANDOFF_TEXT, /crew medical officer/);
  assert.match(HANDOFF_TEXT, /does not include what you wrote/);
});

test('Astro answers the common topics with a calm reply and a fitting activity', () => {
  const cases = [
    ["I'm stressed", 'stress', 'breathing'],
    ['so much pressure this week', 'stress', 'breathing'],
    ['I feel anxious about the EVA', 'anxious', 'grounding'],
    ["I can't sleep", 'sleep', 'breathing'],
    ['I miss home', 'lonely', 'message'],
    ['feeling down today', 'low', 'move'],
    ['had an argument with a crewmate', 'anger', 'breathing'],
    ['everything feels hopeless', 'heavy', 'connect'],
  ];
  for (const [text, topic, activity] of cases) {
    const r = chatReply(text);
    assert.equal(r.topic, topic, text);
    assert.equal(r.activities[0], activity, text);
    assert.equal(r.level, LEVEL.SUPPORT, text);
    assert.ok(r.text.split(/\s+/).length <= 40, `${topic} reply is long`);
  }
  for (const r of cases.map(([t]) => chatReply(t))) {
    for (const id of r.activities) assert.ok(ACTIVITIES.some((a) => a.id === id), `unknown activity ${id}`);
  }
});

test('Astro is honest about what it is, and sends symptoms to people', () => {
  assert.match(chatReply('are you a therapist?').text, /not a person or a therapist/);
  assert.match(chatReply('who are you').text, /scripted companion/);
  assert.match(chatReply('my chest hurts').text, /crew medical officer/);
  assert.equal(chatReply('my chest hurts').topic, 'physical');
});

test('Astro does not mistake "not good" for good, and offers a check-in when things are fine', () => {
  assert.equal(chatReply('I am good').topic, 'good');
  assert.equal(chatReply('I am good').checkin, true);
  assert.notEqual(chatReply("I'm not good").topic, 'good');
  assert.notEqual(chatReply("it isn't great").topic, 'good');
});

test('Astro rotates its fixed replies and never invents one', () => {
  const first = chatReply("I'm stressed", []);
  const second = chatReply("I'm stressed", [{ from: 'astro', topic: 'stress' }]);
  const third = chatReply("I'm stressed", [{ from: 'astro', topic: 'stress' }, { from: 'astro', topic: 'stress' }]);
  assert.notEqual(first.text, second.text);
  assert.equal(third.text, first.text);
  const unknown = [0, 1, 2, 3].map((n) => chatReply('zxqv', Array.from({ length: n }, () => ({ from: 'astro', topic: 'other' }))));
  assert.equal(new Set(unknown.map((r) => r.text)).size, 4);
  assert.equal(unknown[3].checkin, true);
  assert.equal(chatReply('').topic, 'other');
});

test('check-in answers are whole numbers inside the scale', () => {
  const [mood, stress] = CHECKIN_STEPS;
  assert.equal(CHECKIN_STEPS.length, 3);
  assert.equal(parseRating('7', mood), 7);
  assert.equal(parseRating(' 7/10 ', mood), 7);
  assert.equal(parseRating('8 out of 10', mood), 8);
  assert.equal(parseRating('0', mood), null);
  assert.equal(parseRating('0', stress), 0);
  assert.equal(parseRating('11', stress), null);
  assert.equal(parseRating('seven', mood), null);
  assert.equal(parseRating('7 I guess', mood), null);
});

test('the Astro screen shows the chat, the check-in scale, activities and the handoff', () => {
  const state = demoState(NOW);
  let html = viewAstro(state);
  assert.ok(html.includes(OPENING.replace(/'/g, '&#39;')));
  assert.match(html, /Start a check-in/);
  assert.match(html, /not a person or a therapist/);
  assert.match(html, /stays on this tablet/);
  assert.doesNotMatch(html, /undefined|NaN/);

  // a check-in question: number buttons replace the quick replies
  state.chat.push({ id: 'a1', from: 'astro', t: NOW, text: CHECKIN_STEPS[1].ask, topic: 'checkin' });
  html = viewAstro(state, { flow: { index: 1, step: CHECKIN_STEPS[1], values: { mood: 7 } } });
  assert.equal((html.match(/data-action="chat-rate"/g) || []).length, 11);
  assert.doesNotMatch(html, /Start a check-in/);

  // a support reply offers its activities
  const reply = chatReply("I'm stressed");
  state.chat.push({ id: 'm1', from: 'me', t: NOW, text: "I'm stressed" }, { id: 'a2', from: 'astro', t: NOW, text: reply.text, topic: reply.topic, level: reply.level, activities: reply.activities });
  html = viewAstro(state);
  assert.match(html, /Box breathing/);
  assert.match(html, /Start a two-minute guide/);
  assert.match(html, /Clear the chat/);

  // a handoff is marked and offers no activity
  state.chat.push({ id: 'a3', from: 'astro', t: NOW, text: HANDOFF_TEXT, topic: 'crisis', level: LEVEL.HANDOFF, activities: [] });
  html = viewAstro(state);
  assert.match(html, /msg-handoff/);
  assert.match(html, /See the flag that was sent/);
  assert.doesNotMatch(html, /class="activities"/);
});

test('what is typed to Astro is escaped, and an empty state still renders', () => {
  const state = emptyState();
  assert.match(viewAstro(state), /No check-ins yet/);
  state.chat.push({ id: 'm1', from: 'me', t: NOW, text: '<script>alert(1)</script>' });
  const html = viewAstro(state);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

// ---------- the concept device ----------

test('the device is drawn only when there is room, and can be hidden', () => {
  assert.equal(deviceFits(1280, 720), true);
  assert.equal(deviceFits(390, 844), false);
  assert.equal(deviceFits(1280, 500), false);
  const store = new Map();
  const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) };
  assert.equal(loadDevicePref(storage), true);
  saveDevicePref(storage, false);
  assert.equal(loadDevicePref(storage), false);
  saveDevicePref(storage, true);
  assert.equal(loadDevicePref(storage), true);
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.equal(loadDevicePref(broken), true);
  assert.equal(saveDevicePref(broken, false), false);
});

test('only blood and urine readings pass through the sample submitter', () => {
  const sample = INDICATORS.filter(usesSampleSubmitter).map((i) => i.id);
  assert.deepEqual(sample, ['glucose', 'vitd', 'potassium', 'urine_vol', 'urine_ca']);
  assert.equal(usesSampleSubmitter(undefined), false);
});

test('the page names the device AeroNYX, the companion Astro, and labels the device a concept', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(page, /<title>AeroNYX/);
  assert.match(page, /class="dv-brand">AeroNYX</);
  assert.match(page, /data-nav="astro" href="#astro"/);
  assert.equal((page.match(/<a data-nav="\w+" href="#\w+"/g) || []).length, 6);
  assert.match(page, /Concept device, drawn with AI from the team's sketch\. No hardware exists\./);
  assert.match(page, /Neither is a doctor or a therapist/);
  const css = readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8');
  assert.match(css, /@media \(min-width: 1000px\) and \(min-height: 600px\)/);
});
