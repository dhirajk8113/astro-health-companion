// AeroNYX: screens, built as HTML strings from the state.
//
// AI disclosure: written with an AI coding assistant (Claude). See AI-USE.md.

import { INDICATORS, GROUPS, HAZARDS, SOURCES, STATUS, LIMIT_SOURCES, getIndicator } from './data/indicators.js';
import { RADLAB_ISS, QUALITY_FACTOR, DOSE_RATES, doseRateFor, radlabMeanMsvPerDay, DONKI_MAY_2024, I4_PANEL } from './data/nasa-snapshots.js';
import { marsLightSeconds, earthMarsDistanceAU, formatDelay, AU_KM } from './lib/ephemeris.js';
import { summarise, isMeasured } from './lib/spaceweather.js';
import { ISS_ITEMS, cabinStatus, formatAge } from './lib/isslive.js';
import { MEDICATIONS, getMedication } from './data/medications.js';
import {
  overview, counts, readingsFor, assessReading, trend, beforeAfter,
  adherence, nextDose, commDelay, MISSIONS, buildReport, lowerFirst,
} from './lib/assess.js';
import { BOUNDARY, LEVEL, ACTIVITIES } from './lib/checkin.js';
import { OPENING } from './lib/chat.js';
import { gaugeFor, gaugePosition } from './lib/gauge.js';
import { PANELS } from './lib/sample.js';
import { lineChart } from './lib/chart.js';
import { icon } from './lib/icons.js';
import { personaSvg } from './lib/persona.js';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const STATUS_TEXT = {
  [STATUS.OK]: 'In range',
  [STATUS.WATCH]: 'Watch',
  [STATUS.ATTENTION]: 'Needs attention',
};
const STATUS_ICON = { [STATUS.OK]: '✓', [STATUS.WATCH]: '!', [STATUS.ATTENTION]: '▲' };
const TREND_TEXT = { rising: '↗ rising', falling: '↘ falling', steady: '→ steady', unknown: '' };

export function pill(status) {
  return `<span class="pill pill-${esc(status)}"><span aria-hidden="true">${STATUS_ICON[status]}</span> ${STATUS_TEXT[status]}</span>`;
}

export function fmtValue(indicator, reading) {
  if (!reading) return '–';
  const dp = indicator.input.step < 1 ? 1 : 0;
  const v = Number(reading.value).toFixed(dp);
  if (indicator.pair) return `${v}/${Number(reading.value2).toFixed(dp)}`;
  return v;
}

