// The lock on the tablet: a four-digit PIN.
//
// What this does and does not do: it keeps the screens closed until the right
// PIN is entered, and it locks again after a few idle minutes. The PIN itself
// is stored only as a salted, stretched hash. The health record itself is
// encrypted under a key made from the same PIN: see vault.js.
//
// AI disclosure: written with an AI coding assistant (Claude). See AI-USE.md.

export const LOCK_KEY = 'aeronyx.lock.v1';
export const PIN_LENGTH = 4;
export const MAX_TRIES = 5;
export const WAIT_MS = 30000;
export const IDLE_MS = 5 * 60000;

export function validPin(pin) {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(String(pin));
}

const toHex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

export function newSalt(cryptoImpl = globalThis.crypto) {
  const bytes = new Uint8Array(16);
  cryptoImpl.getRandomValues(bytes);
  return toHex(bytes);
}

// PBKDF2 with SHA-256, so a stolen hash cannot be tried quickly.
export async function hashPin(pin, salt, cryptoImpl = globalThis.crypto) {
  const enc = new TextEncoder();
  const key = await cryptoImpl.subtle.importKey('raw', enc.encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
  const bits = await cryptoImpl.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 150000 }, key, 256);
  return toHex(bits);
}

// The saved lock: { salt, hash }, or null when no PIN has been set yet.
export function loadLock(storage) {
  try {
    const raw = storage.getItem(LOCK_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v.salt === 'string' && typeof v.hash === 'string' ? v : null;
  } catch (err) {
    return null;
  }
}

export async function setPin(storage, pin, cryptoImpl = globalThis.crypto) {
  if (!validPin(pin)) throw new Error('A PIN is four digits.');
  const salt = newSalt(cryptoImpl);
  const lock = { salt, hash: await hashPin(pin, salt, cryptoImpl) };
  storage.setItem(LOCK_KEY, JSON.stringify(lock));
  return lock;
}

export async function checkPin(lock, pin, cryptoImpl = globalThis.crypto) {
  if (!lock || !validPin(pin)) return false;
  const hash = await hashPin(pin, lock.salt, cryptoImpl);
  // Compare every character, so the time taken says nothing about where they differ.
  let diff = hash.length ^ lock.hash.length;
  for (let i = 0; i < hash.length; i += 1) diff |= hash.charCodeAt(i) ^ (lock.hash.charCodeAt(i) || 0);
  return diff === 0;
}

// After MAX_TRIES wrong PINs the keypad rests for WAIT_MS.
export function afterWrongPin(tries, nowMs) {
  const next = tries + 1;
  return next >= MAX_TRIES ? { tries: 0, waitUntil: nowMs + WAIT_MS } : { tries: next, waitUntil: 0 };
}
