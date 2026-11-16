// AeroNYX: wiring between the screens and the stored state.
//
// AI disclosure: written with an AI coding assistant (Claude). See AI-USE.md.

import { getIndicator } from './data/indicators.js';
import { getMedication } from './data/medications.js';
import { demoState } from './data/demo.js';
import { classify, commDelay, buildReport } from './lib/assess.js';
import { scoreCheckin, sustainedLow, pickActivities, astroReply, isCrisisText, LEVEL } from './lib/checkin.js';
import { chatReply, parseRating, CHECKIN_STEPS } from './lib/chat.js';
import { usesSampleSubmitter } from './lib/device.js';
import { PANELS, simulateSample } from './lib/sample.js';
import { initDevice } from './device.js';
import { initSkin } from './skin.js';
import { loadVoicePref, saveVoicePref, speakingMs, typingStep } from './lib/persona.js';
import { hasSpeech, hasRecordings, recordingMs, speak, hush } from './voice.js';
import { loadState, saveState, clearState, isFirstVisit, newId, hasPlainState } from './lib/store.js';
import { viewToday, viewReadings, viewMeds, viewAstro, viewSample, viewSurgeon, viewSetup, viewAbout, viewEnvironment } from './views.js';
import { fetchDonki } from './lib/spaceweather.js';
import { connectIss } from './lib/isslive.js';

// The record is kept in this browser's storage, unencrypted, and is not sent
// anywhere. The app opens straight on the home screen: there is no lock.
let state = loadState();
// A browser with nothing saved opens with the simulated demo data.
const firstVisit = isFirstVisit();
if (firstVisit || !hasPlainState()) {
  state = demoState(new Date().toISOString());
}
// An earlier version locked the tablet with a PIN and stored the record
// encrypted under it. That record cannot be opened without the PIN, so what
// that version left in this browser is removed.
try {
  window.localStorage.removeItem('aeronyx.lock.v1');
  window.localStorage.removeItem('aeronyx.vault.v1');
} catch (err) { /* nothing stored */ }
// flow: the check-in question Astro is waiting on, while one is being asked in the chat.
// sample: a run of the sample submitter, while it is analysing or showing results.
// voice: whether Astro says its lines aloud.
// fresh: the id of a line Astro has just said and has yet to act out.
const ui = {
  flow: null, sample: null, confirmClear: false, breathing: null,
  voice: loadVoicePref(window.localStorage), fresh: null, greeted: false,
};


// Real NASA data that lives outside the saved state: space weather from DONKI
// and the live ISS cabin feed. Neither is stored on the device.
const env = { donki: { status: 'idle', data: null, at: 0 }, replay: false, iss: { state: 'idle', values: {} } };
let issClose = null;
let issTimer = null;

function loadWeather() {
  const age = Date.now() - env.donki.at;
  if (env.donki.status === 'loading') return;
  if (env.donki.status === 'live' && age < 30 * 60000) return;
  if (env.donki.status === 'failed' && age < 5 * 60000) return;
  env.donki = { ...env.donki, status: 'loading' };
  fetchDonki()
    .then((data) => { env.donki = { status: 'live', data, at: Date.now() }; })
    .catch(() => { env.donki = { status: 'failed', data: null, at: Date.now() }; })
    .finally(() => {
      const name = route().name;
      if (name === 'environment' || name === 'today') render({ keepFields: true });
    });
}

function syncEnvironment(name) {
  if (name === 'environment' || name === 'today') loadWeather();
  if (name === 'environment') {
    if (!issClose) {
      issClose = connectIss((snapshot) => {
        env.iss = snapshot;
        if (issTimer) return;
        issTimer = window.setTimeout(() => {
          issTimer = null;
          if (route().name === 'environment') render({ keepFields: true });
        }, 1500);
      });
    }
  } else if (issClose) {
    issClose();
    issClose = null;
    env.iss = { state: 'idle', values: {} };
  }
}

const main = document.getElementById('main');
const toastEl = document.getElementById('toast');
const nowISO = () => new Date().toISOString();

function route() {
  const raw = window.location.hash.replace(/^#/, '') || 'today';
  const [name, arg] = raw.split('/');
  // The check-in now lives inside the Astro chat; old links still work.
  return { name: name === 'checkin' ? 'astro' : name, arg };
}

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => toastEl.classList.remove('show'), 2600);
}

// Saves the record in this browser's storage.
function persist() {
  if (!saveState(state)) toast('This browser is not saving data, so it will be lost when the page closes.');
  return Promise.resolve();
}

