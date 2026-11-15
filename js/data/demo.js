// AeroNYX: simulated demo data.
//
// AI disclosure: written with an AI coding assistant (Claude). See AI-USE.md.
//
// Every value produced here is SIMULATED. None of it is NASA data or data
// from any real person. The shapes loosely follow published averages (for
// example, body mass falling about 3 percent in the first month) so the
// screens have something realistic to show.

import { defaultInventory, getMedication } from './medications.js';
import { radlabDayMsv } from './nasa-snapshots.js';


// Small seeded generator so the demo looks the same on every load.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (v, dp) => Number(v.toFixed(dp));

export const DEMO_BASELINES = {
  hr: 58,
  bp: 118,
  temp: 36.6,
  mass: 78.0,
  fitness: 100,
  glucose: 88,
  vitd: 38,
  potassium: 4.2,
  urine_vol: 2.2,
  urine_ca: 180,
  dose: 0,
  sleep: 7.5,
  mood: 8,
};

export function emptyState() {
  return {
    version: 1,
    profile: { name: 'Crew member', mission: 'iss', simulated: false, baselines: {} },
    readings: [],
    prescriptions: [],
    doses: [],
    inventory: defaultInventory(),
    checkins: [],
    notesHome: [],
    outbox: [],
    inbox: [],
    chat: [],
  };
}

export function demoState(nowISO, days = 60) {
  const rand = mulberry32(20261114);
  const noise = (size) => (rand() - 0.5) * 2 * size;
  // Day `days` is yesterday on the local clock, so no simulated reading sits in
  // the future and `hour` is a real time of day (a 09:00 dose shows as 9 AM).
  const at = (day, hour) => {
    const t = new Date(nowISO);
    t.setDate(t.getDate() - (days + 1 - day));
    t.setHours(hour, 0, 0, 0);
    return t.toISOString();
  };

  const state = emptyState();
  state.profile = { name: 'Crew member', mission: 'iss', simulated: true, baselines: { ...DEMO_BASELINES } };

  let id = 0;
  const add = (indicatorId, day, hour, value, value2, source = 'simulated') => {
    id += 1;
    const r = { id: `r${id}`, indicatorId, t: at(day, hour), value, source };
    if (value2 !== undefined) r.value2 = value2;
    state.readings.push(r);
  };

  let doseTotal = 0;
  for (let d = 1; d <= days; d += 1) {
    // Daily vitals.
    add('hr', d, 7, Math.round(60 + noise(4)));
    add('bp', d, 7, Math.round(112 + noise(6)), Math.round(71 + noise(4)));
    add('temp', d, 7, round(36.6 + Math.min(0.7, d * 0.012) + noise(0.15), 1));
    // Sleep runs short, with a rough patch in the fifth week.
    const rough = d >= 31 && d <= 36;
    const slept = d === days ? 5.6 : Math.max(3.5, (rough ? 5.4 : 6.3) + noise(0.7));
    add('sleep', d, 8, round(slept, 1));
    add('mood', d, 20, Math.max(1, Math.min(10, Math.round((rough ? 5.2 : 7.4) + noise(1.1)))));
    // Cumulative dose. This one is real: the daily dose measured by the DOSTEL-2
    // detector on the ISS (NASA RadLab), replayed day by day from 15 Feb 2022.
    doseTotal += radlabDayMsv(d - 1);
    if (d % 3 === 0 || d === days) {
      noise(0.2); // keeps the random sequence, and so every other value, unchanged
      add('dose', d, 9, round(doseTotal, 1), undefined, 'radlab');
    }
    // Body mass on the mass device, weekly: falls about 3.4 percent in a month.
    if (d % 7 === 0) {
      const loss = Math.min(1, d / 30) * 0.034;
      add('mass', d, 6, round(78.0 * (1 - loss) + noise(0.2), 1));
    }
    // Urine panel, weekly: calcium rises in the first week, stays high, then
    // eases after potassium citrate starts on day 30.
    if (d % 7 === 2) {
      let climb;
      if (d <= 7) climb = 230 + (d / 7) * 65;
      else if (d <= 30) climb = 295;
      else climb = 295 - Math.min(70, (d - 30) * 2.6);
      add('urine_ca', d, 10, Math.round(climb + noise(10)));
      // The most recent panel shows a low volume, below NASA's 1.5 L risk line.
      const volume = round(1.7 + noise(0.25), 1);
      add('urine_vol', d, 10, d + 7 > days ? 1.4 : volume);
    }
    // Blood panel, every two weeks.
    if (d % 14 === 3) {
      add('glucose', d, 6, Math.round(94 + d * 0.12 + noise(5)));
      add('vitd', d, 6, Math.round(37 - d * 0.14 + noise(1.5)));
      add('potassium', d, 6, round(4.2 + (d > 30 ? 0.25 : 0) + noise(0.15), 1));
    }
  }
  // Periodic fitness evaluations.
  add('fitness', 15, 11, 83);
  add('fitness', 45, 11, 88);

  // Prescriptions issued by the flight surgeon in the demo.
  const vitd3 = getMedication('vitd3');
  const kcit = getMedication('kcitrate');
  state.prescriptions.push({
    id: 'p1',
    medId: vitd3.id,
    name: vitd3.name,
    dose: vitd3.defaultDose,
    everyHours: 24,
    start: at(1, 9),
    end: null,
    linkedIndicator: vitd3.linkedIndicator,
    prescriber: 'Flight surgeon',
    instructions: 'One capsule each morning with food.',
  });
  state.prescriptions.push({
    id: 'p2',
    medId: kcit.id,
    name: kcit.name,
    dose: kcit.defaultDose,
    everyHours: 24,
    start: at(30, 9),
    end: null,
    linkedIndicator: kcit.linkedIndicator,
    prescriber: 'Flight surgeon',
    instructions: 'One tablet each morning with a full drink bag of water.',
  });

  let doseId = 0;
  const logDoses = (prescriptionId, medId, firstDay, missEvery) => {
    for (let d = firstDay; d <= days; d += 1) {
      doseId += 1;
      const skipped = (d - firstDay) % missEvery === missEvery - 1;
      state.doses.push({
        id: `d${doseId}`,
        prescriptionId,
        t: at(d, 9),
        status: skipped ? 'skipped' : 'taken',
        note: skipped ? 'Missed during a busy shift.' : '',
      });
      if (!skipped) state.inventory[medId] -= 1;
    }
  };
  logDoses('p1', 'vitd3', 1, 11);
  logDoses('p2', 'kcitrate', 30, 9);

  // A few earlier check-ins. Free text is never stored in the demo.
  const checkin = (day, mood, stress, loneliness, level) => {
    state.checkins.push({ id: `c${day}`, t: at(day, 21), mood, stress, loneliness, level, activity: null });
  };
  checkin(12, 8, 3, 2, 'steady');
  checkin(26, 7, 5, 4, 'steady');
  checkin(33, 5, 7, 6, 'support');
  checkin(35, 5, 6, 7, 'support');
  checkin(48, 7, 4, 4, 'steady');

  state.inbox.push({
    id: 'm1',
    from: 'Flight surgeon',
    sentAt: at(30, 8),
    deliverAt: at(30, 8),
    text: 'Urinary calcium has climbed over four weeks. Starting potassium citrate 20 mEq daily from the onboard kit. Keep fluids up and repeat the urine panel weekly.',
    read: true,
  });

  return state;
}
