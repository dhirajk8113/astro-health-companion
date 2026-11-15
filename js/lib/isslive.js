// Astro health companion: live cabin readings from the International Space Station.
//
// AI disclosure: written with an AI coding assistant (Claude). See AI-USE.md.
//
// NASA publishes a subset of ISS telemetry through a public Lightstreamer
// server (the feed behind "ISS Live"). This is a small client for that
// server's text protocol (TLCP over a WebSocket). No library is loaded.
// The feed drops out for a few minutes on most orbits and single channels
// can stop updating for days, so every value carries its own timestamp and
// Astro says how old it is.

export const ISS_SERVER = 'wss://push.lightstreamer.com/lightstreamer';
const PROTOCOL = 'TLCP-2.4.0.lightstreamer.com';
const CLIENT_ID = 'mgQkwtwdysogQz2BJ4Ji%20kOj2Bg';

// Limits are NASA-STD-3001 Volume 2 requirements as given in NASA's ECLSS
// technical brief (OCHMO-TB-002): cabin 18 to 27 degrees C [V2 6012], and a
// one-hour average carbon dioxide partial pressure under 3 mmHg [V2 6004].
// 1 torr is 1 mmHg to within one part in seven million.
export const ISS_ITEMS = Object.freeze([
  { id: 'USLAB000059', name: 'Cabin temperature', unit: '°C', digits: 1, limit: { lo: 18, hi: 27, text: '18 to 27 °C (NASA-STD-3001 V2 6012)' } },
  { id: 'USLAB000058', name: 'Cabin pressure', unit: 'torr', digits: 0 },
  { id: 'USLAB000055', name: 'Carbon dioxide, US Lab', unit: 'mmHg', digits: 2, limit: { hi: 3, text: 'under 3 mmHg, one-hour average (NASA-STD-3001 V2 6004)' } },
  { id: 'NODE3000005', name: 'Urine tank', unit: '%', digits: 0 },
  { id: 'NODE3000008', name: 'Waste water tank', unit: '%', digits: 0 },
  { id: 'NODE3000009', name: 'Clean water tank', unit: '%', digits: 0 },
]);

export const FRESH_MINUTES = 30;

// The feed's TimeStamp is hours counted from the start of the year, with day
// 1 beginning at 24: 7657.33 is day 319 at 01:20 UTC.
export function issTimestampToMs(hours, year) {
  return Date.UTC(year, 0, 1) + (hours - 24) * 3.6e6;
}

// Decodes one TLCP update, "U,<sub>,<item>,<field>|<field>", into the fields
// that changed. An empty field is unchanged, "#" is null, "$" is empty,
// "^3" skips three unchanged fields.
export function parseUpdate(line, fieldCount) {
  const first = line.indexOf(',');
  const second = line.indexOf(',', first + 1);
  const third = line.indexOf(',', second + 1);
  if (!line.startsWith('U,') || third < 0) return null;
  const item = Number(line.slice(second + 1, third));
  const raw = line.slice(third + 1).split('|');
  const fields = {};
  let i = 0;
  for (const part of raw) {
    if (i >= fieldCount) break;
    if (part === '') { i += 1; continue; }
    if (part[0] === '^') { i += Number(part.slice(1)) || 0; continue; }
    fields[i] = part === '#' ? null : part === '$' ? '' : decodeURIComponent(part);
    i += 1;
  }
  return { item, fields };
}

// Judges one reading. `ageMinutes` is how long ago the station last sent it.
export function cabinStatus(item, value, ageMinutes) {
  if (!Number.isFinite(value)) return { status: 'none', text: 'No value received yet.' };
  if (ageMinutes > FRESH_MINUTES) return { status: 'stale', text: 'Not updating. Too old to judge.' };
  if (!item.limit) return { status: 'info', text: 'Shown for information. No NASA limit applied.' };
  const { lo, hi, text } = item.limit;
  const low = Number.isFinite(lo) && value < lo;
  const high = Number.isFinite(hi) && (Number.isFinite(lo) ? value > hi : value >= hi);
  if (low || high) return { status: 'attention', text: `Outside NASA's limit: ${text}.` };
  return { status: 'ok', text: `Within NASA's limit: ${text}.` };
}

export function formatAge(minutes) {
  if (!Number.isFinite(minutes)) return 'never';
  if (minutes < 1) return 'seconds ago';
  if (minutes < 90) return `${Math.round(minutes)} min ago`;
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)} h ago`;
  return `${Math.round(minutes / 1440)} days ago`;
}

// Opens the feed. `onChange(snapshot)` is called with
// { state: 'connecting' | 'live' | 'closed', values: { id: { value, t } } }.
// Returns a function that closes the connection.
export function connectIss(onChange, WebSocketImpl = globalThis.WebSocket) {
  const values = {};
  let state = 'connecting';
  let closed = false;
  const emit = () => onChange({ state, values: { ...values } });
  if (!WebSocketImpl) { state = 'closed'; emit(); return () => {}; }
  let ws;
  try { ws = new WebSocketImpl(ISS_SERVER, PROTOCOL); } catch (e) { state = 'closed'; emit(); return () => {}; }
  const ids = ISS_ITEMS.map((i) => i.id);
  const year = new Date().getUTCFullYear();
  ws.onopen = () => ws.send('wsok');
  ws.onerror = () => { state = 'closed'; emit(); };
  ws.onclose = () => { state = 'closed'; if (!closed) emit(); };
  ws.onmessage = (message) => {
    let changed = false;
    for (const line of String(message.data).split('\r\n')) {
      if (line === 'WSOK') {
        ws.send(`create_session\r\nLS_adapter_set=ISSLIVE&LS_cid=${CLIENT_ID}&LS_send_sync=false&LS_cause=api`);
      } else if (line.startsWith('CONOK,')) {
        const session = line.split(',')[1];
        ws.send(`control\r\nLS_reqId=1&LS_op=add&LS_subId=1&LS_mode=MERGE&LS_group=${ids.join('%20')}&LS_schema=Value%20TimeStamp&LS_snapshot=true&LS_session=${session}`);
      } else if (line.startsWith('SUBOK,')) {
        state = 'live';
        changed = true;
      } else if (line.startsWith('U,')) {
        const update = parseUpdate(line, 2);
        const id = update && ids[update.item - 1];
        if (!id) continue;
        const prev = values[id] || {};
        const value = update.fields[0] !== undefined ? Number(update.fields[0]) : prev.value;
        const t = update.fields[1] !== undefined ? issTimestampToMs(Number(update.fields[1]), year) : prev.t;
        values[id] = { value, t };
        changed = true;
      } else if (line.startsWith('CONERR') || line.startsWith('END') || line.startsWith('REQERR')) {
        state = 'closed';
        changed = true;
      }
    }
    if (changed) emit();
  };
  emit();
  return () => { closed = true; try { ws.close(); } catch (e) { /* already closed */ } };
}
