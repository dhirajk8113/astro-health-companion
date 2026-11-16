# Use of AI in this project

This log records where and how AI tools were used, as the 2026 NASA Space Apps Project Submission Guide requires. The guide calls these tools Super Intelligence (SI).

**Tool used:** Claude (Anthropic), as a chat and coding assistant.

**Not used:** AI-generated photos or audio. No AI model runs inside the product; every message AeroNYX shows, and every reply Astro gives, is fixed wording chosen by a rule in the code.

**Names:** the project was first called Astro. On Nov 15 the team named the device AeroNYX and kept Astro as the name of the chat companion. Earlier rows of this log use the old name.

## Who did what

**The team's own work**

- Choosing the challenge.
- The concept: a monitor that takes results from minimally invasive samples (blood, urine) and from the mass measurement device, sends them to NASA flight surgeons, tracks prescribed medication and dosing, reports how readings move after a medication starts, and feeds that back to the providers.
- The idea of "Astro", a companion for stress, anxiety and loneliness with calming activities, and the decision to present Astro as one health companion for both physical and mental health.
- The boundary that the tool must not diagnose.
- The device: a hand sketch (Nov 15) of a unit with a screen, a sample submitter on one side, a medication dispenser on the other and attachment points on top. The team chose the "as sketched" design from three variants the assistant drew.
- The names: AeroNYX for the device, Astro for the chat companion.
- Astro as a calming companion to talk to about stress, with a mental health check-in inside the chat.
- The judgement that the first screens had too much text, and the choice of the gauge home screen from three looks the assistant drew.
- The judgement that the screens were still too wordy, and the choice of look A (gauges with icons and fewer words) from three more looks the assistant drew.
- Astro as a character that actually speaks to the crew, in one of three forms the team named: a character, a sprite or a speech bubble.
- A radiation warning bar on the Space screen that shows the level and warns when the dose reaches a hazardous limit, and a Space screen made of graphics instead of text.
- A badge scan and a PIN, so that health information stays private. The team's aim that the health information stay secure is why the stored record is encrypted.
- Showing the onboard kit as a plain list, removing the line about who chooses medications, and removing the per-screen demo notes.
- The direction for the video: a device that looks more like hardware, a specimen going into the sample port, the dispensed dose, the radiation alarm, a smaller AI mark, and the cuts needed to fit 30 seconds. The team chose the graphite finish from three the assistant rendered.

**What the AI assistant did**

- Recommended this challenge from the list of 14, based on the team member's background. The team member made the choice.
- Produced three background research reports with sources (in `docs/research/`): two on spaceflight health effects and one on which NASA and partner agency data fit Astro. Answered follow-up questions about health problems in spaceflight, radiation monitoring, bone loss, kidney stones and body mass measurement.
- Reviewed the team's concept against the challenge statement and suggested these refinements, which the team accepted:
  - showing each reading to the astronaut against a reference range and their own baseline, with a flag for when to contact the flight surgeon;
  - calling Astro a companion and adding a handoff to people for serious distress;
  - keeping all health guidance as fixed rules, with no generative model in the product;
  - treating the medication dispenser as simulated, and using periodic sample panels in place of continuous chemistry.
- Wrote all code, tests and styles in this repository.
- Chose the 13 indicators, the reference ranges and the example medication kit from the challenge statement, the research reports and standard clinical references. On Nov 14 the team directed that NASA's published values replace those ranges wherever NASA publishes one; the assistant found the NASA values and checked each against its NASA document.
- Wrote the on-screen wording, the README and this file.
- Wrote the simulated demo data generator.
- On Nov 15, from the team's sketch and feedback: drew three device variants and three home-screen looks on a design canvas for the team to choose from, then built the chosen device and home screen in code. The device and Astro's face are drawings made in code; no image file is used.
- Wrote Astro's scripted replies and the rules that pick them. The wording is the assistant's, so the team needs to read every reply in `js/lib/chat.js` before relying on it. The assistant advised against calling Astro a therapist; the app says it is a scripted companion, not a person or a therapist.
- Wrote first drafts of the project page text and the demo video script for the team to edit.
- At the team's direction ("build all the options" from the research report), built the real NASA data features: live DONKI space weather with a replay of the May 2024 storm, ISS dose measurements from RadLab, the live ISS cabin panel, the computed Mars signal delay, the Inspiration4 crew ranges and the NASA medical kit list. The assistant retrieved the data, wrote the code and chose how each is shown.
- Produced the 30-second demo video at the team's request by filming the real app with a script (`tools/film-demo.py`). The video shows an "AI-generated video" watermark on every frame, and its subtitles are the assistant's wording.