// Keep what someone is typing when a screen redraws itself.
function captureFields() {
  const kept = [];
  main.querySelectorAll('form[data-form]').forEach((form) => {
    form.querySelectorAll('input, textarea, select').forEach((el) => {
      if (el.name) kept.push({ form: form.dataset.form, name: el.name, value: el.value });
    });
  });
  const active = document.activeElement;
  const focus = active && active.name && active.form ? { form: active.form.dataset.form, name: active.name } : null;
  const open = [...main.querySelectorAll('details[open]')].map((d) => [...main.querySelectorAll('details')].indexOf(d));
  return { kept, focus, open };
}

function restoreFields({ kept, focus, open }) {
  for (const k of kept) {
    const el = main.querySelector(`form[data-form="${k.form}"] [name="${k.name}"]`);
    if (el) el.value = k.value;
  }
  const all = main.querySelectorAll('details');
  open.forEach((i) => { if (all[i]) all[i].open = true; });
  if (focus) {
    const el = main.querySelector(`form[data-form="${focus.form}"] [name="${focus.name}"]`);
    if (el) el.focus();
  }
}

function render({ keepFields = false } = {}) {
  stopAct();
  const r = route();
  syncEnvironment(r.name);
  const saved = keepFields ? captureFields() : null;
  let html;
  switch (r.name) {
    case 'readings': html = viewReadings(state, r.arg); break;
    case 'meds': html = viewMeds(state, nowISO()); break;
    case 'astro': html = viewAstro(state, { flow: ui.flow, voice: ui.voice, canSpeak: hasSpeech(), recorded: hasRecordings() }); break;
    case 'sample': html = viewSample(state, { sample: ui.sample }); break;
    case 'surgeon': html = viewSurgeon(state, nowISO()); break;
    case 'setup': html = viewSetup(state); break;
    case 'about': html = viewAbout(); break;
    case 'environment': html = viewEnvironment(state, env, nowISO()); break;
    default: html = viewToday(state, env);
  }
  main.innerHTML = html;
  if (saved) restoreFields(saved);
  const chip = document.getElementById('demo-chip');
  if (chip) chip.hidden = !state.profile.simulated;
  // Keep the newest message of the chat in view.
  const thread = main.querySelector('.thread');
  if (thread) thread.scrollTop = thread.scrollHeight;
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const on = a.dataset.nav === (r.name === 'sample' ? 'readings' : r.name || 'today');
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  if (ui.confirmClear && r.name === 'setup') {
    const btn = main.querySelector('[data-action="clear-all"]');
    if (btn) btn.textContent = 'Press again to clear everything';
  }
  if (r.name === 'astro') perform();
}

// ---------- Astro speaks ----------

// The line Astro is acting out: its timers. Replaced whenever the screen is redrawn.
let act = null;

function stopAct() {
  if (!act) return;
  window.clearInterval(act.typing);
  window.clearTimeout(act.done);
  act = null;
}

// Astro says a new line: it is written out in the speech bubble, the character
// talks, and the tablet's own voice reads it aloud when the voice is on.
function perform() {
  const lineEl = main.querySelector('[data-astro-line]');
  const stage = main.querySelector('[data-astro-stage]');
  if (!lineEl || !stage) return;
  const id = lineEl.dataset.id;
  const greeting = id === 'opening' && !ui.greeted;
  if (ui.fresh !== id && !greeting) return;
  ui.fresh = null;
  if (id === 'opening') ui.greeted = true;
  const text = lineEl.textContent;
  const mine = { typing: 0, done: 0 };
  act = mine;
  stage.classList.add('is-speaking');
  let written = false;
  let spoken = false;
  const settle = () => {
    if (act !== mine || !written || !spoken) return;
    stopAct();
    stage.classList.remove('is-speaking');
  };
  const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (calm) {
    written = true;
  } else {
    // The whole line stays in place, unseen, so the bubble keeps its size while the words appear.
    lineEl.innerHTML = '<span class="sr-only"></span><span class="type-ghost" aria-hidden="true"></span><span class="type-out" aria-hidden="true"></span>';
    lineEl.children[0].textContent = text;
    lineEl.children[1].textContent = text;
    const out = lineEl.children[2];
    const step = typingStep(text.length);
    let shown = 0;
    mine.typing = window.setInterval(() => {
      shown = Math.min(text.length, shown + step);
      out.textContent = text.slice(0, shown);
      if (shown >= text.length) {
        window.clearInterval(mine.typing);
        written = true;
        settle();
      }
    }, 24);
  }
  const voiced = ui.voice && speak(text, () => { spoken = true; settle(); });
  // If the voice never reports its end, stop the character talking once the line must be over.
  const longest = Math.max(speakingMs(text) + 4000, recordingMs(text) + 1500);
  mine.done = window.setTimeout(() => { spoken = true; settle(); }, voiced ? longest : Math.min(2800, speakingMs(text)));
}

