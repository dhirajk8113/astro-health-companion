// Astro health companion: example onboard medical kit.
//
// AI disclosure: written with an AI coding assistant (Claude). See AI-USE.md.
//
// This is a demo formulary, not a medical reference. Astro never chooses a
// medication or a dose. Prescriptions come only from the flight surgeon, and
// beyond Earth orbit every item has to come from the kit already on board.
//
// Items marked with a pack name are listed, with that strength, in NASA's
// "ISS Medical Kit: Contents and Reference" of 9 April 2015 (checked against
// the document on 14 Nov 2026). That list is historical. The three
// countermeasures are not in it. Unit counts are demo values.

import { SOURCES } from './indicators.js';

export const MEDICATIONS = [
  {
    id: 'kcitrate',
    kit: null,
    kitNote: 'Not in NASA\'s 2015 kit list. A countermeasure studied in flight.',
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
    kit: null,
    kitNote: 'Not in NASA\'s 2015 kit list. A daily supplement.',
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
    kit: null,
    kitNote: 'Not in NASA\'s 2015 kit list. A countermeasure studied in flight.',
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
    name: 'Zolpidem (Ambien)',
    form: 'tablet',
    defaultDose: '10 mg',
    defaultEveryHours: 24,
    linkedIndicator: 'sleep',
    purpose: 'Sleep aid. About three quarters of ISS crew have used sleep medication at some point.',
    kitUnits: 60,
    kit: 'Convenience Medication Pack',
    source: SOURCES.medKit,
  },
  {
    id: 'zaleplon',
    name: 'Zaleplon (Sonata)',
    form: 'capsule',
    defaultDose: '10 mg',
    defaultEveryHours: 24,
    linkedIndicator: 'sleep',
    purpose: 'Sleep aid.',
    kitUnits: 40,
    kit: 'Convenience Medication Pack',
    source: SOURCES.medKit,
  },
  {
    id: 'melatonin',
    name: 'Melatonin',
    form: 'tablet',
    defaultDose: '3 mg',
    defaultEveryHours: 24,
    linkedIndicator: 'sleep',
    purpose: 'Sleep aid.',
    kitUnits: 60,
    kit: 'Convenience Medication Pack',
    source: SOURCES.medKit,
  },
  {
    id: 'antinausea',
    name: 'Meclizine (Antivert)',
    form: 'tablet',
    defaultDose: '25 mg',
    defaultEveryHours: 0,
    linkedIndicator: null,
    purpose: 'Motion sickness. Space motion sickness affects 60 to 80 percent of crew in the first two to three days. Taken only as needed.',
    kitUnits: 30,
    kit: 'Oral Medication Pack',
    source: SOURCES.medKit,
  },
  {
    id: 'promethazine',
    name: 'Promethazine (Phenergan)',
    form: 'tablet',
    defaultDose: '25 mg',
    defaultEveryHours: 0,
    linkedIndicator: null,
    purpose: 'Motion sickness and nausea. Taken only as needed.',
    kitUnits: 30,
    kit: 'Oral Medication Pack',
    source: SOURCES.medKit,
  },
  {
    id: 'ibuprofen',
    name: 'Ibuprofen (Motrin)',
    form: 'tablet',
    defaultDose: '400 mg',
    defaultEveryHours: 0,
    linkedIndicator: null,
    purpose: 'Pain and headache. Taken only as needed.',
    kitUnits: 100,
    kit: 'Convenience Medication Pack',
    source: SOURCES.medKit,
  },
  {
    id: 'acetaminophen',
    name: 'Acetaminophen (Tylenol)',
    form: 'tablet',
    defaultDose: '325 mg',
    defaultEveryHours: 0,
    linkedIndicator: null,
    purpose: 'Pain and fever. Taken only as needed.',
    kitUnits: 100,
    kit: 'Convenience Medication Pack',
    source: SOURCES.medKit,
  },
  {
    id: 'loratadine',
    name: 'Loratadine (Claritin)',
    form: 'tablet',
    defaultDose: '10 mg',
    defaultEveryHours: 0,
    linkedIndicator: null,
    purpose: 'Allergy and congestion. Taken only as needed.',
    kitUnits: 40,
    kit: 'Convenience Medication Pack',
    source: SOURCES.medKit,
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
