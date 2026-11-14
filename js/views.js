// Astro health companion: screens, built as HTML strings from the state.
//
// AI disclosure: written with an AI coding assistant (Claude). See AI-USE.md.

import { INDICATORS, GROUPS, HAZARDS, SOURCES, STATUS, getIndicator } from './data/indicators.js';
import { MEDICATIONS, getMedication } from './data/medications.js';
import {
  overview, counts, astroSummary, readingsFor, assessReading, trend, beforeAfter,
  adherence, nextDose, commDelay, MISSIONS, buildReport,
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
  return '<div class="banner banner-sim" role="note"><strong>Simulated data.</strong> Every reading on this screen is invented for the demo. None of it is NASA data or data from a real person.</div>';
}

function sourceLinks(sources) {
  return sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join('');
}

// ---------- Today ----------

export function viewToday(state) {
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
          <p class="muted small">Shaded band: reference range. ${esc(indicator.limitNote)}</p>
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
        effect = `<p class="muted small">Not enough ${esc(linked.name.toLowerCase())} readings on both sides of the start date to compare yet (${cmp.before.n} before, ${cmp.after.n} after).</p>`;
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

  const kit = MEDICATIONS.map((m) => `<tr><td>${esc(m.name)}</td><td>${esc(m.defaultDose)}</td><td class="num">${state.inventory[m.id] ?? 0}</td><td>${esc(m.purpose)}</td></tr>`).join('');

  return `
    ${simulatedBanner(state)}
    <section class="card">
      <h1>Medications</h1>
      <p>Astro does not choose medications or doses. Prescriptions come from your flight surgeon and are filled from the kit on board. Astro tracks each dose and reports how the linked reading has moved.</p>
      <p class="muted small">The dispenser is simulated in this demo: pressing the button records the dose and takes one unit out of the kit count.</p>
    </section>
    ${active || '<section class="card"><p class="muted">No active prescriptions. When your flight surgeon sends one, it appears under Flight surgeon.</p></section>'}
    <section class="card">
      <h2>Onboard kit (example)</h2>
      <table><thead><tr><th>Medication</th><th>Usual dose</th><th class="num">Units left</th><th>Why it is carried</th></tr></thead><tbody>${kit}</tbody></table>
      <p class="muted small">An example formulary for the demo, not a medical reference. Beyond Earth orbit nothing can be sent up, so every prescription has to come from this kit.</p>
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
      <td class="num">${m.adherencePct === null ? 'as needed' : `${m.adherencePct}%`}</td>
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
      <p class="muted">${esc(delay.name)}: about ${delay.oneWaySeconds >= 60 ? `${Math.round(delay.oneWaySeconds / 60)} minutes` : `${delay.oneWaySeconds} second${delay.oneWaySeconds === 1 ? '' : 's'}`} each way. ${esc(delay.note)}</p>
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
    const tracked = INDICATORS.filter((i) => i.hazard === id).map((i) => i.name.toLowerCase());
    let what = tracked.join(', ');
    if (id === 'distance') what = 'not an indicator: Astro shows the signal delay for the mission and tells you what to do while a report is in transit';
    if (id === 'isolation') what += ', plus stress and loneliness ratings from check-ins';
    return `<tr><td>${esc(name)}</td><td>${esc(what)}</td></tr>`;
  }).join('');
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
      <h2>What is real and what is simulated</h2>
      <ul>
        <li>All readings in the demo are simulated. None is NASA data or data from a real person.</li>
        <li>The medication dispenser is simulated. The kit list is an example, not a medical reference.</li>
        <li>The flight surgeon console is part of the demo so one person can show both ends of the loop.</li>
        <li>Reference ranges are standard adult clinical values used on Earth unless marked as a NASA limit. NASA publishes numeric in-mission limits for only a few indicators.</li>
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
