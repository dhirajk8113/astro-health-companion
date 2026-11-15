// AeroNYX: saved copies of NASA data.
//
// AI disclosure: written with an AI coding assistant (Claude). See AI-USE.md.
//
// Everything in this file is real, published data, not simulated. Each block
// says where it came from and when it was retrieved. The files are saved here
// because the browser cannot read these NASA services from another website,
// or because the event is in the past.

// ---------------------------------------------------------------------------
// 1. Measured radiation dose on the ISS
// Source: NASA Open Science Data Repository, RadLab Data API
//   https://visualization.osdr.nasa.gov/radlab/api/?spacecraft=ISS&instrument=DosTel&absorbed_dose_rate
// Instrument: DOSTEL-2, a silicon detector telescope of the DOSIS 3D experiment
//   (German Aerospace Center DLR, in ESA's Columbus module).
// Retrieved 14 Nov 2026 (146,980 samples). Each value is one day's absorbed
// dose in micrograys: the samples' dose rate in micrograys per hour, integrated
// over time, with gaps longer than ten minutes left out and the result scaled
// to 24 hours. Every day here had at least 23.2 hours of data.
export const RADLAB_ISS = Object.freeze({
  source: 'NASA OSDR RadLab, DOSTEL-2 detector (DLR, ESA DOSIS 3D experiment)',
  url: 'https://visualization.osdr.nasa.gov/radlab/gui/data-api/',
  retrieved: '2026-11-14',
  firstDay: '2022-02-15',
  unit: 'µGy per day (absorbed dose in silicon)',
  daily: Object.freeze([
    269.3, 265.7, 262.9, 266.3, 267, 263.7, 264.4, 261.8, 262.1, 259.5, 261.5, 272.4, 270.1, 266.3,
    262.7, 283.1, 262, 294.3, 243.1, 292.4, 252.7, 270.2, 262.7, 265, 260, 256.3, 264.9, 255.5, 254.3, 254.1,
    261.7, 228.1, 261.6, 259.2, 268.3, 268.6, 265.7, 263.6, 268, 270.4, 262.3, 255.3, 265.7, 264.6, 257.4,
    252.1, 254.3, 257.3, 258.7, 252.9, 260.2, 260.9, 256.7, 253.6, 279.2, 252.1, 290.1, 246, 284.5, 243.9, 262.1,
  ]),
});

// The DOSIS 3D team reported 286 micrograys a day with a dose equivalent of
// 647 microsieverts a day for these detectors (Berger et al. 2017). The ratio
// is the mean quality factor used here to turn absorbed dose into dose
// equivalent. It is an approximation: the factor changes with the solar cycle.
export const QUALITY_FACTOR = Object.freeze({
  value: 647 / 286,
  source: 'Berger et al. 2017, DOSIS & DOSIS 3D, J. Space Weather Space Clim. 7, A8',
  url: 'https://www.swsc-journal.org/articles/swsc/abs/2017/01/swsc160046/swsc160046.html',
});

// Day index (0-based) to dose equivalent in millisieverts for that day.
export function radlabDayMsv(index) {
  const list = RADLAB_ISS.daily;
  const ugy = list[((index % list.length) + list.length) % list.length];
  return (ugy * QUALITY_FACTOR.value) / 1000;
}

export function radlabMeanMsvPerDay() {
  const list = RADLAB_ISS.daily;
  const mean = list.reduce((a, b) => a + b, 0) / list.length;
  return (mean * QUALITY_FACTOR.value) / 1000;
}

