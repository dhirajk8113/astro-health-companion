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
import { viewAstro, viewToday, viewReadings, viewMeds, viewSample, viewEnvironment, viewLock } from '../js/views.js';
import { isCrisisText } from '../js/lib/checkin.js';
import { PANELS, simulateSample } from '../js/lib/sample.js';
import { hasIcon, icon } from '../js/lib/icons.js';
import { skinMarkup, skinParts, skinPose } from '../js/skin.js';
import { VAULT_KEY, deriveKey, seal, open, loadVault, saveVault } from '../js/lib/vault.js';
import { existsSync } from 'node:fs';
import { allAstroLines } from '../tools/voice-lines.mjs';
import { VOICE_LINES, VOICE_NAME } from '../js/data/voice-lines.js';
import { LOOKS, DEFAULT_LOOK, loadLook, saveLook, loadVoicePref, saveVoicePref, pickVoice, personaSvg, speakingMs, typingStep } from '../js/lib/persona.js';
import { validPin, setPin, checkPin, loadLock, afterWrongPin, MAX_TRIES, WAIT_MS, LOCK_KEY } from '../js/lib/lock.js';

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
  assert.match(html, /class="speech is-handoff"/);
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
  assert.match(page, /<span>Concept device, drawn with AI<\/span>/);
  assert.match(page, /data-lock-now/);
  assert.match(page, /Neither is a doctor or a therapist/);
  const css = readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8');
  assert.match(css, /@media \(min-width: 1000px\) and \(min-height: 600px\)/);
});

// ---------- judging pass ----------

test('indirect crisis wording and threats to others hand off; everyday phrases do not', () => {
  const handoff = [
    "I'm thinking of ending things", 'life is not worth living', 'I might jump out the airlock', 'I want to disappear forever',
    'I took too many pills', 'I want to hurt my crewmate', 'nobody would miss me if I was gone', "I've been cutting myself",
    'no one would even notice if I died', 'I could punch the commander', 'they would be better off without me', 'I want to overdose',
  ];
  for (const text of handoff) {
    assert.equal(isCrisisText(text), true, text);
    assert.equal(chatReply(text).level, LEVEL.HANDOFF, text);
  }
  const everyday = [
    'I could die of embarrassment', 'this food is killing me', "I'm dying to see my kids", 'I hit my head', 'I hurt my knee',
    'nobody would care if I skipped exercise', 'I want to end the experiment early', 'I could kill for a coffee', 'I want to hit the gym',
  ];
  for (const text of everyday) assert.equal(isCrisisText(text), false, text);
});

test('Astro says what it can do when asked for help', () => {
  for (const text of ['help', 'what can you do?', 'how does this work']) {
    const r = chatReply(text);
    assert.equal(r.topic, 'help', text);
    assert.match(r.text, /check-in/);
    assert.match(r.text, /crew medical officer/);
  }
  assert.equal(chatReply('I feel sick to my stomach').topic, 'physical');
  assert.notEqual(chatReply('I am sick of this food').topic, 'physical');
});

test('a simulated sample run stays close to the last reading and inside the input limits', () => {
  const state = demoState(NOW);
  for (const kind of Object.keys(PANELS)) {
    const results = simulateSample(kind, state, 12345);
    assert.deepEqual(results.map((r) => r.indicatorId), PANELS[kind].ids);
    assert.deepEqual(simulateSample(kind, state, 12345), results, 'the same seed gives the same values');
    for (const r of results) {
      const indicator = getIndicator(r.indicatorId);
      const list = state.readings.filter((x) => x.indicatorId === r.indicatorId).sort((a, b) => a.t.localeCompare(b.t));
      const last = list[list.length - 1].value;
      assert.ok(Math.abs(r.value - last) <= Math.abs(last) * 0.035 + indicator.input.step, `${r.indicatorId}: ${r.value} is far from ${last}`);
      assert.ok(r.value >= indicator.input.min && r.value <= indicator.input.max);
      assert.ok(usesSampleSubmitter(indicator));
    }
  }
  assert.notDeepEqual(simulateSample('blood', state, 1), simulateSample('blood', state, 2));
  assert.deepEqual(simulateSample('saliva', state, 1), []);
  // with no earlier reading the value starts inside the safe range
  for (const r of simulateSample('blood', emptyState(), 7)) assert.equal(classify(getIndicator(r.indicatorId), r.value).status, 'ok');
});

