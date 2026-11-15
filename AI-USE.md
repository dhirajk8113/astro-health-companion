# Use of AI in this project

This log records where and how AI tools were used, as the 2026 NASA Space Apps Project Submission Guide requires. The guide calls these tools Super Intelligence (SI).

**Tool used:** Claude (Anthropic), as a chat and coding assistant.

**Not used:** AI-generated photos or audio. No AI model runs inside the product; every message Aeronyx shows, and every reply Astro gives, is fixed wording chosen by a rule in the code.

**Names:** the project was first called Astro. On Nov 15 the team named the device Aeronyx and kept Astro as the name of the chat companion. Earlier rows of this log use the old name.

## Who did what

**The team's own work**

- Choosing the challenge.
- The concept: a monitor that takes results from minimally invasive samples (blood, urine) and from the mass measurement device, sends them to NASA flight surgeons, tracks prescribed medication and dosing, reports how readings move after a medication starts, and feeds that back to the providers.
- The idea of "Astro", a companion for stress, anxiety and loneliness with calming activities, and the decision to present Astro as one health companion for both physical and mental health.
- The boundary that the tool must not diagnose.
- The device: a hand sketch (Nov 15) of a unit with a screen, a sample submitter on one side, a medication dispenser on the other and attachment points on top. The team chose the "as sketched" design from three variants the assistant drew.
- The names: Aeronyx for the device, Astro for the chat companion.
- Astro as a calming companion to talk to about stress, with a mental health check-in inside the chat.
- The judgement that the first screens had too much text, and the choice of the gauge home screen from three looks the assistant drew.

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
| Nov 15, 08:10 to 09:10 | From the team's sketch: three device designs and three home-screen looks for the team to pick from; then the chosen device (Aeronyx), the gauge home screen, the bottom tab bar, the rename, and Astro as a scripted chat companion with a check-in | `index.html`, `css/styles.css`, `js/views.js`, `js/app.js`, `js/device.js`, `js/lib/gauge.js`, `js/lib/chat.js`, `js/lib/device.js`, `tests/astro.test.mjs` | A line on the device saying it is a concept drawn with AI; a line under the chat saying Astro is scripted; disclosure comment in each file; this log |
| Nov 15, 09:10 to 09:45 | Re-filmed the 30-second demo video inside the Aeronyx device, with the gauge home screen, a dispensed dose and the Astro chat | `tools/film-demo.py`, the project demo link | An "AI-generated video" watermark on every frame; on-screen notes that the device is a concept and that the cabin values are a recording; this log |

## How AI output is marked in the project

- Every source file starts with an AI disclosure comment.
- The About screen and the page footer state that the code was written with an AI assistant.
- Simulated data is labelled on every screen: a "Demo data" label sits in the header of every screen, and the screens with tables repeat it in a line.
- The concept device carries the line "Concept device, drawn with AI from the team's sketch. No hardware exists."
- The Astro screen says that Astro is a scripted companion, not a person or a therapist.
- The demo video shows "AI-generated video" on every frame, and says in its last subtitle that the readings are simulated, that the device is a concept and that the code was written with AI.
- The machine that renders the video has no internet access. The space weather shot therefore uses the app's own replay of the saved May 2024 storm, which the screen states. The ISS cabin shot shows values recorded from NASA's live feed on the deployed site on 14 Nov 2026, and the video says so on screen during that shot.