// ---------------------------------------------------------------------------
// 2. Published dose rates for each mission profile
export const DOSE_RATES = Object.freeze({
  iss: {
    label: 'Low Earth orbit (ISS)',
    measured: true,
    basis: 'Mean of 61 days of DOSTEL-2 measurements in 2022 (NASA RadLab), as dose equivalent at the detector.',
    source: RADLAB_ISS.source,
    url: RADLAB_ISS.url,
  },
  moon: {
    label: 'Lunar mission',
    mSvPerDay: (26.7 + 35.4) / 2 / 25.45,
    basis: 'Artemis I: 26.7 to 35.4 mSv inside Orion over the 25-day flight, radiation belts included (midpoint shown).',
    source: 'George et al. 2024, Space radiation measurements during the Artemis I lunar mission, Nature',
    url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11446838/',
  },
  mars: {
    label: 'Mars transit',
    mSvPerDay: 1.8,
    basis: 'Curiosity\'s RAD detector during the 2011 to 2012 cruise to Mars: an average of 1.8 mSv a day from galactic cosmic rays.',
    source: 'Zeitlin et al. 2013, Science; Southwest Research Institute release of 30 May 2013',
    url: 'https://www.swri.org/newsroom/press-releases/swri-led-team-calculates-the-radiation-exposure-associated-trip-mars',
  },
});

export function doseRateFor(mission) {
  const r = DOSE_RATES[mission] || DOSE_RATES.iss;
  return r.measured ? radlabMeanMsvPerDay() : r.mSvPerDay;
}

// ---------------------------------------------------------------------------
// 3. The May 2024 solar storm
// Source: NASA DONKI (Space Weather Database Of Notifications, Knowledge,
// Information), Community Coordinated Modeling Center.
//   https://ccmc.gsfc.nasa.gov/DONKI/WS/get/SEP?startDate=2024-05-01&endDate=2024-05-31
//   and the same query for FLR and GST. Retrieved 14 Nov 2026.
// sep: solar energetic particle events (time, detecting instrument).
// flares: the 21 X-class flares out of 181 flares that month (peak time, class).
// storms: geomagnetic storms (start time, highest Kp index).
export const DONKI_MAY_2024 = Object.freeze({
  source: 'NASA DONKI, Community Coordinated Modeling Center',
  url: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/',
  retrieved: '2026-11-14',
  range: ['2024-05-01', '2024-05-31'],
  replayNow: '2024-05-11T06:00:00Z',
  flareCount: 181,
  sep: [
    { t: '2024-05-09T13:59Z', inst: 'MODEL: REleASE:ACE/EPAM 15.8-39.8 MeV' },
    { t: '2024-05-09T14:25Z', inst: 'MODEL: REleASE:SOHO/EPHIN 15.8-39.8 MeV' },
    { t: '2024-05-10T12:59Z', inst: 'SOHO: COSTEP 15.8-39.8 MeV' },
    { t: '2024-05-10T13:02Z', inst: 'SOHO: COSTEP 28.2-50.1 MeV' },
    { t: '2024-05-10T13:35Z', inst: 'GOES-P: SEISS >10 MeV' },
    { t: '2024-05-10T14:50Z', inst: 'STEREO A: IMPACT 13-100 MeV' },
    { t: '2024-05-11T02:10Z', inst: 'GOES-P: SEISS >100 MeV' },
    { t: '2024-05-11T04:07Z', inst: 'STEREO A: IMPACT 13-100 MeV' },
    { t: '2024-05-13T12:44Z', inst: 'STEREO A: IMPACT 13-100 MeV' },
    { t: '2024-05-13T13:10Z', inst: 'MODEL: REleASE:SOHO/EPHIN 15.8-39.8 MeV' },
    { t: '2024-05-13T14:00Z', inst: 'GOES-P: SEISS >10 MeV' },
    { t: '2024-05-13T16:19Z', inst: 'MODEL: REleASE:ACE/EPAM 15.8-39.8 MeV' },
    { t: '2024-05-13T18:07Z', inst: 'SOHO: COSTEP 15.8-39.8 MeV' },
    { t: '2024-05-13T18:07Z', inst: 'SOHO: COSTEP 28.2-50.1 MeV' },
  ],
  flares: [
    { t: '2024-05-03T02:22Z', c: 'X1.6' }, { t: '2024-05-05T06:01Z', c: 'X1.3' }, { t: '2024-05-05T11:54Z', c: 'X1.2' },
    { t: '2024-05-06T06:35Z', c: 'X4.5' }, { t: '2024-05-08T01:41Z', c: 'X1.0' }, { t: '2024-05-08T05:09Z', c: 'X1.0' },
    { t: '2024-05-08T21:40Z', c: 'X1.0' }, { t: '2024-05-09T09:13Z', c: 'X2.2' }, { t: '2024-05-09T17:44Z', c: 'X1.1' },
    { t: '2024-05-10T06:54Z', c: 'X3.9' }, { t: '2024-05-11T01:23Z', c: 'X5.8' }, { t: '2024-05-11T11:44Z', c: 'X1.5' },
    { t: '2024-05-12T16:26Z', c: 'X1.0' }, { t: '2024-05-14T02:09Z', c: 'X1.7' }, { t: '2024-05-14T12:55Z', c: 'X1.2' },
    { t: '2024-05-14T16:51Z', c: 'X8.7' }, { t: '2024-05-15T08:37Z', c: 'X3.4' }, { t: '2024-05-15T14:38Z', c: 'X2.9' },
    { t: '2024-05-27T07:08Z', c: 'X2.8' }, { t: '2024-05-29T14:37Z', c: 'X1.4' }, { t: '2024-05-31T22:03Z', c: 'X1.1' },
  ],
  storms: [
    { t: '2024-05-02T15:00Z', kp: 6.67 }, { t: '2024-05-10T15:00Z', kp: 9 }, { t: '2024-05-12T21:00Z', kp: 6.33 },
    { t: '2024-05-16T06:00Z', kp: 6 }, { t: '2024-05-17T18:00Z', kp: 6 },
  ],
});