test('the sample screen shows the choices, the analysis and the results, and says it is simulated', () => {
  const state = demoState(NOW);
  let html = viewSample(state);
  // with demo data the "Demo data" label in the header says it; without, the screen says it itself
  assert.doesNotMatch(html, /no analyser is connected/);
  assert.match(viewSample(emptyState()), /Simulated analysis: no analyser is connected/);
  assert.equal((html.match(/data-action="run-sample"/g) || []).length, 2);
  html = viewSample(state, { sample: { kind: 'blood', state: 'running' } });
  assert.match(html, /Analysing the blood sample/);
  assert.doesNotMatch(html, /data-action="run-sample"/);
  const results = simulateSample('urine', state, 3);
  html = viewSample(state, { sample: { kind: 'urine', state: 'done', results } });
  assert.match(html, /Urine volume/);
  assert.match(html, /Needs attention/);
  assert.match(html, /Run another/);
  assert.doesNotMatch(html, /undefined|NaN/);
});

test('the home screen marks NASA limits, shows icons and counts, and stays short', () => {
  const state = demoState(NOW);
  const plain = viewToday(state);
  // six readings use a NASA limit; the key explains the tag once more
  assert.equal((plain.match(/class="tag-nasa"/g) || []).length, INDICATORS.filter((i) => String(i.limitSource).startsWith('nasa')).length + 1);
  assert.equal(INDICATORS.filter((i) => String(i.limitSource).startsWith('nasa')).length, 6);
  assert.doesNotMatch(plain, /Demo tour/);
  // every reading has its own icon, and the counts are a symbol and a number
  assert.equal((plain.match(/class="gauge-name"><svg class="ico"/g) || []).length, INDICATORS.length);
  for (const i of INDICATORS) assert.ok(hasIcon(i.id), `${i.id} has no icon`);
  assert.match(plain, /chip-attention chip-count" title="1 needs attention"><svg/);
  assert.match(plain, /chip-ok chip-count" title="9 in range"><svg/);
  // space weather as one label: checking, not reachable, replay alert as a banner
  assert.match(viewToday(state, { donki: { status: 'loading', data: null, at: 0 }, replay: false }), /Checking NASA space weather/);
  assert.match(viewToday(state, { donki: { status: 'failed', data: null, at: 0 }, replay: false }), /NASA space weather not reachable/);
  assert.match(viewToday(state, { donki: { status: 'idle', data: null, at: 0 }, replay: true }), /banner-warn/);
});

test('long explanations sit behind disclosures, and blood and urine readings offer a sample run', () => {
  const state = demoState(NOW);
  const visible = (html) => html.replace(/<details class="more[^"]*">[\s\S]*?<\/details>/g, ' ').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  const env = { donki: { status: 'idle', data: null, at: 0 }, replay: true, iss: { state: 'idle', values: {} } };
  const meds = viewMeds(state, NOW);
  const space = viewEnvironment(state, env, NOW);
  assert.ok(visible(meds) < 300, `Medications shows ${visible(meds)} words`);
  assert.ok(visible(space) < 240, `Space shows ${visible(space)} words`);
  assert.ok((meds.match(/<details class="more/g) || []).length >= 3);
  assert.ok((space.match(/<details class="more info">/g) || []).length >= 4);
  // the kit is a plain list, not behind a disclosure
  assert.match(meds, /<\/div>\s*<table class="t-kit">/);
  // nothing was deleted: the sources and the caveats are still in the page
  assert.match(meds, /That list is historical and is not the current formulary/);
  assert.match(space, /so AeroNYX never turns an event into a dose figure/);
  assert.match(space, /a scale, not a forecast/);
  assert.match(viewReadings(state, 'glucose'), /href="#sample"/);
  assert.match(viewReadings(state, 'urine_ca'), /href="#sample"/);
  assert.doesNotMatch(viewReadings(state, 'hr'), /href="#sample"/);
});

// ---------- Astro as a character that speaks ----------

const memory = () => {
  const store = new Map();
  return { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
};

test('Astro has three looks, remembers the chosen one, and marks AI-made drawings', () => {
  assert.deepEqual([...LOOKS], ['character', 'sprite', 'bubble']);
  const storage = memory();
  assert.equal(loadLook(storage), DEFAULT_LOOK);
  saveLook(storage, 'sprite');
  assert.equal(loadLook(storage), 'sprite');
  saveLook(storage, 'hologram');
  assert.equal(loadLook(storage), 'sprite');
  const state = demoState(NOW);
  for (const look of LOOKS) {
    const html = viewAstro(state, { look });
    assert.match(html, new RegExp(`class="card chat astro-${look}"`));
    assert.match(html, new RegExp(`data-look="${look}" aria-pressed="true"`));
    assert.equal((html.match(/data-action="astro-look"/g) || []).length, 3);
    // the drawn looks carry a visible AI mark; the bubble has no drawing to mark
    assert.equal(/Drawn with AI/.test(html), look !== 'bubble');
    assert.equal(personaSvg(look) !== '', look !== 'bubble');
    assert.match(html, /data-astro-line data-id="opening"/);
  }
  assert.match(viewAstro(state, { look: 'nonsense' }), /astro-character/);
});

test('what Astro says now is in the speech bubble; what came before is under Earlier', () => {
  const state = demoState(NOW);
  assert.doesNotMatch(viewAstro(state), /Earlier in this chat/);
  const reply = chatReply("I'm stressed");
  state.chat.push({ id: 'm1', from: 'me', t: NOW, text: "I'm stressed" }, { id: 'a1', from: 'astro', t: NOW, text: reply.text, topic: reply.topic, level: reply.level, activities: reply.activities });
  const html = viewAstro(state);
  assert.match(html, /data-astro-line data-id="a1"/);
  assert.match(html, /class="said"><span class="sr-only">You said: <\/span>I&#39;m stressed</);
  assert.match(html, /Earlier in this chat/);
  // the opening line has moved into the earlier thread, once
  assert.equal(html.split(OPENING.replace(/'/g, '&#39;')).length - 1, 1);
});

test('the voice is on until switched off, and only a voice that runs on the tablet is used', () => {
  const storage = memory();
  assert.equal(loadVoicePref(storage), true);
  saveVoicePref(storage, false);
  assert.equal(loadVoicePref(storage), false);
  const voices = [
    { name: 'Google UK English Female', lang: 'en-GB', localService: false },
    { name: 'Thomas', lang: 'fr-FR', localService: true },
    { name: 'Daniel', lang: 'en-GB', localService: true },
    { name: 'Samantha', lang: 'en-US', localService: true },
  ];
  assert.equal(pickVoice(voices).name, 'Samantha');
  assert.equal(pickVoice(voices.slice(0, 3)).name, 'Daniel');
  // a voice that would send the words to a server is never picked
  assert.equal(pickVoice(voices.slice(0, 2)), null);
  assert.equal(pickVoice([]), null);
  assert.match(viewAstro(demoState(NOW), { voice: true }), /data-action="astro-voice" aria-pressed="true"/);
  assert.match(viewAstro(demoState(NOW), { voice: false }), /data-action="astro-voice" aria-pressed="false"/);
  assert.doesNotMatch(viewAstro(demoState(NOW), { canSpeak: false }), /astro-voice/);
  assert.ok(speakingMs('x'.repeat(5000)) <= 20000);
  assert.ok(typingStep(40) === 1 && typingStep(400) > 1);
});

// ---------- the lock ----------

test('a PIN is four digits, is stored only as a salted hash, and the right one opens the lock', async () => {
  for (const good of ['0000', '4821']) assert.equal(validPin(good), true);
  for (const bad of ['', '123', '12345', '12a4', ' 1234']) assert.equal(validPin(bad), false, bad);
  const storage = memory();
  assert.equal(loadLock(storage), null);
  const lock = await setPin(storage, '4821');
  const raw = storage.getItem(LOCK_KEY);
  assert.ok(!raw.includes('4821'), 'the PIN itself is stored');
  assert.deepEqual(loadLock(storage), lock);
  assert.equal(await checkPin(lock, '4821'), true);
  assert.equal(await checkPin(lock, '4822'), false);
  assert.equal(await checkPin(null, '4821'), false);
  // the same PIN set twice does not give the same hash
  assert.notEqual((await setPin(memory(), '4821')).hash, lock.hash);
  await assert.rejects(setPin(memory(), '12'));
});

test('wrong PINs are counted, and the keypad rests after too many', () => {
  let s = { tries: 0, waitUntil: 0 };
  for (let k = 1; k < MAX_TRIES; k += 1) {
    s = afterWrongPin(s.tries, 1000);
    assert.equal(s.waitUntil, 0);
  }
  s = afterWrongPin(s.tries, 1000);
  assert.equal(s.waitUntil, 1000 + WAIT_MS);
  assert.equal(s.tries, 0);
});

test('the lock screen asks for a badge, then a PIN, and never shows the digits', () => {
  const state = demoState(NOW);
  let html = viewLock(state, { stage: 'badge' });
  assert.match(html, /data-action="lock-scan"/);
  assert.doesNotMatch(html, /pin-pad/);
  assert.match(viewLock(state, { stage: 'badge', scanning: true }), /Reading badge/);
  html = viewLock(state, { stage: 'create', entry: '12' });
  assert.match(html, /Create a PIN/);
  assert.equal((html.match(/class="pin-dot on"/g) || []).length, 2);
  assert.equal((html.match(/data-action="lock-key"/g) || []).length, 10);
  assert.doesNotMatch(html, /Forgot PIN/);
  html = viewLock(state, { stage: 'pin', entry: '', error: 'Wrong PIN' });
  assert.match(html, /Enter PIN/);
  assert.match(html, /Wrong PIN/);
  assert.match(html, /Forgot PIN/);
  assert.match(viewLock(state, { stage: 'pin', waitSeconds: 12 }), /Wait 12 s/);
  assert.match(viewLock(state, { stage: 'pin', confirmReset: true }), /Press again to erase this tablet/);
  assert.ok(icon('badge').startsWith('<svg') && icon('nothing') === '');
});

// ---------- the device drawn like hardware ----------

test('the detailed device is drawn around wherever the screen sits, and its tube and capsule move', () => {
  const at = (W, H) => ({
    W, H, scr: { x: 114, y: 74, w: W - 228, h: H - 122 }, shell: { x: 96, y: 34, w: W - 192, h: H - 52 },
    sample: { x: 18, y: 60, w: 90, h: H - 102 }, meds: { x: W - 108, y: H - 332, w: 90, h: 250 }, clips: [{ x: 211, y: 18 }, { x: W - 263, y: 18 }],
  });
  for (const [W, H] of [[1280, 720], [1024, 640], [1920, 1080]]) {
    const geo = at(W, H);
    const svg = skinMarkup(geo);
    assert.doesNotMatch(svg.still + svg.moving, /NaN|undefined/);
    assert.match(svg.still, new RegExp(`id="sk-still" class="sk" viewBox="0 0 ${W} ${H}"`));
    assert.match(svg.moving, new RegExp(`id="sk-move" class="sk" viewBox="0 0 ${W} ${H}"`));
    // decorative: a screen reader is not told about a drawing
    assert.equal((svg.still + svg.moving).match(/aria-hidden="true"/g).length, 2);
    for (const label of ['SAMPLE', 'MEDS', 'ANALYSER', 'BADGE', 'AeroNYX']) assert.ok(svg.still.includes(`>${label}<`), label);
    const parts = skinParts(geo);
    // the port and the cup stay on their own units
    assert.ok(parts.slot.cx > geo.sample.x && parts.slot.cx < geo.sample.x + geo.sample.w);
    assert.ok(parts.cup.x > geo.meds.x && parts.cup.x + parts.cup.w < geo.meds.x + geo.meds.w);
    assert.ok(parts.cup.y + parts.cup.h < geo.meds.y + geo.meds.h);
    const held = skinPose(parts, { vial: { kind: 'urine', t: 0 } });
    const seated = skinPose(parts, { vial: { kind: 'urine', t: 1 } });
    assert.ok(held.vial.y < 0 && seated.vial.y > held.vial.y);
    assert.equal(seated.vial.x, parts.slot.cx);
    const dropped = skinPose(parts, { pill: 1 });
    assert.ok(dropped.pill.y > parts.cup.y && dropped.pill.y < parts.cup.y + parts.cup.h);
    assert.ok(skinPose(parts, { pill: 0 }).pill.y < parts.cup.y);
  }
  // a short sample unit drops the grip ridges; a tall one has them
  assert.ok(skinMarkup(at(1280, 720)).still.length > skinMarkup(at(1024, 640)).still.length);
  assert.deepEqual(skinPose(skinParts(at(1280, 720)), {}), { vial: null, pill: null });
});

// ---------- the stored record, encrypted ----------

test('the stored record is ciphertext, opens with the right PIN and with no other', async () => {
  const state = demoState(NOW);
  state.chat.push({ id: 'm1', from: 'me', t: NOW, text: 'a private thought about home' });
  const text = JSON.stringify(state);
  const key = await deriveKey('4821', 'a1b2c3');
  const storage = memory();
  assert.equal(loadVault(storage), null);
  const sealed = await seal(key, text);
  saveVault(storage, sealed);
  const raw = storage.getItem(VAULT_KEY);
  // nothing readable is stored: no reading names, no typed words, no PIN
  for (const leak of ['readings', 'Potassium', 'a private thought', 'urine_vol', '4821']) assert.ok(!raw.includes(leak), leak);
  assert.deepEqual(loadVault(storage), sealed);
  assert.equal(await open(key, loadVault(storage)), text);
  assert.deepEqual(JSON.parse(await open(await deriveKey('4821', 'a1b2c3'), sealed)).chat, state.chat);
  // a wrong PIN, another tablet's salt, or changed bytes: the record does not open
  await assert.rejects(async () => open(await deriveKey('4822', 'a1b2c3'), sealed));
  await assert.rejects(async () => open(await deriveKey('4821', 'ffffff'), sealed));
  const flipped = { ...sealed, data: (sealed.data[0] === 'A' ? 'B' : 'A') + sealed.data.slice(1) };
  await assert.rejects(open(key, flipped));
  // the same record sealed twice does not give the same bytes
  const again = await seal(key, text);
  assert.notEqual(again.iv, sealed.iv);
  assert.notEqual(again.data, sealed.data);
  // a damaged entry reads as no vault, not as a crash
  storage.setItem(VAULT_KEY, '{not json');
  assert.equal(loadVault(storage), null);
});

// ---------- Astro's recorded voice ----------

test('every line Astro can say is known, and where the voice is recorded no line is missing', () => {
  const lines = allAstroLines();
  assert.ok(lines.length >= 40, `only ${lines.length} lines`);
  assert.equal(new Set(lines).size, lines.length);
  for (const must of [OPENING, HANDOFF_TEXT, ...CHECKIN_STEPS.map((s) => s.ask)]) assert.ok(lines.includes(must));
  if (Object.keys(VOICE_LINES).length) {
    assert.ok(VOICE_NAME);
    for (const line of lines) {
      const entry = VOICE_LINES[line];
      assert.ok(entry, `no recording for: ${line.slice(0, 60)}`);
      assert.ok(existsSync(new URL(`../media/voice/${entry.file}`, import.meta.url)), `${entry.file} is not in media/voice`);
      assert.ok(entry.seconds > 0.5);
    }
    // nothing recorded that Astro never says
    assert.equal(Object.keys(VOICE_LINES).length, lines.length);
  }
  // an AI-made voice is marked on the screen, in every look
  assert.match(viewAstro(demoState(NOW), { recorded: true }), /Drawn and voiced with AI/);
  assert.match(viewAstro(demoState(NOW), { recorded: true, look: 'bubble' }), /AI voice/);
  assert.doesNotMatch(viewAstro(demoState(NOW), { look: 'bubble' }), /AI voice/);
  // where the tablet's own voice is used, a better one is preferred when the device has it
  const voices = [{ name: 'Samantha', lang: 'en-US', localService: true }, { name: 'Ava (Premium)', lang: 'en-US', localService: true }];
  assert.equal(pickVoice(voices).name, 'Ava (Premium)');
});