export function fmtWhen(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDelta(indicator, delta) {
  if (!delta) return '';
  if (indicator.id === 'dose') return '';
  if (indicator.baseline && indicator.baseline.mode === 'abs') {
    const sign = delta.abs > 0 ? '+' : '';
    return `${sign}${delta.abs.toFixed(0)} from baseline`;
  }
  if (delta.pct === null) return '';
  const sign = delta.pct > 0 ? '+' : '';
  return `${sign}${delta.pct.toFixed(1)}% from baseline`;
}

// Secondary text sits behind a disclosure, so each screen can be read at a glance.
function more(label, html) {
  return `<details class="more"><summary>${esc(label)}</summary>${html}</details>`;
}

// A sentence that explains, behind an "i" button, so the screen itself stays numbers and pictures.
function info(html, label = 'More about this') {
  return `<details class="more info"><summary aria-label="${esc(label)}" title="${esc(label)}">${icon('info', 18)}</summary><div class="info-body">${html}</div></details>`;
}

function sourceLinks(sources) {
  return sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join('');
}

// ---------- Today ----------

const STATUS_RANK = { [STATUS.ATTENTION]: 0, [STATUS.WATCH]: 1, [STATUS.OK]: 2 };

// One reading as a marker on a bar. The green band is the safe range.
function gaugeRow(item, baselines) {
  const { indicator, latest, assessment } = item;
  const gauge = gaugeFor(indicator, baselines[indicator.id]);
  const href = `#readings/${esc(indicator.id)}`;
  // Marks the readings whose safe range is NASA's own published limit.
  const nasa = String(indicator.limitSource).startsWith('nasa') ? '<span class="tag-nasa" title="The safe range is NASA\'s published limit">NASA</span>' : '';
  const name = `<span class="gauge-name">${icon(indicator.id, 18)}${esc(gauge.short)}${nasa}</span>`;
  if (!assessment) {
    return `<a class="gauge gauge-none" href="${href}">
      <span class="gauge-top">${name}<span class="gauge-value muted">No reading yet</span></span>
      <span class="gauge-bar" aria-hidden="true"></span>
    </a>`;
  }
  const pos = gaugePosition(gauge, Number(latest.value));
  const bar = pos
    ? `<span class="gauge-band" style="left:${pos.bandLeft}%;width:${pos.bandWidth}%"></span><span class="gauge-mark" style="left:${pos.marker}%"></span>`
    : '';
  return `<a class="gauge gauge-${esc(assessment.status)}" href="${href}">
      <span class="gauge-top">${name}<span class="gauge-value"><strong>${esc(fmtValue(indicator, latest))}</strong> <span class="gauge-unit">${esc(gauge.unit)}</span></span></span>
      <span class="gauge-bar" aria-hidden="true">${bar}</span>
      <span class="sr-only">${STATUS_TEXT[assessment.status]}</span>
    </a>`;
}

// How many readings stand at each status: a symbol and a number.
function countChip(kind, n, label) {
  const symbol = { attention: 'warn', watch: 'watch', ok: 'ok' }[kind];
  return `<span class="chip chip-${kind} chip-count" title="${n} ${label}">${icon(symbol, 14)}<strong>${n}</strong><span class="sr-only"> ${label}</span></span>`;
}

// Live NASA space weather, as one small label on the home screen.
function weatherChip(env) {
  if (!env || !env.donki) return '';
  const w = currentWeather(env, Date.now());
  if (w && w.summary.alert) return '';
  if (w) return `<a class="chip chip-space" href="#environment" title="Space weather quiet · NASA ${w.replay ? 'replay' : 'live'}">${icon('sun', 14)}Quiet <span class="tag-nasa">NASA</span></a>`;
  if (env.donki.status === 'loading') return `<span class="chip" title="Checking NASA space weather">${icon('sun', 14)}…</span>`;
  if (env.donki.status === 'failed') return `<a class="chip" href="#environment" title="NASA space weather not reachable">${icon('sun', 14)}Offline</a>`;
  return '';
}

// A radiation warning at the top of the home screen, when a NASA line is crossed.
function radiationBanner(state, env) {
  const r = radiationLevel(state, env, Date.now());
  if (r.over) return `<a class="banner banner-alert banner-link" href="#environment" role="status">${icon('warn', 20)}<span><strong>Radiation: NASA career limit reached.</strong> ${r.dose.toFixed(1)} of ${r.limit} mSv.</span></a>`;
  if (r.storm) return `<a class="banner banner-warn banner-link" href="#environment" role="status">${icon('warn', 20)}<span><strong>Solar particle event${r.replay ? ' (replay of May 2024)' : ''}.</strong> Shelter, then log your dosimeter.</span></a>`;
  return '';
}

export function viewToday(state, env = null) {
  const items = overview(state);
  const c = counts(items);
  const any = items.some((i) => i.assessment);
  const rank = (i) => (i.assessment ? STATUS_RANK[i.assessment.status] : 3);
  // Readings that need attention first, then the ones to watch, then the rest in their usual order.
  const sorted = items.map((item, index) => ({ item, index }))
    .sort((a, b) => rank(a.item) - rank(b.item) || a.index - b.index)
    .map((x) => x.item);
  const half = Math.ceil(sorted.length / 2);
  const column = (list) => `<div class="gauge-col">${list.map((i) => gaugeRow(i, state.profile.baselines)).join('')}</div>`;
  const chips = any
    ? `${c.attention ? countChip('attention', c.attention, c.attention === 1 ? 'needs attention' : 'need attention') : ''}
       ${c.watch ? countChip('watch', c.watch, 'to watch') : ''}
       ${countChip('ok', c.ok, 'in range')}
       ${c.none ? `<span class="chip" title="${c.none} with no reading">${c.none} –</span>` : ''}`
    : '';

  return `
    ${radiationBanner(state, env)}
    <div class="home-head">
      <h1>Today</h1>
      ${chips}
      ${weatherChip(env)}
    </div>
    ${any ? '' : `<section class="card">
      <h2>Start here</h2>
      <p>Add your own readings under Readings, or load 60 days of simulated data to see every screen working.</p>
      <button class="button" data-action="load-demo">Load simulated demo data</button>
      <a class="button secondary" href="#setup">Set my baselines</a>
    </section>`}
    <div class="gauges">${column(sorted.slice(0, half))}${column(sorted.slice(half))}</div>
    <p class="gauge-key"><span class="gauge-key-band" aria-hidden="true"></span>Safe range <span class="tag-nasa">NASA</span> NASA limit</p>`;
}

// ---------- Readings ----------

export function viewReadings(state, selectedId) {
  const indicator = getIndicator(selectedId) || INDICATORS[0];
  const list = readingsFor(state.readings, indicator.id);
  const latest = list.length ? list[list.length - 1] : null;
  const baseline = state.profile.baselines[indicator.id];
  const assessment = latest ? assessReading(indicator, latest, baseline) : null;
  const tr = trend(list);
  const rx = state.prescriptions.find((p) => p.linkedIndicator === indicator.id);

  const nav = GROUPS.map((g) => `
    <div class="nav-group">
      <h3>${esc(g.name)}</h3>
      ${INDICATORS.filter((i) => i.group === g.id).map((i) => `<a class="nav-item${i.id === indicator.id ? ' active' : ''}" href="#readings/${esc(i.id)}">${esc(i.name)}</a>`).join('')}
    </div>`).join('');

  const second = indicator.pair
    ? `<label>${esc(indicator.pair.second)}<input name="value2" type="number" inputmode="decimal" required min="${indicator.input.min}" max="${indicator.input.max}" step="${indicator.input.step}"></label>`
    : '';
  const firstLabel = indicator.pair ? indicator.pair.first : `Value (${indicator.unit})`;

  const rows = [...list].reverse().slice(0, 12).map((r) => {
    const a = assessReading(indicator, r, baseline);
    return `<tr>
      <td>${esc(fmtWhen(r.t))}</td>
      <td class="num">${esc(fmtValue(indicator, r))}</td>
      <td>${pill(a.status)}</td>
      <td>${esc(r.note || (r.source === 'simulated' ? 'Simulated' : ''))}</td>
      <td><button class="link" data-action="delete-reading" data-id="${esc(r.id)}" aria-label="Delete this reading">Delete</button></td>
    </tr>`;
  }).join('');

  const status = assessment
    ? `<div class="status-line">
        <span class="value big">${esc(fmtValue(indicator, latest))}</span> <span class="unit">${esc(indicator.unit)}</span>
        ${pill(assessment.status)}
        <span class="muted">${esc(fmtDelta(indicator, assessment.delta))} ${esc(TREND_TEXT[tr.direction])}</span>
      </div>
      <p>${esc(assessment.reason.charAt(0).toUpperCase() + assessment.reason.slice(1))}. <strong>What to do:</strong> ${esc(indicator.actions[assessment.status])}</p>`
    : '<p class="muted">No reading yet. Add the first one below.</p>';

  return `
    <div class="split">
      <nav class="side" aria-label="Indicators">${nav}</nav>
      <div class="main-col">
        <section class="card">
          <p class="eyebrow">${esc(indicator.sample)} · ${esc(HAZARDS[indicator.hazard])}</p>
          <h1>${esc(indicator.name)}</h1>
          ${status}
          ${lineChart(list, { band: indicator.chart, baseline: indicator.id === 'dose' ? undefined : baseline, name: indicator.name, markAt: rx ? rx.start : undefined, markLabel: rx ? `${rx.name} started` : undefined })}
          <p class="muted small">Shaded band: safe range. <strong>Limit source: ${esc(LIMIT_SOURCES[indicator.limitSource])}.</strong>${indicator.limitRef ? ` <a href="${esc(indicator.limitRef.url)}" target="_blank" rel="noopener">Open the NASA document</a>` : ''}</p>
          ${indicator.dataNote && list.some((r) => r.source === 'radlab') ? `<p class="small"><span class="tag-nasa">NASA</span> <strong>Real data.</strong> Measured on the ISS, not simulated.</p>` : ''}
          ${more('About this limit and this data', `<p class="small">${esc(indicator.limitNote)}</p>${indicator.dataNote && list.some((r) => r.source === 'radlab') ? `<p class="small">${esc(indicator.dataNote)}</p>` : ''}`)}
          ${more('Why this is tracked', `<p class="small">${esc(indicator.why)}</p><ul class="sources">${sourceLinks(indicator.sources)}</ul>`)}
        </section>

        <section class="card">
          <h2>Add a reading</h2>
          ${PANELS[indicator.group] ? `<p><a class="button secondary" href="#sample">Run a ${indicator.group === 'blood' ? 'blood sample' : 'urine collection'} through the sample submitter</a></p>` : ''}
          ${more('How to measure', `<p class="small">${esc(indicator.how)}</p>`)}
          <form data-form="add-reading" data-indicator="${esc(indicator.id)}" class="row-form">
            <label>${esc(firstLabel)}<input name="value" type="number" inputmode="decimal" required min="${indicator.input.min}" max="${indicator.input.max}" step="${indicator.input.step}"></label>
            ${second}
            <label>Note (optional)<input name="note" type="text" maxlength="120"></label>
            <button type="submit" class="button">Save reading</button>
          </form>
        </section>

        ${crewPanel(indicator)}

        <section class="card">
          <h2>Recent readings</h2>
          ${rows ? `<table class="t-history"><thead><tr><th>When</th><th class="num">Value</th><th>Status</th><th>Note</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="muted">Nothing logged yet.</p>'}
        </section>
      </div>
    </div>`;
}

// ---------- Medications ----------

export function viewMeds(state, nowISO) {
  // A prescription whose linked reading has enough data on both sides of its start comes first.
  const hasEffect = (p) => Boolean(p.linkedIndicator) && beforeAfter(readingsFor(state.readings, p.linkedIndicator), p.start).enough;
  const ordered = [...state.prescriptions].sort((a, b) => Number(hasEffect(b)) - Number(hasEffect(a)));
  const active = ordered.map((p) => {
    const med = getMedication(p.medId);
    const a = adherence(p, state.doses, nowISO);
    const n = nextDose(p, state.doses, nowISO);
    const linked = p.linkedIndicator ? getIndicator(p.linkedIndicator) : null;
    const left = state.inventory[p.medId] ?? 0;
    let due;
    if (n.asNeeded) due = '<span class="muted">Taken only when needed</span>';
    else if (n.ended) due = '<span class="muted">Course finished</span>';
    else if (n.dueNow) due = `<span class="pill pill-watch">! Dose due</span> <span class="muted">since ${esc(fmtWhen(n.at))}</span>`;
    else due = `<span class="muted">Next dose ${esc(fmtWhen(n.at))}</span>`;

    let effect = '';
    if (linked) {
      const cmp = beforeAfter(readingsFor(state.readings, linked.id), p.start);
      if (cmp.enough) {
        const dir = cmp.diff < 0 ? 'lower' : 'higher';
        effect = `<div class="effect"><strong>${esc(linked.name)}: ${Math.abs(cmp.pct).toFixed(0)}% ${dir} since this started.</strong> <span class="effect-nums">${cmp.before.mean.toFixed(1)} → ${cmp.after.mean.toFixed(1)} ${esc(linked.unit)}</span> <a href="#readings/${esc(linked.id)}">Chart</a>
          ${info(`<p class="muted small">A trend, not proof of cause: the average of ${cmp.before.n} readings in the four weeks before, against ${cmp.after.n} since. Your flight surgeon sees the same numbers.</p>`, 'About this comparison')}</div>`;
      } else {
        effect = `<p class="muted small">Not enough ${esc(lowerFirst(linked.name))} readings on both sides of the start date to compare yet (${cmp.before.n} before, ${cmp.after.n} after).</p>`;
      }
    }

    return `<section class="card">
      <div class="rx-head">
        <div>
          <h2>${esc(p.name)} <span class="muted">${esc(p.dose)}</span></h2>
          <p class="muted">${p.everyHours ? `Every ${p.everyHours === 24 ? 'day' : p.everyHours === 168 ? 'week' : `${p.everyHours} hours`}` : 'As needed'} · prescribed by ${esc(p.prescriber)} · started ${esc(fmtWhen(p.start))}</p>
          ${p.instructions ? `<p>${esc(p.instructions)}</p>` : ''}
        </div>
        <div class="rx-actions">
          <p>${due}</p>
          <button class="button" data-action="take-dose" data-id="${esc(p.id)}" ${left <= 0 ? 'disabled' : ''}>Dispense and log dose</button>
          <button class="button secondary" data-action="skip-dose" data-id="${esc(p.id)}" ${n.asNeeded ? 'disabled' : ''}>Log as skipped</button>
        </div>
      </div>
      <dl class="stats">
        <div><dt>Taken</dt><dd>${a.taken}${a.due !== null ? ` of ${a.due} due` : ''}</dd></div>
        <div><dt>Skipped</dt><dd>${a.skipped}</dd></div>
        <div><dt>Adherence</dt><dd>${a.pct === null ? '–' : `${Math.round(a.pct)}%`}</dd></div>
        <div><dt>Left in kit</dt><dd>${left}</dd></div>
      </dl>
      ${effect}
      ${med ? more('Why it is prescribed', `<p class="small">${esc(med.purpose)}</p>`) : ''}
    </section>`;
  }).join('');

  const kit = MEDICATIONS.map((m) => `<tr><td>${esc(m.name)}</td><td>${esc(m.defaultDose)}</td><td class="num">${state.inventory[m.id] ?? m.kitUnits}</td><td>${m.kit ? `<span class="tag-nasa">NASA</span> ${esc(m.kit)}` : esc(m.kitNote || '–')}</td></tr>`).join('');
  const kitAbout = `<p class="muted small">${MEDICATIONS.filter((m) => m.kit).length} of ${MEDICATIONS.length} items appear, with that strength, in <a href="${esc(SOURCES.medKit.url)}" target="_blank" rel="noopener">NASA's ISS Medical Kit: Contents and Reference</a> of 9 April 2015; the last column names the kit section. That list is historical and is not the current formulary. Beyond Earth orbit nothing can be sent up, so every prescription comes from the kit on board. The unit counts are demo values. This is not a medical reference.</p>`;

  return `
    <div class="home-head"><h1>Medications</h1></div>
    ${active || '<section class="card"><p class="muted">No active prescriptions.</p></section>'}
    <section class="card">
      <div class="card-head">
        <h2>Onboard kit <span class="tag-nasa">NASA</span></h2>
        ${info(kitAbout, 'About the kit list')}
      </div>
      <table class="t-kit"><thead><tr><th>Medication</th><th>Strength</th><th class="num">Units left</th><th>NASA kit list</th></tr></thead><tbody>${kit}</tbody></table>
    </section>`;
}

// ---------- Astro, the chat companion ----------

// The small face beside Astro's earlier messages. Drawn here, not an image file.
function astroAvatar() {
  return '<svg class="astro-avatar" viewBox="0 0 48 48" aria-hidden="true"><circle class="face" cx="24" cy="24" r="22"/><circle class="eye" cx="17" cy="21" r="2.4"/><circle class="eye" cx="31" cy="21" r="2.4"/><path class="smile" d="M16 29c2.5 3 5 4.2 8 4.2s5.5-1.2 8-4.2"/></svg>';
}

function activityBlock(a) {
  return `<details class="activity">
      <summary><strong>${esc(a.name)}</strong> <span class="muted">about ${a.minutes} min</span></summary>
      <ol>${a.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      ${a.id === 'breathing' ? '<button class="button secondary" data-action="start-breathing">Start a two-minute guide</button><p id="breathing-guide" class="breathing" aria-live="polite"></p>' : ''}
      ${a.id === 'message' ? '<form data-form="note-home"><label>Your note (kept on this tablet only)<textarea name="text" rows="4" maxlength="2000"></textarea></label><button class="button secondary" type="submit">Save note</button></form>' : ''}
      <button class="link" data-action="activity-done" data-id="${esc(a.id)}">I did this</button>
    </details>`;
}

// Astro speaks from a stage: its character, and what it is saying now in a
// speech bubble. Everything said before sits under "Earlier in this chat".
// ui.voice: whether Astro says its lines aloud.
export function viewAstro(state, ui = {}) {
  const chat = state.chat || [];
  const thread = [{ id: 'opening', from: 'astro', text: OPENING }, ...chat.slice(-40)];
  const lastIsMe = thread[thread.length - 1].from === 'me';
  let lineAt = thread.length - 1;
  while (thread[lineAt].from !== 'astro') lineAt -= 1;
  const line = thread[lineAt];
  const before = lineAt > 0 && thread[lineAt - 1].from === 'me' ? thread[lineAt - 1] : null;
  const said = lastIsMe ? thread[thread.length - 1] : before;
  const earlier = thread.slice(0, !lastIsMe && before ? lineAt - 1 : lineAt);
  const bubbles = earlier.map((m) => (m.from === 'astro'
    ? `<div class="msg msg-astro${m.level === LEVEL.HANDOFF ? ' msg-handoff' : ''}">${astroAvatar()}<p class="msg-text">${esc(m.text)}</p></div>`
    : `<div class="msg msg-me"><p class="msg-text">${esc(m.text)}</p></div>`)).join('');

  const last = chat[chat.length - 1];
  // A check-in question is answered by tapping a number.
  const step = ui.flow ? ui.flow.step : null;
  let scale = '';
  if (step) {
    const buttons = [];
    for (let n = step.min; n <= step.max; n += 1) buttons.push(`<button type="button" data-action="chat-rate" data-value="${n}">${n}</button>`);
    scale = `<div class="scale" role="group" aria-label="Pick a number from ${step.min} to ${step.max}">${buttons.join('')}</div>`;
  }
  const offered = last && last.from === 'astro' && Array.isArray(last.activities)
    ? last.activities.map((id) => ACTIVITIES.find((a) => a.id === id)).filter(Boolean)
    : [];
  const activities = offered.length ? `<div class="activities">${offered.map(activityBlock).join('')}</div>` : '';
  const handoffNow = line.level === LEVEL.HANDOFF;
  const handoff = last && last.level === LEVEL.HANDOFF ? '<p><a class="button" href="#surgeon">See the flag that was sent</a></p>' : '';

  const history = [...state.checkins].sort((a, b) => new Date(b.t) - new Date(a.t)).slice(0, 6).map((c) => `
    <tr><td>${esc(fmtWhen(c.t))}</td><td class="num">${c.mood}</td><td class="num">${c.stress}</td><td class="num">${c.loneliness}</td><td>${esc(c.level === LEVEL.HANDOFF ? 'Handed off to people' : c.level === LEVEL.SUPPORT ? 'Support offered' : 'Steady')}</td></tr>`).join('');
  const notes = (state.notesHome || []).slice(-3).reverse().map((n) => `<li><span class="muted small">${esc(fmtWhen(n.t))}</span><br>${esc(n.text)}</li>`).join('');

  const persona = personaSvg();
  const voiceOn = ui.voice !== false;
  const voice = ui.canSpeak === false ? '' : `<button type="button" class="voice-btn" data-action="astro-voice" aria-pressed="${voiceOn}" aria-label="Astro's voice is ${voiceOn ? 'on' : 'off'}" title="Astro's voice is ${voiceOn ? 'on' : 'off'}">${icon(voiceOn ? 'sound' : 'mute', 20)}</button>`;

  return `
    <section class="card chat astro-character">
      <div class="astro-bar">
        <h1>Astro</h1>
        ${voice}
      </div>
      ${said ? `<p class="said"><span class="sr-only">You said: </span>${esc(said.text)}</p>` : ''}
      <div class="stage" data-astro-stage>
        <div class="persona-wrap">${persona}<span class="ai-mark">${ui.recorded ? 'Drawn and voiced with AI' : 'Drawn with AI'}</span></div>
        <div class="speech${handoffNow ? ' is-handoff' : ''}" aria-live="polite">
          <p class="speech-text" data-astro-line data-id="${esc(line.id || '')}">${esc(line.text)}</p>
        </div>
      </div>
      ${scale}
      ${handoff}
      ${step ? '' : `<div class="quick">
        <button type="button" class="quick-main" data-action="chat-checkin">Start a check-in</button>
        <button type="button" data-action="chat-say" data-text="I'm stressed">I'm stressed</button>
        <button type="button" data-action="chat-say" data-text="I can't sleep">I can't sleep</button>
        <button type="button" data-action="chat-say" data-text="I miss home">I miss home</button>
      </div>`}
      <form class="composer" data-form="chat">
        <input type="text" name="text" maxlength="500" autocomplete="off" aria-label="Message to Astro" placeholder="${step ? 'Tap a number, or type one' : 'Talk to Astro'}">
        <button type="submit" class="button">Send</button>
      </form>
      <p class="muted small">Scripted, not a person or a therapist. What you type stays on this tablet. ${chat.length ? '<button class="link" data-action="chat-clear">Clear the chat</button>' : ''}</p>
      ${activities}
    </section>
    ${earlier.length ? `<details class="report"><summary>Earlier in this chat</summary><div class="thread">${bubbles}</div></details>` : ''}
    <details class="report">
      <summary>Recent check-ins</summary>
      ${history ? `<table><thead><tr><th>When</th><th class="num">Mood</th><th class="num">Stress</th><th class="num">Loneliness</th><th>Astro's response</th></tr></thead><tbody>${history}</tbody></table>` : '<p class="muted">No check-ins yet.</p>'}
      <p class="muted small">Your flight surgeon sees these ratings in your report, never what you typed.</p>
    </details>
    ${notes ? `<section class="card"><h2>Notes home</h2><ul class="notes">${notes}</ul></section>` : ''}`;
}


// ---------- The sample submitter ----------

export function viewSample(state, ui = {}) {
  const run = ui.sample || null;
  let body;
  if (run && run.state === 'running') {
    body = `<div class="analysing" role="status">
        <p><strong>Analysing the ${esc(lowerFirst(PANELS[run.kind].label))}.</strong></p>
        <div class="progress" aria-hidden="true"><span></span></div>
      </div>`;
  } else if (run && run.state === 'done') {
    const rows = run.results.map((r) => {
      const indicator = getIndicator(r.indicatorId);
      const a = assessReading(indicator, r, state.profile.baselines[indicator.id]);
      return `<tr><td><a href="#readings/${esc(indicator.id)}">${esc(indicator.name)}</a></td><td class="num"><strong>${esc(fmtValue(indicator, r))}</strong> ${esc(indicator.unit)}</td><td>${pill(a.status)}</td></tr>`;
    }).join('');
    body = `<h2>Results</h2>
      <table><thead><tr><th>Reading</th><th class="num">Value</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
      <p><a class="button" href="#today">Back to Today</a> <button type="button" class="button secondary" data-action="sample-again">Run another</button></p>`;
  } else {
    body = `<div class="choices">${Object.entries(PANELS).map(([kind, p]) => `<button type="button" class="choice" data-action="run-sample" data-kind="${esc(kind)}"><strong>${esc(p.label)}</strong><span>${esc(p.detail)}</span></button>`).join('')}</div>`;
  }
  return `
    <section class="card sample">
      <h1>Sample submitter</h1>
      ${state.profile.simulated ? '' : '<p class="muted small">Simulated analysis: no analyser is connected.</p>'}
      ${body}
    </section>`;
}

// ---------- Flight surgeon ----------

function reportTable(report) {
  const rows = report.indicators.map((i) => `<tr>
      <td>${esc(i.name)}</td>
      <td class="num">${esc(i.value2 !== null ? `${i.value}/${i.value2}` : i.value)} ${esc(i.unit)}</td>
      <td>${pill(i.status)}</td>
      <td class="num">${i.changeFromBaselinePct === null ? '' : `${i.changeFromBaselinePct > 0 ? '+' : ''}${i.changeFromBaselinePct}%`}</td>
      <td>${esc(i.trend === 'unknown' ? '' : i.trend)}</td>
    </tr>`).join('');
  const meds = report.medications.map((m) => `<tr>
      <td>${esc(m.name)} ${esc(m.dose)}</td>
      <td class="num">${m.adherencePct === null ? (m.everyHours ? 'just started' : 'as needed') : `${m.adherencePct}%`}</td>
      <td class="num">${m.dosesTaken}${m.dosesDue !== null ? `/${m.dosesDue}` : ''}</td>
      <td>${m.linkedIndicator ? `${esc(m.linkedIndicator)}: ${m.beforeMean ?? '–'} before, ${m.afterMean ?? '–'} since` : '–'}</td>
    </tr>`).join('');
  const checks = report.checkins.map((c) => `<tr><td>${esc(fmtWhen(c.t))}</td><td class="num">${c.mood}</td><td class="num">${c.stress}</td><td class="num">${c.loneliness}</td></tr>`).join('');
  return `
    <p class="muted small">${report.simulated ? 'SIMULATED DATA · ' : ''}${esc(report.crew)} · ${esc((MISSIONS[report.mission] || MISSIONS.iss).name)} · created ${esc(fmtWhen(report.createdAt))}</p>
    <p>${report.summary.attention} need attention, ${report.summary.watch} to watch, ${report.summary.ok} in range.${report.handoffRequested ? ' <strong>Astro handed a check-in off to people.</strong>' : ''}</p>
    <table class="t-report"><thead><tr><th>Indicator</th><th class="num">Latest</th><th>Status</th><th class="num">vs baseline</th><th>Trend</th></tr></thead><tbody>${rows}</tbody></table>
    ${meds ? `<h3>Medications</h3><table><thead><tr><th>Medication</th><th class="num">Adherence</th><th class="num">Taken</th><th>Linked reading</th></tr></thead><tbody>${meds}</tbody></table>` : ''}
    ${checks ? `<h3>Check-in ratings</h3><table><thead><tr><th>When</th><th class="num">Mood</th><th class="num">Stress</th><th class="num">Loneliness</th></tr></thead><tbody>${checks}</tbody></table>` : ''}
    ${report.note ? `<h3>Note from crew member</h3><p>${esc(report.note)}</p>` : ''}`;
}

function countdown(deliverAt, nowISO) {
  const s = Math.ceil((new Date(deliverAt).getTime() - new Date(nowISO).getTime()) / 1000);
  return s > 0 ? s : 0;
}

export function viewSurgeon(state, nowISO) {
  const delay = commDelay(state.profile.mission);
  const preview = buildReport(state, nowISO);
  const hasData = preview.indicators.length > 0;

  const outbox = [...state.outbox].reverse().map((o) => {
    const left = countdown(o.deliverAt, nowISO);
    return `<li>
      <strong>${o.payload.urgent ? 'Urgent report' : 'Report'}</strong> created ${esc(fmtWhen(o.createdAt))} ·
      ${left ? `<span class="pill pill-watch">In transit, ${left} s</span>` : '<span class="pill pill-ok">✓ Delivered</span>'}
      ${o.auto ? '<span class="muted small"> · sent automatically after a check-in</span>' : ''}
    </li>`;
  }).join('');

  const inbox = [...state.inbox].reverse().filter((m) => countdown(m.deliverAt, nowISO) === 0).map((m) => `
    <li class="message">
      <p class="muted small">${esc(m.from)} · ${esc(fmtWhen(m.deliverAt))}</p>
      <p>${esc(m.text)}</p>
      ${m.prescription && !m.accepted ? `<p><strong>New prescription:</strong> ${esc(m.prescription.name)} ${esc(m.prescription.dose)}, ${m.prescription.everyHours ? `every ${m.prescription.everyHours} hours` : 'as needed'}.</p>
        <button class="button" data-action="accept-rx" data-id="${esc(m.id)}">Add to my schedule</button>` : ''}
      ${m.prescription && m.accepted ? '<p class="muted small">Prescription added to your schedule.</p>' : ''}
    </li>`).join('');
  const inTransit = state.inbox.filter((m) => countdown(m.deliverAt, nowISO) > 0).length;

  const delivered = [...state.outbox].reverse().filter((o) => countdown(o.deliverAt, nowISO) === 0);
  const consoleReports = delivered.length
    ? delivered.slice(0, 3).map((o) => `<details class="report"${o === delivered[0] ? ' open' : ''}><summary>${o.payload.urgent ? '<span class="pill pill-attention">▲ Urgent</span> ' : ''}Report received ${esc(fmtWhen(o.deliverAt))}</summary>${reportTable(o.payload)}</details>`).join('')
    : '<p class="muted">No reports have arrived yet.</p>';

  const medOptions = MEDICATIONS.map((m) => `<option value="${esc(m.id)}">${esc(m.name)} (${esc(m.defaultDose)})</option>`).join('');

  return `
    <section class="card">
      <h1>Flight surgeon</h1>
      <p class="muted">${icon('signal', 16)} ${esc(delay.name)}: ${esc(delayNow(state.profile.mission, nowISO).text)}</p>
      ${delay.oneWaySeconds >= 60 ? '<p class="banner banner-warn">A reply takes at least twice the delay. If it is urgent, start the onboard medical checklist with your crew medical officer now.</p>' : ''}
    </section>

    <section class="card">
      <h2>Send a report</h2>
      ${hasData ? `<details class="report"><summary>Preview what will be sent</summary>${reportTable(preview)}</details>` : '<p class="muted">Add a reading first, or load the simulated demo data in Setup.</p>'}
      <form data-form="send-report">
        <label>Note for the flight surgeon (optional)<textarea name="note" rows="3" maxlength="2000"></textarea></label>
        <button type="submit" class="button" ${hasData ? '' : 'disabled'}>Send report</button>
      </form>
      ${outbox ? `<h3>Sent</h3><ul class="plain">${outbox}</ul>` : ''}
    </section>

    <section class="card">
      <h2>Messages from the flight surgeon</h2>
      ${inbox ? `<ul class="plain">${inbox}</ul>` : '<p class="muted">No messages yet.</p>'}
      ${inTransit ? `<p class="muted small">${inTransit} message${inTransit === 1 ? '' : 's'} in transit.</p>` : ''}
    </section>

    <section class="card console">
      <p class="eyebrow">Mission Control</p>
      <h2>Flight surgeon console</h2>
      ${consoleReports}
      <form data-form="surgeon-reply">
        <label>Reply to the crew member<textarea name="text" rows="3" maxlength="2000" required></textarea></label>
        <fieldset>
          <legend>Prescription (optional)</legend>
          <label>Medication from the onboard kit<select name="medId"><option value="">None</option>${medOptions}</select></label>
          <label>Dose<input name="dose" type="text" maxlength="40" placeholder="Leave blank for the usual dose"></label>
          <label>Every (hours, 0 for as needed)<input name="everyHours" type="number" min="0" max="720" step="1" placeholder="Leave blank for the usual schedule"></label>
        </fieldset>
        <button type="submit" class="button secondary">Send reply to the spacecraft</button>
      </form>
    </section>`;
}

// ---------- Setup ----------

export function viewSetup(state) {
  const missionOptions = Object.entries(MISSIONS).map(([id, m]) => `<option value="${esc(id)}"${state.profile.mission === id ? ' selected' : ''}>${esc(m.name)}</option>`).join('');
  const baselineRows = INDICATORS.filter((i) => i.id !== 'dose').map((i) => `
    <label>${esc(i.name)}${i.pair ? ' (systolic)' : ''} <span class="muted">${esc(i.unit)}</span>
      <input name="baseline-${esc(i.id)}" type="number" inputmode="decimal" min="${i.input.min}" max="${i.input.max}" step="${i.input.step}" value="${Number.isFinite(state.profile.baselines[i.id]) ? state.profile.baselines[i.id] : ''}">
    </label>`).join('');
  return `
    <section class="card">
      <h1>Setup</h1>
      <form data-form="profile">
        <label>Crew member name<input name="name" type="text" maxlength="60" value="${esc(state.profile.name)}"></label>
        <label>Mission<select name="mission">${missionOptions}</select></label>
        <h2>Preflight baselines</h2>
        <p class="muted">AeroNYX compares every reading with your own baseline as well as the reference range. Leave a field blank to skip it.</p>
        <div class="grid-form">${baselineRows}</div>
        <button type="submit" class="button">Save setup</button>
      </form>
    </section>
    <section class="card">
      <h2>Demo data</h2>
      <p>Load 60 days of simulated readings, prescriptions and check-ins to see every screen working. Loading replaces what is stored on this device.</p>
      <button class="button secondary" data-action="load-demo">Load simulated demo data</button>
      <button class="button danger" data-action="clear-all">Clear everything</button>
      <p class="muted small">Everything is stored only in this browser. Nothing is uploaded.</p>
    </section>`;
}

// ---------- About ----------

export function viewAbout() {
  const hazardRows = Object.entries(HAZARDS).map(([id, name]) => {
    const tracked = INDICATORS.filter((i) => i.hazard === id).map((i) => lowerFirst(i.name));
    let what = tracked.join(', ');
    if (id === 'distance') what = 'not an indicator: AeroNYX shows the signal delay for the mission and tells you what to do while a report is in transit';
    if (id === 'isolation') what += ', plus stress and loneliness ratings from check-ins';
    return `<tr><td>${esc(name)}</td><td>${esc(what)}</td></tr>`;
  }).join('');
  const nasaCount = INDICATORS.filter((i) => i.limitSource.startsWith('nasa')).length;
  // NASA-sourced limits first, in the order the sources are declared.
  const tierOrder = Object.keys(LIMIT_SOURCES);
  const byTier = [...INDICATORS].sort((a, b) => tierOrder.indexOf(a.limitSource) - tierOrder.indexOf(b.limitSource));
  const limitRows = byTier.map((i) => `<tr>
      <td>${esc(i.name)}</td>
      <td>${esc(LIMIT_SOURCES[i.limitSource])}</td>
      <td>${esc(i.limitSummary)}</td>
      <td>${i.limitRef ? `<a href="${esc(i.limitRef.url)}" target="_blank" rel="noopener">${esc(i.limitRef.label)}</a>` : '–'}</td>
    </tr>`).join('');
  const all = Object.values(SOURCES).map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join('');
  return `
    <section class="card">
      <h1>About AeroNYX</h1>
      <p class="lead">AeroNYX is a health monitor for astronauts on long missions. It gathers readings, shows each one against the safe range and the crew member's own baseline, tracks prescribed medication, and keeps the flight surgeon informed. Astro is its chat companion: a calm, scripted voice to talk to about stress, with a short mental health check-in.</p>
      <p>${esc(BOUNDARY)}</p>
      <p>Built for the 2026 NASA Space Apps Challenge, "Create Health Monitoring Software for Astronauts on Space Missions".</p>
    </section>
    <section class="card">
      <h2>How AeroNYX maps to NASA's five hazards</h2>
      <table><thead><tr><th>Hazard</th><th>What AeroNYX follows</th></tr></thead><tbody>${hazardRows}</tbody></table>
      <p class="muted small">The five hazards and the health risks linked to them come from NASA's Human Research Program.</p>
    </section>
    <section class="card">
      <h2>Where each limit comes from</h2>
      <p>AeroNYX uses NASA's number wherever NASA publishes one. That covers ${nasaCount} of the ${INDICATORS.length} indicators: requirements in NASA-STD-3001, and reference values in NASA's medical briefs and evidence reports. For the rest NASA publishes no numeric in-flight limit, so AeroNYX shows the standard adult clinical range and the crew member's own baseline.</p>
      <table class="t-limits"><thead><tr><th>Indicator</th><th>Source of the limit</th><th>The limit</th><th>Document</th></tr></thead><tbody>${limitRows}</tbody></table>
      <p class="muted small">The NASA numbers were checked against their source documents on 14 November 2026. A reading outside a NASA reference value is marked "Watch"; a reading past a NASA standard, a NASA-stated risk line or NASA's lowest band is marked "Needs attention".</p>
    </section>
    <section class="card">
      <h2>What is real and what is simulated</h2>
      <ul>
        <li>Demo readings are simulated, with one exception: the mission radiation dose replays real ISS detector measurements from NASA's RadLab. No reading comes from a real person's record.</li>
        <li>Real and live: space weather events from NASA DONKI, cabin readings from NASA's public ISS telemetry, and the signal delay to Mars computed from JPL's planetary positions.</li>
        <li>Real and saved in the app: the May 2024 solar storm (NASA DONKI), ISS dose measurements (NASA RadLab) and the Inspiration4 crew's blood chemistry ranges (NASA OSDR).</li>
        <li>The medication dispenser is simulated. Most kit items come from NASA's 2015 ISS medical kit list; the unit counts are demo values and the list is not a medical reference.</li>
        <li>The device drawn around the screen is a concept from the team's own sketch, drawn in code with an AI assistant. No hardware exists. The medication dispenser only reacts on screen, and a run of the sample submitter generates simulated values close to the last reading and logs them as simulated.</li>
        <li>Astro is a scripted companion. Each reply is fixed wording chosen by the words typed. It is not a person, a therapist or an AI model, and what is typed stays on the tablet. Its character is drawn with AI and marked as such. Its voice is AI-generated speech from ElevenLabs, recorded in advance in a voice the team chose and marked as AI on the Astro screen. The recordings are stored with the app and play from the tablet, so nothing Astro says is sent anywhere.</li>
        <li>The health record is kept in this browser's storage on the tablet. It is not encrypted and it is not sent anywhere. The demo has no lock; a flight unit would need one, and would need to encrypt the record.</li>
        <li>The flight surgeon console stands in for Mission Control, so one person can show both ends of the loop. The medication dispenser logs a dose and lowers the kit count; no hardware moves.</li>
        <li>Limits are NASA's wherever NASA publishes a number, and each one is labelled with its source. The others are standard adult clinical values used on Earth.</li>
        <li>Blood and urine panels assume an onboard analyzer that returns results from a small sample. Stool analysis has no in-flight analyzer today and is not included.</li>
      </ul>
    </section>
    <section class="card">
      <h2>Use of AI</h2>
      <p>The concept is the team's own. The code, the background research and the wording on these screens were produced with an AI assistant (Claude) and reviewed by the team. The assistant also checked the concept against the challenge statement and suggested showing each reading against a personal baseline. AeroNYX contains no AI model: every message it shows, and every reply Astro gives, is fixed wording chosen by a rule, so it works with no link to Earth. Details are in AI-USE.md in the repository.</p>
    </section>
    <section class="card">
      <h2>Sources</h2>
      <ul class="sources">${all}</ul>
    </section>`;
}


// ---------- Real NASA data: helpers ----------

const fmtUtc = (t) => `${new Date(t).toISOString().slice(0, 16).replace('T', ' ')} UTC`;

// The space weather Astro acts on: the stored May 2024 storm when the replay
// is on, otherwise whatever NASA DONKI returned for the last 30 days.
export function currentWeather(env, nowMs) {
  if (!env) return null;
  if (env.replay) {
    const d = DONKI_MAY_2024;
    const at = Date.parse(d.replayNow);
    return { replay: true, range: d.range, at, summary: summarise({ sep: d.sep, flares: d.flares, flareCount: d.flareCount, storms: d.storms }, at), sep: d.sep };
  }
  if (env.donki && env.donki.status === 'live' && env.donki.data) {
    return { replay: false, range: env.donki.data.range, at: nowMs, summary: summarise(env.donki.data, nowMs), sep: env.donki.data.sep };
  }
  return null;
}

// One-way signal delay for the mission, right now.
export function delayNow(mission, nowISO) {
  const m = commDelay(mission);
  if (mission === 'mars') {
    const seconds = marsLightSeconds(new Date(nowISO));
    return { seconds, text: `${formatDelay(seconds)} each way today, computed from the positions of Earth and Mars (NASA JPL). Shown here in ${m.demoSeconds} seconds.` };
  }
  return { seconds: m.oneWaySeconds, text: `about ${formatDelay(m.oneWaySeconds)} each way. ${m.note}` };
}

// Glucose and potassium: what a real crew's values looked like.
function crewPanel(indicator) {
  const panel = I4_PANEL[indicator.id];
  if (!panel) return '';
  const rows = panel.draws.map((d) => `<tr><td>${esc(d.when)}</td><td class="num">${d.min} to ${d.max} ${esc(panel.unit)}</td></tr>`).join('');
  return `<section class="card">
          <h2>A real crew: Inspiration4 <span class="tag-nasa">NASA</span></h2>
          <p class="small">Not your readings: the lowest and highest ${esc(lowerFirst(indicator.name))} among the four Inspiration4 crew at each blood draw, from NASA's Open Science Data Repository.</p>
          <table><thead><tr><th>Blood draw</th><th class="num">Lowest to highest of four crew</th></tr></thead><tbody>${rows}</tbody></table>
          ${more('About this data', `<p class="muted small">Three days in orbit, September 2021. Blood was drawn before launch and after return, never in flight, and the file does not say whether the draws were fasting. The laboratory's reference range in the file is ${panel.labRange[0]} to ${panel.labRange[1]} ${esc(panel.unit)}. Source: <a href="${esc(I4_PANEL.url)}" target="_blank" rel="noopener">${esc(I4_PANEL.source)}</a>, retrieved ${esc(I4_PANEL.retrieved)}.</p>`)}
        </section>`;
}

// ---------- Space and cabin ----------

// The mission dose against NASA's career limit, and whether a NASA line is
// crossed: the limit itself, or a solar particle event in the last 72 hours.
export function radiationLevel(state, env, nowMs) {
  const limit = getIndicator('dose').rules.find((r) => Number.isFinite(r.gte)).gte;
  const list = readingsFor(state.readings, 'dose');
  const dose = list.length ? Number(list[list.length - 1].value) : null;
  const w = currentWeather(env, nowMs);
  const storm = w && w.summary.alert ? w.summary.alert : null;
  const over = dose !== null && dose >= limit;
  return { limit, dose, pct: dose === null ? null : (dose / limit) * 100, over, storm, replay: Boolean(w && w.replay), level: over ? 'attention' : storm ? 'watch' : 'ok' };
}

// The bar across the top of the Space screen. It turns red, with what to do,
// when the dose reaches NASA's limit, and amber during a solar particle event.
function radiationStrip(state, env, nowMs) {
  const r = radiationLevel(state, env, nowMs);
  const fill = r.dose === null ? 0 : Math.max(1, Math.min(100, r.pct));
  const marks = [0.25, 0.5, 0.75].map((f) => `<span class="rad-tick" style="left:${f * 100}%"></span>`).join('');
  const scale = [0, 0.25, 0.5, 0.75].map((f) => `<span>${Math.round(r.limit * f)}</span>`).join('');
  let warn = '';
  if (r.over) {
    warn = `<p class="rad-warn">${icon('warn', 22)}<span><strong>NASA career limit reached.</strong> Tell your crew medical officer and send a report now.</span><a class="button" href="#surgeon">Send report</a></p>`;
  } else if (r.storm) {
    warn = `<p class="rad-warn">${icon('warn', 22)}<span><strong>Solar particle event${r.replay ? ' (replay)' : ''}, ${Math.round(r.storm.hoursAgo)} h ago.</strong> Shelter, then log your dosimeter.</span><a class="button" href="#readings/dose">Log dose</a></p>`;
  }
  return `<section class="rad rad-${r.level}" role="status" data-film="rad">
      <div class="rad-top">
        <span class="rad-name">${icon('dose', 22)}Radiation <span class="tag-nasa">NASA</span></span>
        <span class="rad-value">${r.dose === null ? '<span class="muted">No dosimeter reading</span>' : `<strong>${r.dose.toFixed(1)}</strong> of ${r.limit} mSv <span class="rad-pct">${r.pct < 1 ? '<1' : Math.round(r.pct)}%</span>`}</span>
      </div>
      <div class="rad-bar" aria-hidden="true"><span class="rad-fill" style="width:${fill.toFixed(1)}%"></span>${marks}</div>
      <div class="rad-scale" aria-hidden="true">${scale}<span>${r.limit} limit</span></div>
      ${warn}
    </section>`;
}

function weatherCard(env, nowMs) {
  const w = currentWeather(env, nowMs);
  const mode = env.replay ? 'Replay: May 2024' : ({ live: 'Live', loading: 'Loading', failed: 'Offline', idle: 'Offline' })[env.donki.status];
  const range = env.replay ? DONKI_MAY_2024.range : (w ? w.range : null);
  let body = !w && env.donki.status === 'failed' ? '<p class="muted small">NASA DONKI could not be reached. Trying again in a few minutes.</p>' : '';
  if (w) {
    const s = w.summary;
    const top = s.strongestFlare ? String(s.strongestFlare.c) : '';
    // Flare classes run A, B, C, M, X. Kp, the size of a geomagnetic storm, runs 0 to 9.
    const flareSteps = ['A', 'B', 'C', 'M', 'X'].map((c) => `<span class="step${top.charAt(0).toUpperCase() === c ? ' on' : ''}">${c}</span>`).join('');
    const kp = s.topStorm ? Math.round(s.topStorm.kp) : -1;
    const kpSteps = Array.from({ length: 10 }, (_, k) => `<span class="step${k <= kp ? ' on' : ''}">${k}</span>`).join('');
    const events = w.sep.filter((e) => isMeasured(e) && Date.parse(e.t) <= w.at).slice(-6).reverse().map((e) => `<li>${esc(fmtUtc(e.t))}: ${esc(e.inst)}</li>`).join('');
    body = `
      <div class="tiles">
        <div class="tile"><span class="tile-num">${icon('particle', 22)}<strong>${s.particleEvents}</strong></span><span class="tile-name">Particle events</span></div>
        <div class="tile"><span class="tile-num">${icon('flare', 22)}<strong>${s.flareCount}</strong></span><span class="tile-name">Solar flares</span></div>
        <div class="tile"><span class="tile-num">${icon('magnet', 22)}<strong>${s.stormCount}</strong></span><span class="tile-name">Geomagnetic storms</span></div>
      </div>
      <div class="scale-row"><span class="scale-name">Strongest flare <strong>${top ? esc(top) : '–'}</strong></span><span class="steps" aria-hidden="true">${flareSteps}</span></div>
      <div class="scale-row"><span class="scale-name">Top storm <strong>${s.topStorm ? `Kp ${esc(s.topStorm.kp)}` : '–'}</strong></span><span class="steps steps-kp" aria-hidden="true">${kpSteps}</span></div>
      ${events ? more('Particle events seen by instruments', `<ul class="events small">${events}</ul>`) : ''}`;
  }
  const about = `<p class="muted small">${range ? `NASA DONKI, ${esc(range[0])} to ${esc(range[1])}. ` : ''}${env.replay ? `The replay stands at ${esc(fmtUtc(DONKI_MAY_2024.replayNow))}; the counts are for the whole month. ` : ''}Source: <a href="${esc(SOURCES.donki.url)}" target="_blank" rel="noopener">${esc(SOURCES.donki.label)}</a>. DONKI reports that an event happened and which instrument saw it. It carries no dose, so AeroNYX never turns an event into a dose figure. Model forecasts are left out of the alert.</p>`;
  return `
      <div class="card-head">
        <h2>${icon('sun', 20)}Space weather <span class="tag-nasa">NASA</span></h2>
        ${w ? (w.summary.alert ? '<span class="pill pill-watch">! Particle event</span>' : '<span class="pill pill-ok">✓ Quiet</span>') : ''}
        <span class="chip">${esc(mode)}</span>
        ${info(about, 'About the space weather data')}
      </div>
      ${body}
      <button class="button secondary" data-action="toggle-replay">${env.replay ? 'Back to live data' : 'Replay the May 2024 storm'}</button>`;
}

function doseCard(mission) {
  const limit = getIndicator('dose').rules.find((r) => Number.isFinite(r.gte)).gte;
  const first = Date.parse(`${RADLAB_ISS.firstDay}T12:00:00Z`);
  const series = RADLAB_ISS.daily.map((value, k) => ({ t: new Date(first + k * 864e5).toISOString(), value }));
  const meanUgy = RADLAB_ISS.daily.reduce((a, b) => a + b, 0) / RADLAB_ISS.daily.length;
  const rates = Object.entries(DOSE_RATES).map(([id, r]) => ({ id, label: r.label, rate: doseRateFor(id) }));
  const max = Math.max(...rates.map((r) => r.rate));
  const bars = rates.map((r) => `<div class="bar-row${r.id === mission ? ' is-current' : ''}">
        <span class="bar-label">${esc(r.label)}${r.id === mission ? ' <span class="chip">You</span>' : ''}</span>
        <span class="bar-track" aria-hidden="true"><span class="bar-fill" style="width:${((r.rate / max) * 100).toFixed(1)}%"></span></span>
        <span class="bar-num"><strong>${r.rate.toFixed(2)}</strong> mSv a day · ${Math.round(limit / r.rate)} days</span>
      </div>`).join('');
  const bases = Object.values(DOSE_RATES).map((r) => `<li><strong>${esc(r.label)}:</strong> ${esc(r.basis)} <a href="${esc(r.url)}" target="_blank" rel="noopener">Source</a></li>`).join('');
  const about = `<p class="muted small">The DOSTEL-2 detector measured an average of ${Math.round(meanUgy)} micrograys a day over ${RADLAB_ISS.daily.length} days from 15 February 2022. With the quality factor of ${QUALITY_FACTOR.value.toFixed(2)} published for these detectors, that is about ${radlabMeanMsvPerDay().toFixed(2)} mSv a day at the detector. The chart shows daily absorbed dose in micrograys, and the radiation reading on the home screen replays these days. Source: <a href="${esc(RADLAB_ISS.url)}" target="_blank" rel="noopener">${esc(RADLAB_ISS.source)}</a>, retrieved ${esc(RADLAB_ISS.retrieved)}. Quality factor: <a href="${esc(QUALITY_FACTOR.url)}" target="_blank" rel="noopener">${esc(QUALITY_FACTOR.source)}</a>.</p>
      <ul class="small">${bases}</ul>
      <p class="muted small">The days are plain division of NASA's career limit by the rate. A crew member's own dose differs from a detector reading and changes with shielding and the solar cycle, so this is a scale, not a forecast.</p>`;
  return `
      <div class="card-head">
        <h2>${icon('dose', 20)}Dose on the ISS <span class="tag-nasa">NASA</span></h2>
        ${info(about, 'About the dose data')}
      </div>
      <p class="big-stat"><strong>${radlabMeanMsvPerDay().toFixed(2)}</strong> mSv a day <span class="muted small">measured over ${RADLAB_ISS.daily.length} days</span></p>
      ${lineChart(series, { name: 'Daily absorbed dose on the ISS, micrograys' })}
      <h3>Dose rate, and days to the ${limit} mSv limit</h3>
      <div class="bars">${bars}</div>`;
}

// How each cabin sensor is drawn: a marker against NASA's limit, or a tank filling up.
const CABIN_VIEW = {
  USLAB000059: { icon: 'thermo', short: 'Temperature', min: 12, max: 33 },
  USLAB000058: { icon: 'dial', short: 'Pressure' },
  USLAB000055: { icon: 'air', short: 'Carbon dioxide', min: 0, max: 6 },
  NODE3000005: { icon: 'tank', short: 'Urine tank', fill: true },
  NODE3000008: { icon: 'tank', short: 'Waste water', fill: true },
  NODE3000009: { icon: 'tank', short: 'Clean water', fill: true },
};

function cabinCard(env, nowMs) {
  const iss = env.iss || { state: 'idle', values: {} };
  const cells = ISS_ITEMS.map((item) => {
    const v = iss.values[item.id];
    const has = Boolean(v) && Number.isFinite(v.value);
    const age = v && Number.isFinite(v.t) ? (nowMs - v.t) / 60000 : NaN;
    const st = cabinStatus(item, v ? v.value : NaN, age);
    const view = CABIN_VIEW[item.id] || {};
    let bar = '<span class="gauge-bar" aria-hidden="true"></span>';
    if (has && view.fill) {
      bar = `<span class="gauge-bar" aria-hidden="true"><span class="cab-fill" style="width:${Math.max(0, Math.min(100, v.value)).toFixed(0)}%"></span></span>`;
    } else if (has && item.limit && Number.isFinite(view.min)) {
      const pct = (x) => Math.max(0, Math.min(100, ((x - view.min) / (view.max - view.min)) * 100));
      const lo = Number.isFinite(item.limit.lo) ? item.limit.lo : view.min;
      bar = `<span class="gauge-bar" aria-hidden="true"><span class="gauge-band" style="left:${pct(lo).toFixed(1)}%;width:${(pct(item.limit.hi) - pct(lo)).toFixed(1)}%"></span><span class="gauge-mark" style="left:${pct(v.value).toFixed(1)}%"></span></span>`;
    }
    const note = st.status === 'stale' ? 'Not updating' : st.status === 'none' ? 'Waiting' : formatAge(age);
    return `<div class="cab cab-${esc(st.status)}" title="${esc(st.text)}">
          <span class="cab-top"><span class="cab-name">${icon(view.icon || 'dial', 18)}${esc(view.short || item.name)}</span><span class="cab-value">${has ? `<strong>${v.value.toFixed(item.digits)}</strong> ${esc(item.unit)}` : '–'}</span></span>
          ${bar}
          <span class="cab-note">${st.status === 'attention' ? 'Outside NASA\'s limit · ' : ''}${esc(note)}</span>
          <span class="sr-only">${esc(st.text)}</span>
        </div>`;
  }).join('');
  const mode = { live: 'Live', connecting: 'Connecting', closed: 'Offline', idle: 'Offline' }[iss.state] || 'Offline';
  const about = `<p class="muted small">These are the station's own sensors, read from NASA's public ISS telemetry feed while this screen is open. The feed drops out for a few minutes on most orbits. Each value carries the time the station last sent it, and a value older than 30 minutes is not judged. The green band is the NASA-STD-3001 limit from <a href="${esc(SOURCES.eclssBrief.url)}" target="_blank" rel="noopener">NASA's life support technical brief</a>: ${esc(ISS_ITEMS.filter((i) => i.limit).map((i) => `${lowerFirst(i.name)} ${i.limit.text}`).join('; '))}. The carbon dioxide limit is a one-hour average, so a single reading is only an indication. Pressure and the tanks are shown for information. On another vehicle AeroNYX would read that vehicle's feed.</p>`;
  return `
      <div class="card-head">
        <h2>${icon('air', 20)}Cabin, live from the ISS <span class="tag-nasa">NASA</span></h2>
        <span class="chip">${mode}</span>
        ${iss.state === 'closed' ? '<button class="link" data-action="iss-reconnect">Try again</button>' : ''}
        ${info(about, 'About the cabin data')}
      </div>
      <div class="cabs" data-film="cabin">${cells}</div>`;
}

function distanceCard(mission, nowISO) {
  const date = new Date(nowISO);
  const au = earthMarsDistanceAU(date);
  const seconds = marsLightSeconds(date);
  const mine = delayNow(mission, nowISO);
  // Over the two orbits the one-way delay runs from about 3 to about 22 minutes.
  const at = Math.max(0, Math.min(100, ((seconds / 60 - 3) / 19) * 100));
  const about = `<p class="muted small">Mars is ${au.toFixed(2)} astronomical units from Earth today. Computed in the app from <a href="${esc(SOURCES.jplElements.url)}" target="_blank" rel="noopener">NASA JPL's approximate planetary positions</a>. A reply takes at least twice the one-way delay, which is why AeroNYX tells you what to do while a report is in transit. ${esc(commDelay(mission).name)}: ${esc(mine.text)}</p>`;
  return `
      <div class="card-head">
        <h2>${icon('signal', 20)}Distance from Earth <span class="tag-nasa">NASA</span></h2>
        ${info(about, 'About the distance')}
      </div>
      <div class="hop" aria-hidden="true"><span class="planet planet-earth"></span><span class="beam"><span class="pulse"></span></span><span class="planet planet-mars"></span></div>
      <div class="hop-text"><span>Earth</span><span><strong>${esc(formatDelay(seconds))}</strong> each way</span><span>Mars</span></div>
      <div class="range" aria-hidden="true"><span class="range-mark" style="left:${at.toFixed(1)}%"></span></div>
      <div class="range-text"><span>3 min</span><span>${Math.round((au * AU_KM) / 1e6)} million km today</span><span>22 min</span></div>
      <p class="small">${esc(commDelay(mission).name)}, your mission: <strong>${esc(formatDelay(mine.seconds))}</strong> each way.</p>`;
}

export function viewEnvironment(state, env, nowISO) {
  const nowMs = new Date(nowISO).getTime();
  const mission = state.profile.mission;
  return `
    <div class="home-head"><h1>Space and cabin</h1></div>
    ${radiationStrip(state, env, nowMs)}
    <section class="card">${weatherCard(env, nowMs)}</section>
    <section class="card">${doseCard(mission)}</section>
    <section class="card">${cabinCard(env, nowMs)}</section>
    <section class="card">${distanceCard(mission, nowISO)}</section>`;
}
