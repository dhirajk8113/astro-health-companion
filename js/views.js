// Astro health companion: screens, built as HTML strings from the state.
//
// AI disclosure: written with an AI coding assistant (Claude). See AI-USE.md.

import { INDICATORS, GROUPS, HAZARDS, SOURCES, STATUS, LIMIT_SOURCES, getIndicator } from './data/indicators.js';
import { RADLAB_ISS, QUALITY_FACTOR, DOSE_RATES, doseRateFor, radlabMeanMsvPerDay, DONKI_MAY_2024, I4_PANEL } from './data/nasa-snapshots.js';
import { marsLightSeconds, earthMarsDistanceAU, formatDelay, AU_KM } from './lib/ephemeris.js';
import { summarise, isMeasured } from './lib/spaceweather.js';
import { ISS_ITEMS, cabinStatus, formatAge } from './lib/isslive.js';
import { MEDICATIONS, getMedication } from './data/medications.js';
import {
  overview, counts, astroSummary, readingsFor, assessReading, trend, beforeAfter,
  adherence, nextDose, commDelay, MISSIONS, buildReport, lowerFirst,
} from './lib/assess.js';
import { BOUNDARY, LEVEL } from './lib/checkin.js';
import { lineChart } from './lib/chart.js';

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

function simulatedBanner(state) {
  if (!state.profile.simulated) return '';
  return '<div class="banner banner-sim" role="note"><strong>Simulated data.</strong> The readings are invented for the demo, with one exception: the radiation dose replays real ISS detector measurements from NASA\'s RadLab. No reading comes from a real person.</div>';
}

function sourceLinks(sources) {
  return sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join('');
}

// ---------- Today ----------

