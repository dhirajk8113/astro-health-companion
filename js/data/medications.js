// Astro health companion: example onboard medical kit.
//
// AI disclosure: written with an AI coding assistant (Claude). See AI-USE.md.
//
// This is a demo formulary, not a medical reference. Astro never chooses a
// medication or a dose. Prescriptions come only from the flight surgeon, and
// beyond Earth orbit every item has to come from the kit already on board.

import { SOURCES } from './indicators.js';

export const MEDICATIONS = [
  {
    id: 'kcitrate',
    name: 'Potassium citrate',
    form: 'tablet',
    defaultDose: '20 mEq',
    defaultEveryHours: 24,
    linkedIndicator: 'urine_ca',
    purpose: 'Kidney stone countermeasure. A dose of 20 mEq a day lowered urinary calcium in an in-flight trial.',
    kitUnits: 180,
    source: SOURCES.renal,
  },
  {
    id: 'vitd3',
    name: 'Vitamin D3',
    form: 'capsule',
    defaultDose: '1,000 IU',
    defaultEveryHours: 24,
    linkedIndicator: 'vitd',
    purpose: 'Daily supplement, because a spacecraft has no sunlight exposure.',
    kitUnits: 365,
    source: SOURCES.nutrition,
  },
  {
    id: 'alendronate',
    name: 'Alendronate',
    form: 'tablet',
    defaultDose: '70 mg',
    defaultEveryHours: 168,
    linkedIndicator: 'urine_ca',
    purpose: 'Bone-loss countermeasure tested in flight alongside resistance exercise. Bone density cannot be measured in orbit, so urinary calcium is the closest in-flight signal.',
    kitUnits: 52,
    source: SOURCES.bone,
  },
  {
    id: 'sleepaid',
    name: 'Sleep aid (as prescribed)',
    form: 'tablet',
    defaultDose: '1 tablet',
    defaultEveryHours: 24,
    linkedIndicator: 'sleep',
    purpose: 'Short-term help with sleep. About three quarters of ISS crew have used sleep medication at some point.',
    kitUnits: 60,
    source: SOURCES.sleepReport,
  },
  {
    id: 'antinausea',
    name: 'Motion sickness medication (as prescribed)',
    form: 'tablet',
    defaultDose: '1 tablet',
    defaultEveryHours: 0,
    linkedIndicator: null,
    purpose: 'Space motion sickness affects 60 to 80 percent of crew in the first two to three days. Taken only as needed.',
    kitUnits: 30,
    source: SOURCES.risks,
  },
];

export function getMedication(id) {
  return MEDICATIONS.find((m) => m.id === id) || null;
}

export function defaultInventory() {
  const inv = {};
  for (const m of MEDICATIONS) inv[m.id] = m.kitUnits;
  return inv;
}