## Log

Times are US Central.

| When | What the AI produced | Where it is used | How it is marked |
| --- | --- | --- | --- |
| Nov 11 to 13 | Reading of the event rules and help setting up accounts | Not in the project | Not applicable |
| Nov 14, 10:35 to 11:10 | Two research reports on spaceflight health effects | `docs/research/` | Disclosure line at the top of each file |
| Nov 14, 12:15 to 13:00 | Answers on health problems, radiation checks, bone loss, kidney stones, mass measurement | Background for indicator choices | This log |
| Nov 14, 13:03 to 13:20 | Review of the team's concept and suggested refinements | Product design | This log and the About screen |
| Nov 14, from 13:20 | All code, tests, styles, wording and simulated demo data | Whole repository | Disclosure comment at the top of every source file; About screen; README |
| Nov 14, 14:45 to 15:05 | Check of every screen on the live site in a browser, and fixes for five defects it found (phone layout, wording, demo clock times, adherence on a new prescription) | `css/styles.css`, `js/`, `tests/` | Pull request 4; this log |
| Nov 14, 15:20 to 15:30 | First drafts of the project page fields and the 30-second video script | Project page and demo video, after the team's edits | The SI field on the project page; this log |
| Nov 14, 15:20 to 16:15 | Research report on which NASA and partner agency data fit Astro, with a browser check of which sources a static page can read | `docs/research/` | Disclosure line at the top of the file |
| Nov 14, 16:25 to 16:35 | At the team's direction, replaced the assistant's thresholds with NASA's published values, after checking each number against its NASA document | `js/data/indicators.js`, the About screen, the README | A source label on every limit; this log |
| Nov 14, 16:35 to 16:50 | The 30-second demo video, filmed from the real app by a script, with subtitles | The project demo link | An "AI-generated video" watermark on every frame; the SI field on the project page; this log |
| Nov 14, 19:17 to 19:40 | Real NASA data features: retrieved and saved the data, wrote the code and the tests | `js/data/nasa-snapshots.js`, `js/lib/spaceweather.js`, `js/lib/isslive.js`, `js/lib/ephemeris.js`, the Environment screen | Disclosure comment in each file; source and retrieval date beside each dataset; this log |
| Nov 14, 19:40 to 20:05 | Checked the new features on the live site and fixed two labels; re-filmed the demo video with the Environment screen | `js/lib/isslive.js`, `js/views.js`, `tools/film-demo.py`, the project demo link | An "AI-generated video" watermark on every frame; an on-screen note on the recorded cabin values; this log |
| Nov 15, 08:10 to 09:00 | From the team's sketch: three device designs and three home-screen looks for the team to pick from; then the chosen device (AeroNYX), the gauge home screen, the bottom tab bar, the rename, and Astro as a scripted chat companion with a check-in | `index.html`, `css/styles.css`, `js/views.js`, `js/app.js`, `js/device.js`, `js/lib/gauge.js`, `js/lib/chat.js`, `js/lib/device.js`, `tests/astro.test.mjs` | A line on the device saying it is a concept drawn with AI; a line under the chat saying Astro is scripted; disclosure comment in each file; this log |
| Nov 15, 09:00 to 09:10 | Re-filmed the 30-second demo video inside the AeroNYX device, with the gauge home screen, a dispensed dose and the Astro chat | `tools/film-demo.py`, the project demo link | An "AI-generated video" watermark on every frame; on-screen notes that the device is a concept and that the cabin values are a recording; this log |
| Nov 15, 09:15 to 09:25 | At the team's direction, changed the spelling of the device name to AeroNYX everywhere it is shown, and filmed the video again | The app, the README, `tools/film-demo.py`, the project demo link | As above |
| Nov 15, 11:55 to 12:05 | After an audit against the five judging criteria, at the team's direction to close every gap: widened Astro's crisis word list and added a handoff for threats to others; a NASA tag and live space weather on the home screen; a simulated sample run for the sample submitter; a demo tour; long explanations moved behind "More"; tables and the readings list fixed for phones | `js/lib/checkin.js`, `js/lib/chat.js`, `js/lib/sample.js`, `js/views.js`, `js/app.js`, `css/styles.css`, `tests/astro.test.mjs` | The sample screen says the analysis is simulated; disclosure comment in each file; this log |
| Nov 15, 12:05 to 12:15 | Re-filmed the demo video with a sample-run scene, published it on the site, and added four screenshots and two sections (one case, feasibility) to the README | `tools/film-demo.py`, `media/`, `README.md`, the project demo link | An "AI-generated video" watermark on every frame; on-screen notes for the concept device, the simulated analysis and the recorded cabin values; a line under the screenshots; this log |
| Nov 15, 15:35 to 16:00 | At the team's direction: look A on the home screen (an icon per reading, counts as symbols); the Space screen redrawn as graphics with a radiation bar against NASA's 600 mSv career limit that turns red at the limit; Astro as a speaking character with three looks, written-out replies and the tablet's own voice; a badge scan and PIN lock; the onboard kit as a plain list; per-screen demo notes removed | `js/views.js`, `js/app.js`, `js/voice.js`, `js/lib/icons.js`, `js/lib/persona.js`, `js/lib/lock.js`, `css/styles.css`, `index.html`, `tests/` | Disclosure comment in each file; "Drawn with AI" under Astro's character and sprite; "Concept device, drawn with AI" on the device; the "Demo data" label in the header; the About screen |
| Nov 15, 16:00 to 16:15 | At the team's direction, a more detailed drawing of the concept device for the video in three finishes (graphite, aluminium, white), with a specimen tube that goes into the sample port and a capsule that drops into the cup; new scenes for the badge and PIN, the radiation alarm and Astro speaking; the README pictures retaken | `tools/film-device.js`, `tools/film-demo.py`, `media/` | "AI-generated video · concept device" in the corner of every frame; the end card; this file |
| Nov 15, 20:25 to 20:35 | After the team asked what else would improve the project: the device on the live site redrawn in the graphite finish the team chose for the video, with the specimen tube going into the port on a sample run and the capsule dropping on a dispensed dose; an updated first draft of the detailed description field, written from the facts of the app, for the team to rewrite | `js/skin.js`, `css/styles.css`, `js/app.js`, `tests/`, the project page | "Concept device, drawn with AI" on the device; the AI field on the project page; this file |
| Nov 15, 20:35 to 20:40 | Encryption of the stored health record: once a PIN is set the record is written only as AES-GCM ciphertext under a key stretched from the PIN, and is opened after the PIN is entered; an older unencrypted record is encrypted on the next unlock | `js/lib/vault.js`, `js/lib/store.js`, `js/app.js`, `js/views.js`, `tests/` | Disclosure comment in each file; the About screen says what the encryption does and does not protect against |
| Nov 15, 20:40 to 20:45 | After the team said Astro's built-in voice sounded robotic: the tablet's own voice slowed and set to prefer a device's better voices, and the app made ready to play recorded lines instead (none recorded yet) | `js/voice.js`, `js/lib/persona.js`, `js/data/voice-lines.js`, `tools/voice-lines.mjs`, `tools/build-voice.py`, `tests/` | Disclosure comment in each file; this file |

