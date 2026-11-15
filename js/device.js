// Aeronyx: wiring for the concept device drawn around the screen.
//
// AI disclosure: written with an AI coding assistant (Claude). See AI-USE.md.

import { loadDevicePref, saveDevicePref } from './lib/device.js';

function pulse(selector) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.classList.remove('is-active');
  // Reading a layout value restarts the animation when the class comes back.
  void el.offsetWidth;
  el.classList.add('is-active');
  window.clearTimeout(el.pulseTimer);
  el.pulseTimer = window.setTimeout(() => el.classList.remove('is-active'), 2800);
}

export function initDevice() {
  const root = document.documentElement;
  const apply = (on) => { root.dataset.device = on ? 'on' : 'off'; };
  apply(loadDevicePref(window.localStorage));

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-device-toggle]')) {
      const on = root.dataset.device !== 'on';
      apply(on);
      saveDevicePref(window.localStorage, on);
      return;
    }
    const go = event.target.closest('[data-device-go]');
    if (go) window.location.hash = `#${go.dataset.deviceGo}`;
  });

  document.addEventListener('aeronyx:sample', () => pulse('.dv-sample'));
  document.addEventListener('aeronyx:dose', () => pulse('.dv-meds'));
}
