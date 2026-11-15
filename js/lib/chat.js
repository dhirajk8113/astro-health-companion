// Aeronyx: what Astro, the chat companion, says back.
//
// AI disclosure: written with an AI coding assistant (Claude). See AI-USE.md.
//
// Astro is a scripted companion. Every reply below is fixed wording chosen by
// a rule that looks for words in what the crew member typed. There is no
// language model in the product, so Astro works with no link to Earth and can
// never say something the team has not read. Astro is not a person or a
// therapist: it listens, offers a calming activity, and hands off to people.

import { isCrisisText, LEVEL } from './checkin.js';

export const OPENING = "Hi, I'm Astro. I'm here to listen. How are you doing right now?";

// The three questions of a check-in, asked one at a time in the chat.
export const CHECKIN_STEPS = [
  { key: 'mood', ask: 'How is your mood today? 1 is very low, 10 is very good.', min: 1, max: 10 },
  { key: 'stress', ask: 'How stressed do you feel? 0 is not at all, 10 is extremely.', min: 0, max: 10 },
  { key: 'loneliness', ask: 'How lonely or cut off do you feel? 0 is not at all, 10 is extremely.', min: 0, max: 10 },
];

export const HANDOFF_TEXT = 'Thank you for telling me. This needs a person, not me. Please talk to your crew medical officer now. I am flagging your flight surgeon and behavioral health team. The flag does not include what you wrote.';

const NEGATED = /\b(not|never|no|isn'?t|aren'?t|don'?t|doesn'?t|can'?t|won'?t|hardly)\b/i;

