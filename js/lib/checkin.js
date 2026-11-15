// Aeronyx: check-in logic for Astro, the chat companion.
//
// AI disclosure: written with an AI coding assistant (Claude). See AI-USE.md.
//
// Astro is a companion, not a clinician. This file holds fixed rules only:
// it reads three self-ratings, offers a short activity, and hands off to
// people when the ratings or the words call for it. There is no language
// model in the product, so Astro works with no link to Earth.

export const LEVEL = Object.freeze({ STEADY: 'steady', SUPPORT: 'support', HANDOFF: 'handoff' });

// Phrases that always trigger a handoff to people, whatever the ratings say.
const CRISIS = /(suicid|kill(?:ing)? myself|end(?:ing)? my life|end(?:ing)? it all|hurt(?:ing)? myself|harm(?:ing)? myself|self[- ]harm|want to die|wish i (?:was|were) dead|better off dead|take my (?:own )?life|do(?:n'?t| not) want to (?:live|be here|be alive)|can'?t go on|no reason to live)/i;

export function isCrisisText(text) {
  // Phones type a curly apostrophe; treat it as a straight one.
  return CRISIS.test(String(text || '').replace(/[\u2018\u2019]/g, "'"));
}

function clamp(n, lo, hi) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.min(hi, Math.max(lo, v));
}

// mood: 1 (very low) to 10 (very good). stress and loneliness: 0 (none) to 10.
export function scoreCheckin({ mood, stress, loneliness, text }) {
  const m = clamp(mood, 1, 10);
  const s = clamp(stress, 0, 10);
  const l = clamp(loneliness, 0, 10);
  if (m === null || s === null || l === null) throw new Error('A check-in needs all three ratings.');
  const reasons = [];
  const crisis = isCrisisText(text);
  let level = LEVEL.STEADY;
  if (crisis) reasons.push('what you wrote');
  if (m <= 2) reasons.push('a very low mood rating');
  if (s >= 9) reasons.push('a very high stress rating');
  if (l >= 9) reasons.push('a very high loneliness rating');
  if (reasons.length) {
    level = LEVEL.HANDOFF;
  } else {
    if (m <= 4) reasons.push('a low mood rating');
    if (s >= 6) reasons.push('a raised stress rating');
    if (l >= 6) reasons.push('a raised loneliness rating');
    if (reasons.length) level = LEVEL.SUPPORT;
  }
  return { mood: m, stress: s, loneliness: l, level, reasons, crisis };
}

// True when the last `count` check-ins all sit at least `drop` below baseline.
export function sustainedLow(checkins, baselineMood, count = 3, drop = 2) {
  if (!Number.isFinite(baselineMood)) return false;
  const recent = [...checkins].sort((a, b) => new Date(a.t) - new Date(b.t)).slice(-count);
  if (recent.length < count) return false;
  return recent.every((c) => baselineMood - c.mood >= drop);
}

export const ACTIVITIES = [
  {
    id: 'breathing',
    name: 'Box breathing',
    minutes: 2,
    helps: ['stress'],
    steps: ['Breathe in for four seconds.', 'Hold for four seconds.', 'Breathe out for four seconds.', 'Hold for four seconds.', 'Repeat for two minutes.'],
  },
  {
    id: 'grounding',
    name: 'Five senses grounding',
    minutes: 3,
    helps: ['stress'],
    steps: ['Name five things you can see.', 'Name four things you can touch.', 'Name three things you can hear.', 'Name two things you can smell.', 'Name one thing you can taste.'],
  },
  {
    id: 'message',
    name: 'Write a note home',
    minutes: 10,
    helps: ['loneliness'],
    steps: ['Pick one person.', 'Tell them one thing that happened this week and one thing you are looking forward to.', 'Save it for the next communication window.'],
  },
  {
    id: 'connect',
    name: 'Do one thing with a crewmate',
    minutes: 20,
    helps: ['loneliness', 'mood'],
    steps: ['Share a meal, an exercise session or a game today.', 'Tell them one thing about how your week is going.'],
  },
  {
    id: 'move',
    name: 'Ten minutes of movement',
    minutes: 10,
    helps: ['mood', 'stress'],
    steps: ['Use the treadmill, cycle or resistance device at an easy effort.', 'Stop at ten minutes even if you feel like doing more.'],
  },
  {
    id: 'plan',
    name: 'Plan one thing to look forward to',
    minutes: 5,
    helps: ['mood'],
    steps: ['Choose something small within the next three days.', 'Put it on the schedule and tell one crewmate.'],
  },
];

// Up to three activities, chosen by which rating is furthest from comfortable.
export function pickActivities(score) {
  const need = [
    { key: 'stress', size: score.stress },
    { key: 'loneliness', size: score.loneliness },
    { key: 'mood', size: 10 - score.mood },
  ].sort((a, b) => b.size - a.size);
  const picked = [];
  for (const n of need) {
    for (const a of ACTIVITIES) {
      if (a.helps.includes(n.key) && !picked.includes(a)) {
        picked.push(a);
        break;
      }
    }
  }
  return picked.slice(0, 3);
}

// "a, b and c"
function listOf(items) {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

// What Astro says back. Fixed wording chosen by rule, never generated.
export function astroReply(score, { sustained = false } = {}) {
  if (score.level === LEVEL.HANDOFF) {
    return {
      title: 'This needs a person, not an app.',
      lines: [
        'Thank you for telling me. I am a companion, not a clinician, and this is beyond what I should handle.',
        'Please talk to your crew medical officer now.',
        'I am sending a flag to your flight surgeon and behavioral health team now. It carries your ratings, not what you wrote.',
      ],
    };
  }
  if (score.level === LEVEL.SUPPORT) {
    const lines = [
      `Thanks for checking in. I noticed ${listOf(score.reasons)}.`,
      'Here are a few short things that can help. Pick one, or none.',
    ];
    if (sustained) {
      lines.push('Your mood has been below your usual level for several check-ins in a row. That is worth raising at your next private conference with the behavioral health team.');
    }
    return { title: 'Sounds like a heavier day.', lines };
  }
  const lines = ['Thanks for checking in. Your ratings are close to your usual level.'];
  if (sustained) {
    lines.push('Your mood has still been below your usual level for several check-ins in a row. That is worth raising at your next private conference.');
  } else {
    lines.push('An activity is here if you want one.');
  }
  return { title: 'Steady today.', lines };
}

export const BOUNDARY = 'Aeronyx is a health monitor and Astro is its chat companion. Neither is a doctor or a therapist, and neither diagnoses or treats. They show your readings, offer support, and tell you when to involve your crew medical officer, flight surgeon or behavioral health team.';