## How AI output is marked in the project

- Every source file starts with an AI disclosure comment.
- The About screen and the page footer state that the code was written with an AI assistant.
- Simulated data is labelled by a "Demo data" label in the header of every screen, and by "SIMULATED DATA" in the report sent to the flight surgeon. The team asked for the notes that repeated this on each screen to be removed; the About screen keeps the full account of what is real and what is simulated.
- The concept device carries the line "Concept device, drawn with AI". The About screen says that no hardware exists.
- Astro's character and sprite carry the line "Drawn with AI". The bubble look has no drawing.
- Astro's voice is the browser's built-in speech, limited to voices that run on the device. It is not an AI model and sends nothing anywhere.
- The badge scan is simulated; the About screen says so. It also says what the encryption of the stored record does and does not protect against.
- The Astro screen says that Astro is a scripted companion, not a person or a therapist.
- The demo video shows "AI-generated video · concept device" in the bottom-left corner of every frame. The team asked for the mark to be removed; it was made smaller and moved instead, because the challenge rules require it. The end card says that no hardware exists, that the readings are simulated except the radiation dose, and that the code and video were made with AI assistance.
- The device is drawn in detail in the video (`tools/film-device.js`) and, on a wide window, on the live site (`js/skin.js`). It is the concept from the team's sketch and is a drawing: the specimen tube, the analyser readout and the capsule are animation, not hardware. The line "Concept device, drawn with AI" stays on its lower edge.
- In the radiation scene the dose climbing to the limit is a time-lapse drawn over the real bar. The red alarm that follows is the real screen after a test dosimeter reading of 612 mSv is saved. The subtitle says "if".
- The machine that renders the video has no internet access. The space weather card in the video and in the README picture therefore replays the records NASA DONKI returned on the deployed site at 22:03 UTC on 15 Nov 2026. The video no longer shows the ISS cabin readings.
- The pictures in the README are of the running app, taken by a script, with the same replayed space weather records.
