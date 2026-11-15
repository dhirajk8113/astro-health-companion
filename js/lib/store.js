// Aeronyx: storage. Everything stays in this browser.
//
// AI disclosure: written with an AI coding assistant (Claude). See AI-USE.md.

import { emptyState } from '../data/demo.js';
import { defaultInventory } from '../data/medications.js';

const KEY = 'astro.health.v1';

function merge(saved) {
  const base = emptyState();
  if (!saved || typeof saved !== 'object') return base;
  const state = { ...base, ...saved };
  state.profile = { ...base.profile, ...(saved.profile || {}) };
  state.profile.baselines = { ...(saved.profile && saved.profile.baselines ? saved.profile.baselines : {}) };
  state.inventory = { ...defaultInventory(), ...(saved.inventory || {}) };
  for (const key of ['readings', 'prescriptions', 'doses', 'checkins', 'notesHome', 'outbox', 'inbox', 'chat']) {
    if (!Array.isArray(state[key])) state[key] = [];
  }
  return state;
}

export function loadState() {
  try {
    const raw = window.localStorage.getItem(KEY);
    return merge(raw ? JSON.parse(raw) : null);
  } catch (err) {
    // Private browsing or a blocked store: carry on in memory.
    return emptyState();
  }
}

const SEEN = 'aeronyx.seen.v1';

// True once, the first time this browser opens the app with nothing saved.
export function isFirstVisit() {
  try {
    const store = window.localStorage;
    const first = store.getItem(SEEN) === null && store.getItem(KEY) === null;
    store.setItem(SEEN, '1');
    return first;
  } catch (err) {
    return false;
  }
}

export function saveState(state) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    return false;
  }
}

export function clearState() {
  try {
    window.localStorage.removeItem(KEY);
  } catch (err) {
    // Nothing to clear.
  }
  return emptyState();
}

let counter = 0;
export function newId(prefix) {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}