// Checked in order: the first topic whose words appear wins.
const TOPICS = [
  {
    id: 'identity',
    test: /\b(who|what) are you\b|\bare you (real|human|a person|a bot|an ai|a robot|a therapist|alive)\b|\btherapist\b/i,
    level: LEVEL.STEADY,
    replies: ["I'm Astro, a scripted companion on this tablet. I'm not a person or a therapist, but I can listen and help you reach one."],
  },
  {
    id: 'physical',
    test: /\b(pain|hurts?|aches?|dizzy|nausea|nauseous|vomit\w*|fever|bleeding|chest|headache|migraine|numbness)\b/i,
    level: LEVEL.STEADY,
    replies: ["That sounds physical, and I can't assess symptoms. Log it under Readings and tell your crew medical officer."],
  },
  {
    id: 'heavy',
    test: /\b(hopeless|worthless|empty|numb|pointless|give up|giving up)\b/i,
    level: LEVEL.SUPPORT,
    replies: ['That is a heavy feeling to carry, and feelings like this can change. Please bring it to your crew medical officer or your next private conference. You can send a report from the Surgeon tab.'],
    activities: ['connect'],
  },
  {
    id: 'stress',
    test: /\b(stress\w*|overwhelm\w*|pressure|too much|workload|behind|deadline|swamped|burn(ed|t)? ?out)\b/i,
    level: LEVEL.SUPPORT,
    replies: [
      "That sounds like a lot to carry. Let's slow it down together with two minutes of breathing.",
      'One thing at a time. What is the next small step, and what can wait?',
    ],
    activities: ['breathing', 'grounding'],
  },
  {
    id: 'anxious',
    test: /\b(anxious|anxiety|worried|worry|worrying|nervous|scared|afraid|panic\w*|on edge|tense)\b/i,
    level: LEVEL.SUPPORT,
    replies: [
      "Thank you for telling me. Let's steady your breathing first, then name the worry.",
      'A worry is easier to carry once it has a name. What is it about most?',
    ],
    activities: ['grounding', 'breathing'],
  },
  {
    id: 'sleep',
    test: /\b(sleep\w*|slept|insomnia|awake|tired|exhausted|fatigue\w*|nightmares?)\b/i,
    level: LEVEL.SUPPORT,
    replies: [
      'Short sleep makes everything feel heavier. Dim the lights and try slow breathing before your next sleep period.',
      'If sleep stays short for three nights, tell your flight surgeon. A breathing exercise is here if you want one now.',
    ],
    activities: ['breathing'],
  },
  {
    id: 'lonely',
    test: /\b(lonely|alone|isolated|miss|missing|homesick|family|home|cut off|kids?|wife|husband|partner|mom|dad|friends?)\b/i,
    level: LEVEL.SUPPORT,
    replies: [
      'Missing people shows how much they matter. Would writing a short note home help right now?',
      'You are far away, and you are not forgotten. Could you share a meal with a crewmate today?',
    ],
    activities: ['message', 'connect'],
  },
  {
    id: 'low',
    test: /\b(sad|blue|unhappy|depressed|cry|crying|miserable|rough)\b|\b(feel|feeling|felt|been|am|i'?m) (so |really |very |a bit |pretty )?(down|low)\b/i,
    level: LEVEL.SUPPORT,
    replies: [
      "I'm sorry today feels heavy. You don't have to fix it right now. What is one small thing that usually helps?",
      'Thank you for saying it. If this feeling stays for days, raise it at your next private conference with the behavioral health team.',
    ],
    activities: ['move', 'plan'],
  },
  {
    id: 'anger',
    test: /\b(angry|anger|mad|furious|annoyed|irritated|frustrat\w*|argument|argued|fight|conflict|crewmates?|commander)\b/i,
    level: LEVEL.SUPPORT,
    replies: [
      'Friction is normal in a small crew. Take ten slow breaths before you answer anyone.',
      'It makes sense that it got to you. What happened, in one sentence?',
    ],
    activities: ['breathing', 'move'],
  },
  {
    id: 'bored',
    test: /\b(bored|boring|monoton\w*|nothing to do)\b/i,
    level: LEVEL.STEADY,
    replies: ['Long missions get repetitive. Plan one small thing to look forward to in the next three days.'],
    activities: ['plan'],
  },
  {
    id: 'thanks',
    test: /\b(thanks|thank you|appreciate)\b/i,
    level: LEVEL.STEADY,
    replies: ["Any time. I'm here whenever you want to talk."],
  },
  {
    id: 'greeting',
    test: /^\s*(hi|hello|hey|good (morning|afternoon|evening))\b/i,
    level: LEVEL.STEADY,
    replies: ['Hello. How are you doing right now?'],
  },
  {
    id: 'good',
    test: /\b(good|great|fine|okay|ok|better|happy|calm)\b/i,
    unlessNegated: true,
    level: LEVEL.STEADY,
    replies: ["Glad to hear it. A quick check-in would put it on record, if you want one.", "Good. I'm here if that changes."],
    checkin: true,
  },
];

const FALLBACK = [
  { text: "I'm listening. Tell me more." },
  { text: 'What part of that is weighing on you most?' },
  { text: 'How long has it felt like this?' },
  { text: 'A quick check-in would help me understand how you are doing.', checkin: true },
];

// What Astro says to one message. `history` is the earlier chat, used only to
// rotate through the fixed replies so Astro does not repeat itself at once.
export function chatReply(text, history = []) {
  const said = String(text || '').trim();
  if (isCrisisText(said)) {
    return { topic: 'crisis', level: LEVEL.HANDOFF, text: HANDOFF_TEXT, activities: [], checkin: false };
  }
  const topic = TOPICS.find((t) => t.test.test(said) && !(t.unlessNegated && NEGATED.test(said)));
  const seen = (id) => history.filter((m) => m.from === 'astro' && m.topic === id).length;
  if (!topic) {
    const pick = FALLBACK[seen('other') % FALLBACK.length];
    return { topic: 'other', level: LEVEL.STEADY, text: pick.text, activities: [], checkin: Boolean(pick.checkin) };
  }
  const turn = seen(topic.id);
  return {
    topic: topic.id,
    level: topic.level,
    text: topic.replies[turn % topic.replies.length],
    activities: topic.activities || [],
    checkin: Boolean(topic.checkin),
  };
}

// A typed answer to a check-in question: a whole number inside the scale, or null.
export function parseRating(text, step) {
  const m = String(text || '').trim().match(/^(\d{1,2})(?:\s*(?:\/|out of|of)\s*10)?$/i);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return n >= step.min && n <= step.max ? n : null;
}