// Act out whatever Astro is saying now once more, after its voice is switched back on.
function repeatLine() {
  const el = main.querySelector('[data-astro-line]');
  ui.fresh = el ? el.dataset.id : null;
  if (ui.fresh === 'opening') ui.greeted = false;
}

function stopBreathing() {
  if (ui.breathing) {
    window.clearInterval(ui.breathing);
    ui.breathing = null;
  }
}

function startBreathing() {
  stopBreathing();
  const el = document.getElementById('breathing-guide');
  if (!el) return;
  const phases = ['Breathe in', 'Hold', 'Breathe out', 'Hold'];
  let elapsed = 0;
  const total = 120;
  const tick = () => {
    const guide = document.getElementById('breathing-guide');
    if (!guide || elapsed >= total) {
      stopBreathing();
      if (guide) guide.textContent = 'Done. Notice how you feel now compared with two minutes ago.';
      return;
    }
    const phase = phases[Math.floor(elapsed / 4) % 4];
    guide.textContent = `${phase}… ${4 - (elapsed % 4)}`;
    elapsed += 1;
  };
  tick();
  ui.breathing = window.setInterval(tick, 1000);
}

function sendReport(note, auto) {
  const now = nowISO();
  const delay = commDelay(state.profile.mission);
  state.outbox.push({
    id: newId('out'),
    createdAt: now,
    deliverAt: new Date(Date.now() + delay.demoSeconds * 1000).toISOString(),
    payload: buildReport(state, now, note),
    auto: Boolean(auto),
  });
}

// ---------- Astro, the chat companion ----------

function say(from, text, extra = {}) {
  const id = newId('m');
  if (from === 'astro') ui.fresh = id;
  state.chat.push({ id, from, t: nowISO(), text, ...extra });
  if (state.chat.length > 80) state.chat = state.chat.slice(-80);
}

// Astro asks one check-in question; the answer is a tapped or typed number.
function askStep(index) {
  const step = CHECKIN_STEPS[index];
  ui.flow = { index, step, values: ui.flow ? ui.flow.values : {} };
  say('astro', step.ask, { topic: 'checkin' });
}

function finishCheckin(values) {
  const score = scoreCheckin({ ...values, text: '' });
  const now = nowISO();
  state.checkins.push({ id: newId('c'), t: now, mood: score.mood, stress: score.stress, loneliness: score.loneliness, level: score.level, activity: null });
  state.readings.push({ id: newId('r'), indicatorId: 'mood', t: now, value: score.mood, source: 'check-in', note: 'From a check-in' });
  const sustained = sustainedLow(state.checkins, state.profile.baselines.mood);
  const reply = astroReply(score, { sustained });
  const handoff = score.level === LEVEL.HANDOFF;
  say('astro', `${reply.title} ${reply.lines.join(' ')}`, {
    topic: 'checkin',
    level: score.level,
    activities: handoff ? [] : pickActivities(score).map((a) => a.id),
  });
  if (handoff) sendReport('Sent automatically: Astro handed a check-in off to people.', true);
}

function answerStep(n) {
  const { index, step, values } = ui.flow;
  values[step.key] = n;
  say('me', String(n));
  if (index + 1 < CHECKIN_STEPS.length) {
    askStep(index + 1);
  } else {
    ui.flow = null;
    finishCheckin(values);
  }
}

// Something was typed or tapped in the chat.
function hear(raw) {
  const said = String(raw || '').trim().slice(0, 500);
  if (!said) return;
  if (ui.flow && !isCrisisText(said)) {
    const n = parseRating(said, ui.flow.step);
    if (n === null) {
      say('me', said);
      say('astro', `Pick a number from ${ui.flow.step.min} to ${ui.flow.step.max}. You can tap one below.`, { topic: 'checkin' });
    } else {
      answerStep(n);
    }
  } else {
    ui.flow = null;
    const reply = chatReply(said, state.chat);
    say('me', said);
    say('astro', reply.text, { topic: reply.topic, level: reply.level, activities: reply.activities });
    // The flag carries the ratings on record, never what was typed.
    if (reply.level === LEVEL.HANDOFF) sendReport('Sent automatically: Astro handed a conversation off to people.', true);
  }
  persist();
  render();
  const input = main.querySelector('form[data-form="chat"] input[name="text"]');
  if (input) input.focus();
}

