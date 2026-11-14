// Astro health companion: wiring between the screens and the stored state.
//
// AI disclosure: written with an AI coding assistant (Claude). See AI-USE.md.

import { getIndicator } from './data/indicators.js';
import { getMedication } from './data/medications.js';
import { demoState } from './data/demo.js';
import { classify, commDelay, buildReport } from './lib/assess.js';
import { scoreCheckin, sustainedLow, pickActivities, astroReply, LEVEL } from './lib/checkin.js';
import { loadState, saveState, clearState, newId } from './lib/store.js';
import { viewToday, viewReadings, viewMeds, viewCheckin, viewSurgeon, viewSetup, viewAbout } from './views.js';

let state = loadState();
const ui = { checkin: null, confirmClear: false, breathing: null };

const main = document.getElementById('main');
const toastEl = document.getElementById('toast');
const nowISO = () => new Date().toISOString();

function route() {
  const raw = window.location.hash.replace(/^#/, '') || 'today';
  const [name, arg] = raw.split('/');
  return { name, arg };
}

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => toastEl.classList.remove('show'), 2600);
}

function persist() {
  if (!saveState(state)) toast('This browser is not saving data, so it will be lost when the page closes.');
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
  const r = route();
  const saved = keepFields ? captureFields() : null;
  let html;
  switch (r.name) {
    case 'readings': html = viewReadings(state, r.arg); break;
    case 'meds': html = viewMeds(state, nowISO()); break;
    case 'checkin': html = viewCheckin(state, { result: ui.checkin }); break;
    case 'surgeon': html = viewSurgeon(state, nowISO()); break;
    case 'setup': html = viewSetup(state); break;
    case 'about': html = viewAbout(); break;
    default: html = viewToday(state);
  }
  main.innerHTML = html;
  if (saved) restoreFields(saved);
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const on = a.dataset.nav === (r.name || 'today');
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  if (ui.confirmClear && r.name === 'setup') {
    const btn = main.querySelector('[data-action="clear-all"]');
    if (btn) btn.textContent = 'Press again to clear everything';
  }
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

const actions = {
  'load-demo': () => {
    state = demoState(nowISO());
    ui.checkin = null;
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
    ui.checkin = null;
    state = clearState();
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
    render();
  },
  checkin: (form) => {
    const data = new FormData(form);
    let score;
    try {
      score = scoreCheckin({
        mood: data.get('mood'),
        stress: data.get('stress'),
        loneliness: data.get('loneliness'),
        text: data.get('text'),
      });
    } catch (err) {
      toast(err.message);
      return;
    }
    const now = nowISO();
    // The ratings are stored. What was typed is used once for the safety check and then dropped.
    const entry = { id: newId('c'), t: now, mood: score.mood, stress: score.stress, loneliness: score.loneliness, level: score.level, activity: null };
    state.checkins.push(entry);
    state.readings.push({ id: newId('r'), indicatorId: 'mood', t: now, value: score.mood, source: 'check-in', note: 'From a check-in' });
    const sustained = sustainedLow(state.checkins, state.profile.baselines.mood);
    ui.checkin = { score, reply: astroReply(score, { sustained }), activities: pickActivities(score) };
    if (score.level === LEVEL.HANDOFF) sendReport('Sent automatically: Astro handed a check-in off to people.', true);
    persist();
    render();
    const chat = main.querySelector('.chat');
    if (chat) chat.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      from: 'Flight surgeon (demo)',
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
  ui.confirmClear = false;
  if (route().name !== 'checkin') ui.checkin = null;
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

render();
