// AeroNYX: the concept device drawn around the screen.
//
// AI disclosure: written with an AI coding assistant (Claude). See AI-USE.md.
//
// The device shape is the team's own sketch: a screen with a sample submitter
// on the left, a medication dispenser on the right and attachment clips on
// top. It is a drawing. No hardware exists, and the two side units only react
// on screen when a sample reading is logged or a dose is dispensed.

const KEY = 'aeronyx.device.v1';

// The device is drawn only when the window has room for it. These numbers
// match the media query in css/styles.css.
export function deviceFits(width, height) {
  return width >= 1000 && height >= 600;
}

// Shown unless the person has hidden it.
export function loadDevicePref(storage) {
  try {
    return storage.getItem(KEY) !== 'off';
  } catch (err) {
    return true;
  }
}

export function saveDevicePref(storage, on) {
  try {
    storage.setItem(KEY, on ? 'on' : 'off');
    return true;
  } catch (err) {
    return false;
  }
}

// Blood and urine readings are the ones that would pass through the sample submitter.
export function usesSampleSubmitter(indicator) {
  return Boolean(indicator) && (indicator.group === 'blood' || indicator.group === 'urine');
}