const actions = {
  'toggle-replay': () => {
    env.replay = !env.replay;
    render();
  },
  'iss-reconnect': () => {
    if (issClose) issClose();
    issClose = null;
    render();
  },
  'load-demo': () => {
    state = demoState(nowISO());
    ui.flow = null;
    persist();
    toast('Simulated demo data loaded.');
    if (route().name === 'today') render(); else window.location.hash = '#today';
  },
  'clear-all': () => {
    if (!ui.confirmClear) {
      ui.confirmClear = true;
      render();
      return;
    }
    ui.confirmClear = false;
    ui.flow = null;
    state = clearState();
    persist();
    toast('Everything on this device was cleared.');
    render();
  },
  'delete-reading': (el) => {
    state.readings = state.readings.filter((r) => r.id !== el.dataset.id);
    persist();
    toast('Reading deleted.');
    render();
  },
  'take-dose': (el) => {
    const p = state.prescriptions.find((x) => x.id === el.dataset.id);
    if (!p) return;
    if ((state.inventory[p.medId] ?? 0) <= 0) {
      toast('None left in the kit. Tell your flight surgeon.');
      return;
    }
    state.inventory[p.medId] -= 1;
    state.doses.push({ id: newId('dose'), prescriptionId: p.id, t: nowISO(), status: 'taken', note: '' });
    persist();
    toast(`${p.name} dose dispensed and logged.`);
    document.dispatchEvent(new CustomEvent('aeronyx:dose'));
    render();
  },
  'skip-dose': (el) => {
    const p = state.prescriptions.find((x) => x.id === el.dataset.id);
    if (!p) return;
    state.doses.push({ id: newId('dose'), prescriptionId: p.id, t: nowISO(), status: 'skipped', note: 'Logged as skipped' });
    persist();
    toast('Logged as skipped. Your flight surgeon will see it in the next report.');
    render();
  },
  'accept-rx': (el) => {
    const m = state.inbox.find((x) => x.id === el.dataset.id);
    if (!m || !m.prescription || m.accepted) return;
    const rx = m.prescription;
    state.prescriptions.push({
      id: newId('rx'),
      medId: rx.medId,
      name: rx.name,
      dose: rx.dose,
      everyHours: rx.everyHours,
      start: nowISO(),
      end: null,
      linkedIndicator: rx.linkedIndicator,
      prescriber: m.from,
      instructions: '',
    });
    m.accepted = true;
    persist();
    toast(`${rx.name} added to your schedule.`);
    render();
  },
  // The sample submitter: a simulated analysis that logs one reading per indicator in the panel.
  'run-sample': (el) => {
    const kind = el.dataset.kind;
    if (!PANELS[kind] || (ui.sample && ui.sample.state === 'running')) return;
    ui.sample = { kind, state: 'running' };
    document.dispatchEvent(new CustomEvent('aeronyx:sample', { detail: { kind } }));
    render();
    window.setTimeout(() => {
      const now = nowISO();
      const results = simulateSample(kind, state, Date.now());
      for (const r of results) {
        state.readings.push({ id: newId('r'), indicatorId: r.indicatorId, t: now, value: r.value, source: 'simulated', note: 'Simulated sample run' });
      }
      ui.sample = { kind, state: 'done', results };
      persist();
      toast('Sample analysed. Results logged.');
      if (route().name === 'sample') render();
    }, 2600);
  },
  'sample-again': () => {
    ui.sample = null;
    render();
  },
  'chat-say': (el) => hear(el.dataset.text),
  'chat-checkin': () => {
    ui.flow = null;
    askStep(0);
    persist();
    render();
  },
  'chat-rate': (el) => {
    if (!ui.flow) return;
    answerStep(Number.parseInt(el.dataset.value, 10));
    persist();
    render();
  },
  'chat-clear': () => {
    state.chat = [];
    ui.flow = null;
    hush();
    persist();
    render();
  },
  'astro-voice': () => {
    ui.voice = !ui.voice;
    saveVoicePref(window.localStorage, ui.voice);
    if (ui.voice) repeatLine(); else hush();
    render();
  },
  'start-breathing': () => startBreathing(),
  'activity-done': (el) => {
    const last = state.checkins[state.checkins.length - 1];
    if (last) {
      last.activity = el.dataset.id;
      persist();
    }
    toast('Nice. Logged with your check-in.');
  },
};