export function viewToday(state, env = null) {
  const items = overview(state);
  const c = counts(items);
  const flagged = items
    .filter((i) => i.assessment && i.assessment.status !== STATUS.OK)
    .sort((a, b) => (a.assessment.status === STATUS.ATTENTION ? -1 : 1) - (b.assessment.status === STATUS.ATTENTION ? -1 : 1));

  const flaggedHtml = flagged.length
    ? `<section class="card">
        <h2>Worth a look</h2>
        <ul class="flag-list">
          ${flagged.map((i) => `
            <li class="flag flag-${esc(i.assessment.status)}">
              <div class="flag-head">
                ${pill(i.assessment.status)}
                <a href="#readings/${esc(i.indicator.id)}"><strong>${esc(i.indicator.name)}</strong></a>
                <span class="value">${esc(fmtValue(i.indicator, i.latest))} ${esc(i.indicator.unit)}</span>
              </div>
              <p class="muted">${esc(i.assessment.reason.charAt(0).toUpperCase() + i.assessment.reason.slice(1))}.</p>
              <p><strong>What to do:</strong> ${esc(i.indicator.actions[i.assessment.status])}</p>
            </li>`).join('')}
        </ul>
        <p><a class="button" href="#surgeon">Send a report to the flight surgeon</a></p>
      </section>`
    : '';

  const groupsHtml = GROUPS.map((g) => {
    const cards = items.filter((i) => i.indicator.group === g.id).map((i) => {
      const body = i.assessment
        ? `<div class="reading"><span class="value big">${esc(fmtValue(i.indicator, i.latest))}</span> <span class="unit">${esc(i.indicator.unit)}</span></div>
           ${pill(i.assessment.status)}
           <p class="muted small">${esc(fmtDelta(i.indicator, i.assessment.delta))} ${esc(TREND_TEXT[i.trend.direction])}</p>
           <p class="muted small">${esc(fmtWhen(i.latest.t))}</p>`
        : '<p class="muted">No reading yet</p>';
      return `<a class="tile" href="#readings/${esc(i.indicator.id)}">
          <h3>${esc(i.indicator.name)}</h3>
          ${body}
        </a>`;
    }).join('');
    return `<section><h2>${esc(g.name)}</h2><div class="tiles">${cards}</div></section>`;
  }).join('');

  return `
    ${simulatedBanner(state)}
    ${weatherBanner(env)}
    <section class="card astro">
      <div class="astro-face" aria-hidden="true">A</div>
      <div>
        <h1>Hello, ${esc(state.profile.name)}</h1>
        <p class="lead">${esc(astroSummary(items))}</p>
        <p class="muted small">${c.attention} need attention · ${c.watch} to watch · ${c.ok} in range${c.none ? ` · ${c.none} with no reading` : ''}</p>
      </div>
    </section>
    ${items.some((i) => i.assessment) ? '' : `<section class="card">
      <h2>Start here</h2>
      <p>Add your own readings under Readings, or load 60 days of simulated data to see every screen working.</p>
      <button class="button" data-action="load-demo">Load simulated demo data</button>
      <a class="button secondary" href="#setup">Set my baselines</a>
    </section>`}
    ${flaggedHtml}
    ${groupsHtml}
    <p class="boundary">${esc(BOUNDARY)}</p>`;
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
    ${simulatedBanner(state)}
    <div class="split">
      <nav class="side" aria-label="Indicators">${nav}</nav>
      <div class="main-col">
        <section class="card">
          <p class="eyebrow">${esc(indicator.sample)} · ${esc(HAZARDS[indicator.hazard])}</p>
          <h1>${esc(indicator.name)}</h1>
          ${status}
          ${lineChart(list, { band: indicator.chart, baseline: indicator.id === 'dose' ? undefined : baseline, name: indicator.name, markAt: rx ? rx.start : undefined, markLabel: rx ? `${rx.name} started` : undefined })}
          <p class="muted small">Shaded band: reference range. <strong>Limit source: ${esc(LIMIT_SOURCES[indicator.limitSource])}.</strong> ${esc(indicator.limitNote)}${indicator.limitRef ? ` <a href="${esc(indicator.limitRef.url)}" target="_blank" rel="noopener">Open the NASA document</a>` : ''}</p>
          ${indicator.dataNote ? `<p class="muted small"><strong>Real data.</strong> ${esc(indicator.dataNote)}</p>` : ''}
        </section>

        <section class="card">
          <h2>Add a reading</h2>
          <p><strong>How to measure:</strong> ${esc(indicator.how)}</p>
          <form data-form="add-reading" data-indicator="${esc(indicator.id)}" class="row-form">
            <label>${esc(firstLabel)}<input name="value" type="number" inputmode="decimal" required min="${indicator.input.min}" max="${indicator.input.max}" step="${indicator.input.step}"></label>
            ${second}
            <label>Note (optional)<input name="note" type="text" maxlength="120"></label>
            <button type="submit" class="button">Save reading</button>
          </form>
        </section>

        ${crewPanel(indicator)}
        <section class="card">
          <h2>Why Astro tracks this</h2>
          <p>${esc(indicator.why)}</p>
          <ul class="sources">${sourceLinks(indicator.sources)}</ul>
        </section>

        <section class="card">
          <h2>Recent readings</h2>
          ${rows ? `<table><thead><tr><th>When</th><th class="num">Value</th><th>Status</th><th>Note</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="muted">Nothing logged yet.</p>'}
        </section>
      </div>
    </div>`;
}

// ---------- Medications ----------

export function viewMeds(state, nowISO) {
  const active = state.prescriptions.map((p) => {
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

    let effect = '<p class="muted small">No in-flight indicator is linked to this medication.</p>';
    if (linked) {
      const cmp = beforeAfter(readingsFor(state.readings, linked.id), p.start);
      if (cmp.enough) {
        const dir = cmp.diff < 0 ? 'lower' : 'higher';
        effect = `<p><strong>${esc(linked.name)}</strong> has averaged ${cmp.after.mean.toFixed(1)} ${esc(linked.unit)} since this started, against ${cmp.before.mean.toFixed(1)} in the four weeks before. That is ${Math.abs(cmp.pct).toFixed(0)}% ${dir} (${cmp.before.n} readings before, ${cmp.after.n} after).</p>
          <p class="muted small">This describes the trend. It does not prove the medication caused it. Your flight surgeon sees the same numbers. <a href="#readings/${esc(linked.id)}">Open the chart</a></p>`;
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
      ${med ? `<p class="muted small">${esc(med.purpose)}</p>` : ''}
      ${effect}
    </section>`;
  }).join('');

  const kit = MEDICATIONS.map((m) => `<tr><td>${esc(m.name)}</td><td>${esc(m.defaultDose)}</td><td class="num">${state.inventory[m.id] ?? m.kitUnits}</td><td>${m.kit ? `NASA ISS medical kit, ${esc(m.kit)}` : esc(m.kitNote || '')}</td><td>${esc(m.purpose)}</td></tr>`).join('');

  return `
    ${simulatedBanner(state)}
    <section class="card">
      <h1>Medications</h1>
      <p>Astro does not choose medications or doses. Prescriptions come from your flight surgeon and are filled from the kit on board. Astro tracks each dose and reports how the linked reading has moved.</p>
      <p class="muted small">The dispenser is simulated in this demo: pressing the button records the dose and takes one unit out of the kit count.</p>
    </section>
    ${active || '<section class="card"><p class="muted">No active prescriptions. When your flight surgeon sends one, it appears under Flight surgeon.</p></section>'}
    <section class="card">
      <h2>Onboard kit</h2>
      <table><thead><tr><th>Medication</th><th>Strength</th><th class="num">Units left</th><th>Where it is listed</th><th>Why it is carried</th></tr></thead><tbody>${kit}</tbody></table>
      <p class="muted small">Medications marked "NASA ISS medical kit" appear, with that strength, in <a href="${esc(SOURCES.medKit.url)}" target="_blank" rel="noopener">NASA's ISS Medical Kit: Contents and Reference</a> of 9 April 2015. That list is historical and is not the current formulary. The unit counts are demo values. This is not a medical reference. Beyond Earth orbit nothing can be sent up, so every prescription has to come from the kit on board.</p>
    </section>`;
}

// ---------- Check-in ----------

function slider(name, label, min, max, value, lowText, highText) {
  return `<label class="slider">${esc(label)}
    <input type="range" name="${esc(name)}" min="${min}" max="${max}" step="1" value="${value}" data-output="${esc(name)}-out">
    <span class="slider-ends"><span>${esc(lowText)}</span><output id="${esc(name)}-out">${value}</output><span>${esc(highText)}</span></span>
  </label>`;
}

export function viewCheckin(state, ui = {}) {
  const baselineMood = state.profile.baselines.mood;
  let result = '';
  if (ui.result) {
    const { reply, activities, score } = ui.result;
    const acts = score.level === LEVEL.HANDOFF ? '' : `
      <div class="activities">
        ${activities.map((a) => `
          <details class="activity">
            <summary><strong>${esc(a.name)}</strong> <span class="muted">about ${a.minutes} min</span></summary>
            <ol>${a.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
            ${a.id === 'breathing' ? '<button class="button secondary" data-action="start-breathing">Start a two-minute guide</button><p id="breathing-guide" class="breathing" aria-live="polite"></p>' : ''}
            ${a.id === 'message' ? `<form data-form="note-home"><label>Your note (kept on this device only)<textarea name="text" rows="4" maxlength="2000"></textarea></label><button class="button secondary" type="submit">Save note</button></form>` : ''}
            <button class="link" data-action="activity-done" data-id="${esc(a.id)}">I did this</button>
          </details>`).join('')}
      </div>`;
    result = `<section class="card chat" aria-live="polite">
      <div class="bubble bubble-astro${score.level === LEVEL.HANDOFF ? ' bubble-handoff' : ''}">
        <h2>${esc(reply.title)}</h2>
        ${reply.lines.map((l) => `<p>${esc(l)}</p>`).join('')}
      </div>
      ${acts}
      ${score.level === LEVEL.HANDOFF ? '<p><a class="button" href="#surgeon">See the flag that was sent</a></p>' : ''}
    </section>`;
  }

  const history = [...state.checkins].sort((a, b) => new Date(b.t) - new Date(a.t)).slice(0, 6).map((c) => `
    <tr><td>${esc(fmtWhen(c.t))}</td><td class="num">${c.mood}</td><td class="num">${c.stress}</td><td class="num">${c.loneliness}</td><td>${esc(c.level === LEVEL.HANDOFF ? 'Handed off to people' : c.level === LEVEL.SUPPORT ? 'Support offered' : 'Steady')}</td></tr>`).join('');

  const notes = (state.notesHome || []).slice(-3).reverse().map((n) => `<li><span class="muted small">${esc(fmtWhen(n.t))}</span><br>${esc(n.text)}</li>`).join('');

  return `
    <section class="card astro">
      <div class="astro-face" aria-hidden="true">A</div>
      <div>
        <h1>Check in with Astro</h1>
        <p class="lead">Three quick ratings, then a short activity if you want one. It takes about a minute.</p>
        <p class="muted small">${esc(BOUNDARY)}</p>
      </div>
    </section>
    <section class="card">
      <form data-form="checkin">
        ${slider('mood', 'How has your mood been today?', 1, 10, Number.isFinite(baselineMood) ? baselineMood : 7, 'Very low', 'Very good')}
        ${slider('stress', 'How stressed do you feel?', 0, 10, 3, 'Not at all', 'Extremely')}
        ${slider('loneliness', 'How lonely or cut off do you feel?', 0, 10, 2, 'Not at all', 'Extremely')}
        <label>Anything on your mind? (optional)
          <textarea name="text" rows="3" maxlength="1000" placeholder="This stays on your device. It is never sent to the ground."></textarea>
        </label>
        <button type="submit" class="button">Check in</button>
      </form>
    </section>
    ${result}
    <section class="card">
      <h2>Recent check-ins</h2>
      ${history ? `<table><thead><tr><th>When</th><th class="num">Mood</th><th class="num">Stress</th><th class="num">Loneliness</th><th>Astro's response</th></tr></thead><tbody>${history}</tbody></table>` : '<p class="muted">No check-ins yet.</p>'}
      <p class="muted small">Your flight surgeon sees these ratings in your report. What you type to Astro is not stored or sent.</p>
    </section>
    ${notes ? `<section class="card"><h2>Notes home</h2><ul class="notes">${notes}</ul></section>` : ''}`;
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
    <table><thead><tr><th>Indicator</th><th class="num">Latest</th><th>Status</th><th class="num">vs baseline</th><th>Trend</th></tr></thead><tbody>${rows}</tbody></table>
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
    ${simulatedBanner(state)}
    <section class="card">
      <h1>Flight surgeon</h1>
      <p>Astro shows you your readings. Your flight surgeon makes the medical decisions. Send a report whenever something needs a second pair of eyes.</p>
      <p class="muted">${esc(delay.name)}: ${esc(delayNow(state.profile.mission, nowISO).text)}</p>
      ${delay.oneWaySeconds >= 60 ? '<p class="banner banner-warn">At this distance a reply takes at least twice the one-way delay. For anything urgent, work through the onboard medical checklist with your crew medical officer while the report is in transit.</p>' : ''}
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
      <p class="eyebrow">Demo only: the ground side</p>
      <h2>Flight surgeon console</h2>
      <p class="muted">In a real mission this screen sits in Mission Control. It is here so one person can show both ends of the loop.</p>
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
        <p class="muted">Astro compares every reading with your own baseline as well as the reference range. Leave a field blank to skip it.</p>
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
    if (id === 'distance') what = 'not an indicator: Astro shows the signal delay for the mission and tells you what to do while a report is in transit';
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
      <h1>About Astro</h1>
      <p class="lead">Astro is a health companion for astronauts on long missions. It gathers readings, shows each one against a reference range and the crew member's own baseline, tracks prescribed medication, offers support on hard days, and keeps the flight surgeon informed.</p>
      <p>${esc(BOUNDARY)}</p>
      <p>Built for the 2026 NASA Space Apps Challenge, "Create Health Monitoring Software for Astronauts on Space Missions".</p>
    </section>
    <section class="card">
      <h2>How Astro maps to NASA's five hazards</h2>
      <table><thead><tr><th>Hazard</th><th>What Astro follows</th></tr></thead><tbody>${hazardRows}</tbody></table>
      <p class="muted small">The five hazards and the health risks linked to them come from NASA's Human Research Program.</p>
    </section>
    <section class="card">
      <h2>Where each limit comes from</h2>
      <p>Astro uses NASA's number wherever NASA publishes one. That covers ${nasaCount} of the ${INDICATORS.length} indicators: requirements in NASA-STD-3001, and reference values in NASA's medical briefs and evidence reports. For the rest NASA publishes no numeric in-flight limit, so Astro shows the standard adult clinical range and the crew member's own baseline.</p>
      <table><thead><tr><th>Indicator</th><th>Source of the limit</th><th>The limit</th><th>Document</th></tr></thead><tbody>${limitRows}</tbody></table>
      <p class="muted small">The NASA numbers were checked against their source documents on 14 November 2026. A reading outside a NASA reference value is marked "Watch"; a reading past a NASA standard, a NASA-stated risk line or NASA's lowest band is marked "Needs attention".</p>
    </section>
    <section class="card">
      <h2>What is real and what is simulated</h2>
      <ul>
        <li>Demo readings are simulated, with one exception: the mission radiation dose replays real ISS detector measurements from NASA's RadLab. No reading comes from a real person's record.</li>
        <li>Real and live: space weather events from NASA DONKI, cabin readings from NASA's public ISS telemetry, and the signal delay to Mars computed from JPL's planetary positions.</li>
        <li>Real and saved in the app: the May 2024 solar storm (NASA DONKI), ISS dose measurements (NASA RadLab) and the Inspiration4 crew's blood chemistry ranges (NASA OSDR).</li>
        <li>The medication dispenser is simulated. Most kit items come from NASA's 2015 ISS medical kit list; the unit counts are demo values and the list is not a medical reference.</li>
        <li>The flight surgeon console is part of the demo so one person can show both ends of the loop.</li>
        <li>Limits are NASA's wherever NASA publishes a number, and each one is labelled with its source. The others are standard adult clinical values used on Earth.</li>
        <li>Blood and urine panels assume an onboard analyzer that returns results from a small sample. Stool analysis has no in-flight analyzer today and is not included.</li>
      </ul>
    </section>
    <section class="card">
      <h2>Use of AI</h2>
      <p>The concept is the team's own. The code, the background research and the wording on these screens were produced with an AI assistant (Claude) and reviewed by the team. The assistant also checked the concept against the challenge statement and suggested showing each reading against a personal baseline. Astro itself contains no AI model: every message it shows comes from a fixed rule, so it works with no link to Earth. Details are in AI-USE.md in the repository.</p>
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

function weatherBanner(env) {
  const w = currentWeather(env, Date.now());
  if (!w || !w.summary.alert) return '';
  const e = w.summary.alert.event;
  return `<div class="banner banner-warn" role="status"><strong>Space weather${w.replay ? ' (replay of May 2024)' : ''}.</strong> NASA DONKI reports a solar particle event at ${esc(fmtUtc(e.t))}, seen by ${esc(e.inst)}. Follow your shelter instructions and log your dosimeter reading. <a href="#environment">Open Environment</a></div>`;
}

// One-way signal delay for the mission, right now.
export function delayNow(mission, nowISO) {
  const m = commDelay(mission);
  if (mission === 'mars') {
    const seconds = marsLightSeconds(new Date(nowISO));
    return { seconds, text: `${formatDelay(seconds)} each way today, computed from the positions of Earth and Mars (NASA JPL). The demo compresses this to ${m.demoSeconds} seconds.` };
  }
  return { seconds: m.oneWaySeconds, text: `about ${formatDelay(m.oneWaySeconds)} each way. ${m.note}` };
}

// Glucose and potassium: what a real crew's values looked like.
function crewPanel(indicator) {
  const panel = I4_PANEL[indicator.id];
  if (!panel) return '';
  const rows = panel.draws.map((d) => `<tr><td>${esc(d.when)}</td><td class="num">${d.min} to ${d.max} ${esc(panel.unit)}</td></tr>`).join('');
  return `<section class="card">
          <h2>A real crew: Inspiration4</h2>
          <p>These are not your readings. They are the lowest and highest ${esc(lowerFirst(indicator.name))} among the four Inspiration4 crew at each blood draw, from NASA's Open Science Data Repository.</p>
          <table><thead><tr><th>Blood draw</th><th class="num">Lowest to highest of four crew</th></tr></thead><tbody>${rows}</tbody></table>
          <p class="muted small">Three days in orbit, September 2021. Blood was drawn before launch and after return, never in flight, and the file does not say whether the draws were fasting. The laboratory's reference range in the file is ${panel.labRange[0]} to ${panel.labRange[1]} ${esc(panel.unit)}. Source: <a href="${esc(I4_PANEL.url)}" target="_blank" rel="noopener">${esc(I4_PANEL.source)}</a>, retrieved ${esc(I4_PANEL.retrieved)}.</p>
        </section>`;
}

// ---------- Environment ----------

function weatherCard(env, nowMs) {
  const w = currentWeather(env, nowMs);
  const status = env.replay
    ? `Replay of saved NASA DONKI data, ${DONKI_MAY_2024.range[0]} to ${DONKI_MAY_2024.range[1]}. The replay stands at ${fmtUtc(DONKI_MAY_2024.replayNow)}; the counts are for the whole month.`
    : ({
      live: w ? `Live from NASA DONKI, ${w.range[0]} to ${w.range[1]}.` : '',
      loading: 'Asking NASA DONKI for the last 30 days.',
      failed: 'NASA DONKI could not be reached just now. Astro will try again in a few minutes.',
      idle: 'Not loaded yet.',
    })[env.donki.status];
  let body = '';
  if (w) {
    const s = w.summary;
    const events = w.sep.filter((e) => isMeasured(e) && Date.parse(e.t) <= w.at).slice(-6).reverse().map((e) => `<li>${esc(fmtUtc(e.t))}: ${esc(e.inst)}</li>`).join('');
    body = `
      ${s.alert
    ? `<p class="banner banner-warn"><strong>Solar particle event ${Math.round(s.alert.hoursAgo)} hours ago.</strong> Seen by ${esc(s.alert.event.inst)} at ${esc(fmtUtc(s.alert.event.t))}. Follow your shelter instructions, log your dosimeter reading under Mission radiation dose, and tell your flight surgeon.</p>`
    : '<p><span class="pill pill-ok">✓ Quiet</span> No solar particle event in the last 72 hours.</p>'}
      <dl class="stats">
        <div><dt>Particle events</dt><dd>${s.particleEvents}</dd></div>
        <div><dt>Solar flares</dt><dd>${s.flareCount}</dd></div>
        <div><dt>Strongest flare</dt><dd>${s.strongestFlare ? esc(s.strongestFlare.c) : '–'}</dd></div>
        <div><dt>Geomagnetic storms</dt><dd>${s.stormCount}${s.topStorm ? `, Kp ${s.topStorm.kp}` : ''}</dd></div>
      </dl>
      ${events ? `<p class="small"><strong>Latest particle events detected by instruments:</strong></p><ul class="events small">${events}</ul>` : ''}`;
  }
  return `
      <h2>Space weather events</h2>
      <p class="muted">${esc(status)}</p>
      ${body}
      <button class="button secondary" data-action="toggle-replay">${env.replay ? 'Back to live data' : 'Replay the May 2024 storm'}</button>
      <p class="muted small">Source: <a href="${esc(SOURCES.donki.url)}" target="_blank" rel="noopener">${esc(SOURCES.donki.label)}</a>. DONKI reports that an event happened and which instrument saw it. It carries no dose, so Astro never turns an event into a dose figure. Model forecasts are left out of the alert.</p>`;
}

function doseCard(mission) {
  const first = Date.parse(`${RADLAB_ISS.firstDay}T12:00:00Z`);
  const series = RADLAB_ISS.daily.map((value, k) => ({ t: new Date(first + k * 864e5).toISOString(), value }));
  const meanUgy = RADLAB_ISS.daily.reduce((a, b) => a + b, 0) / RADLAB_ISS.daily.length;
  const rows = Object.entries(DOSE_RATES).map(([id, r]) => {
    const rate = doseRateFor(id);
    return `<tr${id === mission ? ' class="row-current"' : ''}><td>${esc(r.label)}${id === mission ? ' (your mission)' : ''}</td><td class="num">${rate.toFixed(2)} mSv</td><td class="num">${Math.round(600 / rate)} days</td><td>${esc(r.basis)} <a href="${esc(r.url)}" target="_blank" rel="noopener">Source</a></td></tr>`;
  }).join('');
  return `
      <h2>Measured dose on the ISS</h2>
      <p>The DOSTEL-2 detector in the Columbus module measured an average of ${Math.round(meanUgy)} micrograys a day over ${RADLAB_ISS.daily.length} days from 15 February 2022. With the quality factor of ${QUALITY_FACTOR.value.toFixed(2)} published for these detectors, that is about ${radlabMeanMsvPerDay().toFixed(2)} mSv a day at the detector.</p>
      ${lineChart(series, { name: 'Daily absorbed dose on the ISS, micrograys' })}
      <p class="muted small">Daily absorbed dose in micrograys. Source: <a href="${esc(RADLAB_ISS.url)}" target="_blank" rel="noopener">${esc(RADLAB_ISS.source)}</a>, retrieved ${esc(RADLAB_ISS.retrieved)}. Quality factor: <a href="${esc(QUALITY_FACTOR.url)}" target="_blank" rel="noopener">${esc(QUALITY_FACTOR.source)}</a>. The demo's mission radiation dose replays these days.</p>
      <h3>Dose rate by mission, and NASA's 600 mSv career limit</h3>
      <table><thead><tr><th>Mission</th><th class="num">Per day</th><th class="num">Days to 600 mSv</th><th>Where the rate comes from</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="muted small">The days are plain division of NASA's career limit by the measured rate. A crew member's own dose differs from a detector reading and changes with shielding and the solar cycle, so this is a scale, not a forecast.</p>`;
}

function cabinCard(env, nowMs) {
  const iss = env.iss || { state: 'idle', values: {} };
  const label = { pill: { ok: 'pill-ok', attention: 'pill-attention', stale: 'pill-watch' }, word: { ok: '✓ Within limit', attention: '▲ Outside limit', stale: '! Not updating', info: 'Information', none: 'Waiting' } };
  const rows = ISS_ITEMS.map((item) => {
    const v = iss.values[item.id];
    const age = v && Number.isFinite(v.t) ? (nowMs - v.t) / 60000 : NaN;
    const st = cabinStatus(item, v ? v.value : NaN, age);
    return `<tr><td>${esc(item.name)}</td><td class="num">${v && Number.isFinite(v.value) ? `${v.value.toFixed(item.digits)} ${esc(item.unit)}` : '–'}</td><td>${esc(formatAge(age))}</td><td>${label.pill[st.status] ? `<span class="pill ${label.pill[st.status]}">${label.word[st.status]}</span> ` : ''}${esc(st.text)}</td></tr>`;
  }).join('');
  const state = {
    live: 'Connected to NASA\'s public ISS telemetry.',
    connecting: 'Connecting to NASA\'s public ISS telemetry.',
    closed: 'The ISS telemetry feed is not answering. It drops out for a few minutes on most orbits.',
    idle: 'Not connected.',
  }[iss.state] || '';
  return `
      <h2>Cabin air and water, live from the ISS</h2>
      <p class="muted">${esc(state)} ${iss.state === 'closed' ? '<button class="link" data-action="iss-reconnect">Try again</button>' : ''}</p>
      <table><thead><tr><th>Reading</th><th class="num">Value</th><th>Last sent</th><th>Against NASA's limit</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="muted small">These are the station's own sensors, read from NASA's public telemetry feed while this screen is open. Each value carries the time the station last sent it, and a value older than 30 minutes is not judged. The limits are NASA-STD-3001 requirements from <a href="${esc(SOURCES.eclssBrief.url)}" target="_blank" rel="noopener">NASA's life support technical brief</a>; the carbon dioxide limit is a one-hour average, so a single reading is only an indication. On another vehicle Astro would read that vehicle's feed.</p>`;
}

function distanceCard(mission, nowISO) {
  const date = new Date(nowISO);
  const au = earthMarsDistanceAU(date);
  const mine = delayNow(mission, nowISO);
  return `
      <h2>Distance from Earth</h2>
      <p>Mars is ${Math.round(au * AU_KM / 1e6)} million km from Earth today (${au.toFixed(2)} astronomical units). A message takes <strong>${esc(formatDelay(marsLightSeconds(date)))}</strong> each way, and across the cycle of the two orbits that ranges from about 3 to about 22 minutes.</p>
      <p>${esc(commDelay(mission).name)}, your mission: ${esc(mine.text)}</p>
      <p class="muted small">Computed in the app from <a href="${esc(SOURCES.jplElements.url)}" target="_blank" rel="noopener">NASA JPL's approximate planetary positions</a>. A reply takes at least twice the one-way delay, which is why Astro tells you what to do while a report is in transit.</p>`;
}

export function viewEnvironment(state, env, nowISO) {
  const nowMs = new Date(nowISO).getTime();
  const mission = state.profile.mission;
  return `
    <section class="card">
      <h1>Environment</h1>
      <p>Three of NASA's five hazards come from outside your body: space radiation, the closed cabin, and distance from Earth. This screen shows each one with real NASA data.</p>
    </section>
    <section class="card">
      <p class="eyebrow">Hazard: space radiation</p>
      ${weatherCard(env, nowMs)}
    </section>
    <section class="card">
      <p class="eyebrow">Hazard: space radiation</p>
      ${doseCard(mission)}
    </section>
    <section class="card">
      <p class="eyebrow">Hazard: hostile closed environment</p>
      ${cabinCard(env, nowMs)}
    </section>
    <section class="card">
      <p class="eyebrow">Hazard: distance from Earth</p>
      ${distanceCard(mission, nowISO)}
    </section>`;
}