// ---------------------------------------------------------------------------
// 4. Blood chemistry of a real crew: Inspiration4
// Source: NASA Open Science Data Repository, study OSD-575, file
//   LSDS-8_Comprehensive_Metabolic_Panel_CMP_TRANSFORMED.csv (open access).
//   https://osdr.nasa.gov/bio/repo/data/studies/OSD-575
// Retrieved 14 Nov 2026. Four crew, a three-day orbital flight in September
// 2021, serum drawn 92, 44 and 3 days before launch and 1, 45, 82 and 194 days
// after return. There are no in-flight samples. Only the lowest and highest
// value of the four crew is kept for each draw; no individual is shown.
// The file does not say whether the draws were fasting.
export const I4_PANEL = Object.freeze({
  source: 'NASA OSDR study OSD-575 (Inspiration4), comprehensive metabolic panel',
  url: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-575',
  retrieved: '2026-11-14',
  crew: 4,
  glucose: {
    unit: 'mg/dL',
    labRange: [65, 99],
    draws: [
      { when: '92 days before launch', min: 69, max: 100 },
      { when: '44 days before launch', min: 62, max: 83 },
      { when: '3 days before launch', min: 56, max: 78 },
      { when: '1 day after return', min: 83, max: 103 },
      { when: '45 days after return', min: 36, max: 84 },
      { when: '82 days after return', min: 77, max: 91 },
      { when: '194 days after return', min: 73, max: 87 },
    ],
  },
  potassium: {
    unit: 'mmol/L',
    labRange: [3.5, 5.3],
    draws: [
      { when: '92 days before launch', min: 3.7, max: 4.6 },
      { when: '44 days before launch', min: 3.5, max: 4.2 },
      { when: '3 days before launch', min: 3.3, max: 3.9 },
      { when: '1 day after return', min: 3, max: 4.4 },
      { when: '45 days after return', min: 4, max: 5.9 },
      { when: '82 days after return', min: 3.7, max: 4.3 },
      { when: '194 days after return', min: 3.8, max: 4.4 },
    ],
  },
});