const forms = {
  'add-reading': (form) => {
    const indicator = getIndicator(form.dataset.indicator);
    const data = new FormData(form);
    const value = Number.parseFloat(data.get('value'));
    const value2 = indicator.pair ? Number.parseFloat(data.get('value2')) : undefined;
    try {
      classify(indicator, value, value2);
    } catch (err) {
      toast(err.message);
      return;
    }
    const reading = { id: newId('r'), indicatorId: indicator.id, t: nowISO(), value, source: 'manual' };
    if (indicator.pair) reading.value2 = value2;
    const note = String(data.get('note') || '').trim().slice(0, 120);
    if (note) reading.note = note;
    state.readings.push(reading);
    persist();
    toast(`${indicator.name} saved.`);
    if (usesSampleSubmitter(indicator)) document.dispatchEvent(new CustomEvent('aeronyx:sample', { detail: { kind: indicator.group } }));
    render();
  },
  chat: (form) => {
    hear(new FormData(form).get('text'));
  },
  'note-home': (form) => {
    const text = String(new FormData(form).get('text') || '').trim().slice(0, 2000);
    if (!text) {
      toast('Write something first.');
      return;
    }
    state.notesHome.push({ id: newId('n'), t: nowISO(), text });
    persist();
    toast('Note saved on this device.');
    render({ keepFields: false });
  },
  'send-report': (form) => {
    const note = String(new FormData(form).get('note') || '').trim();
    sendReport(note, false);
    persist();
    toast('Report sent.');
    render();
  },
  'surgeon-reply': (form) => {
    const data = new FormData(form);
    const text = String(data.get('text') || '').trim().slice(0, 2000);
    if (!text) return;
    const delay = commDelay(state.profile.mission);
    const message = {
      id: newId('in'),
      from: 'Flight surgeon',
      sentAt: nowISO(),
      deliverAt: new Date(Date.now() + delay.demoSeconds * 1000).toISOString(),
      text,
    };
    const med = getMedication(String(data.get('medId') || ''));
    if (med) {
      const hoursRaw = String(data.get('everyHours') || '').trim();
      const hours = hoursRaw === '' ? med.defaultEveryHours : Math.max(0, Math.min(720, Number.parseInt(hoursRaw, 10) || 0));
      message.prescription = {
        medId: med.id,
        name: med.name,
        dose: String(data.get('dose') || '').trim().slice(0, 40) || med.defaultDose,
        everyHours: hours,
        linkedIndicator: med.linkedIndicator,
      };
    }
    state.inbox.push(message);
    persist();
    toast('Reply sent to the spacecraft.');
    render();
  },
  profile: (form) => {
    const data = new FormData(form);
    state.profile.name = String(data.get('name') || '').trim().slice(0, 60) || 'Crew member';
    state.profile.mission = String(data.get('mission') || 'iss');
    const baselines = {};
    for (const [key, raw] of data.entries()) {
      if (!key.startsWith('baseline-')) continue;
      const v = Number.parseFloat(raw);
      if (Number.isFinite(v)) baselines[key.slice('baseline-'.length)] = v;
    }
    state.profile.baselines = baselines;
    persist();
    toast('Setup saved.');
    render();
  },
};

main.addEventListener('click', (event) => {
  const el = event.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (!fn) return;
  event.preventDefault();
  if (el.dataset.action !== 'clear-all') ui.confirmClear = false;
  fn(el);
});

main.addEventListener('submit', (event) => {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  const fn = forms[form.dataset.form];
  if (fn) fn(form);
});

main.addEventListener('input', (event) => {
  const el = event.target;
  if (el.type === 'range' && el.dataset.output) {
    const out = document.getElementById(el.dataset.output);
    if (out) out.textContent = el.value;
  }
});


window.addEventListener('hashchange', () => {
  stopBreathing();
  hush();
  ui.confirmClear = false;
  if (route().name !== 'astro') ui.flow = null;
  if (route().name !== 'sample' && ui.sample && ui.sample.state === 'done') ui.sample = null;
  render();
  window.scrollTo(0, 0);
});

// Reports and replies travel with a delay. Redraw the flight surgeon screen
// once a second while anything is in transit, keeping whatever is being typed.
window.setInterval(() => {
  if (route().name !== 'surgeon') return;
  const now = Date.now();
  const moving = [...state.outbox, ...state.inbox].some((x) => new Date(x.deliverAt).getTime() > now - 1500);
  if (moving) render({ keepFields: true });
}, 1000);

// Keep the ages on the Environment screen current.
window.setInterval(() => {
  if (route().name === 'environment') render({ keepFields: true });
}, 30000);

initDevice();
initSkin();
render();
