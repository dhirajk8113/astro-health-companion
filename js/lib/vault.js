// The stored health record, encrypted. Once a PIN is set the record is written
// to the tablet only as AES-GCM ciphertext, under a key stretched from the PIN
// with PBKDF2, and it is opened only after the PIN is entered.
//
// What this does not do: a four-digit PIN is short, so someone holding the
// tablet could try all 10,000. A flight unit would need a longer code or a second factor.
//
// AI disclosure: written with an AI coding assistant (Claude). See AI-USE.md.

export const VAULT_KEY = 'aeronyx.vault.v1';
const ITERATIONS = 150000;

function toBase64(bytes) {
  const view = new Uint8Array(bytes);
  let text = '';
  // In pieces, so a large record does not overflow the call stack.
  for (let i = 0; i < view.length; i += 0x8000) text += String.fromCharCode(...view.subarray(i, i + 0x8000));
  return btoa(text);
}

function fromBase64(text) {
  const raw = atob(text);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

// The key that opens the record: never stored, made again from the PIN each time.
export async function deriveKey(pin, salt, cryptoImpl = globalThis.crypto) {
  const enc = new TextEncoder();
  const base = await cryptoImpl.subtle.importKey('raw', enc.encode(String(pin)), 'PBKDF2', false, ['deriveKey']);
  return cryptoImpl.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(`${salt}:record`), iterations: ITERATIONS },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

// Encrypts the record as text. A fresh random IV every time.
export async function seal(key, text, cryptoImpl = globalThis.crypto) {
  const iv = new Uint8Array(12);
  cryptoImpl.getRandomValues(iv);
  const data = await cryptoImpl.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
  return { v: 1, iv: toBase64(iv), data: toBase64(data) };
}

// Decrypts it. Throws when the key is wrong or the stored bytes were changed.
export async function open(key, sealed, cryptoImpl = globalThis.crypto) {
  const plain = await cryptoImpl.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(sealed.iv) }, key, fromBase64(sealed.data));
  return new TextDecoder().decode(plain);
}

export function loadVault(storage) {
  try {
    const raw = storage.getItem(VAULT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v.iv === 'string' && typeof v.data === 'string' ? v : null;
  } catch (err) {
    return null;
  }
}

export function saveVault(storage, sealed) {
  storage.setItem(VAULT_KEY, JSON.stringify(sealed));
}
