// Every line Astro can say, in a fixed order. Used to record them and to check
// that none is missing a recording.
//
// AI disclosure: written with an AI coding assistant (Claude). See AI-USE.md.

import { OPENING, HANDOFF_TEXT, CHECKIN_STEPS, chatReply } from '../js/lib/chat.js';
import { scoreCheckin, astroReply } from '../js/lib/checkin.js';

export function allAstroLines() {
  const lines = new Set([OPENING, HANDOFF_TEXT, ...CHECKIN_STEPS.map((s) => s.ask)]);
  // Each topic, said often enough to hear every reply it rotates through.
  const probes = ['who are you', 'help', 'my back hurts', 'everything feels heavy', 'I am stressed', 'I feel anxious', 'I cannot sleep', 'I miss home', 'I feel low', 'I am angry', 'I am bored', 'thanks', 'hello', 'I am good', 'xyzzy'];
  for (const p of probes) {
    const history = [];
    for (let i = 0; i < 6; i += 1) {
      const r = chatReply(p, history);
      lines.add(r.text);
      history.push({ from: 'me', text: p }, { from: 'astro', text: r.text, topic: r.topic });
    }
  }
  for (const s of CHECKIN_STEPS) lines.add(`Pick a number from ${s.min} to ${s.max}. You can tap one below.`);
  // Every result a check-in can give.
  for (let m = 1; m <= 10; m += 1) {
    for (let s = 0; s <= 10; s += 1) {
      for (let l = 0; l <= 10; l += 1) {
        for (const sustained of [false, true]) {
          const r = astroReply(scoreCheckin({ mood: m, stress: s, loneliness: l, text: '' }), { sustained });
          lines.add(`${r.title} ${r.lines.join(' ')}`);
        }
      }
    }
  }
  return [...lines];
}

if (process.argv[1] && process.argv[1].endsWith('voice-lines.mjs')) {
  process.stdout.write(JSON.stringify(allAstroLines(), null, 1));
}
