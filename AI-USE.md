# Use of AI in this project

This log records where and how AI tools were used, as the 2026 NASA Space Apps Project Submission Guide requires. The guide calls these tools Super Intelligence (SI).

**Tool used:** Claude (Anthropic), as a chat and coding assistant.

**Not used:** AI-generated images or audio. No AI model runs inside the product; every message Astro shows comes from a fixed rule in the code.

## Who did what

**The team's own work**

- Choosing the challenge.
- The concept: a monitor that takes results from minimally invasive samples (blood, urine) and from the mass measurement device, sends them to NASA flight surgeons, tracks prescribed medication and dosing, reports how readings move after a medication starts, and feeds that back to the providers.
- The idea of "Astro", a companion for stress, anxiety and loneliness with calming activities, and the decision to present Astro as one health companion for both physical and mental health.
- The boundary that the tool must not diagnose.

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

## How AI output is marked in the project

- Every source file starts with an AI disclosure comment.
- The About screen and the page footer state that the code was written with an AI assistant.
- Simulated data is labelled on every screen that shows it.
- The demo video shows "AI-generated video" on every frame and says in its last subtitle that the readings are simulated and the code was written with AI.
