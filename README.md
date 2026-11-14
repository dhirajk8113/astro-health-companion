# Astro: a health companion for astronauts

Astro helps an astronaut on a long mission keep track of their own health. It gathers readings, shows each one against a reference range and the crew member's own preflight baseline, tracks prescribed medication, offers support on hard days, and keeps the flight surgeon informed.

Built for the 2026 NASA Space Apps Challenge: **Create Health Monitoring Software for Astronauts on Space Missions**.

**Live demo:** https://dhirajk8113.github.io/astro-health-companion/ (press **Load simulated demo data** on the first screen)

> Astro is a companion, not a doctor or a therapist. It does not diagnose or treat. All readings in the demo are simulated.

## What it does

| Screen | What the crew member can do |
| --- | --- |
| Today | See every indicator at a glance, colour-coded and labelled, with the readings that need a look listed first and a plain instruction for each. |
| Readings | Log a reading, see it against the reference range and their own baseline, follow the trend on a chart, and read how to take the measurement and why it matters in space. |
| Medications | See what the flight surgeon prescribed from the onboard kit, record each dose (the dispenser is simulated), follow adherence, and see how the linked reading has moved since the medication started. |
| Check-in | Rate mood, stress and loneliness, get a short activity to try, and be handed off to people when the ratings or the words call for it. |
| Flight surgeon | Send a structured report to the ground and receive replies and prescriptions, with the signal delay for the chosen mission (ISS, Moon or Mars). |
| Setup | Enter preflight baselines, choose the mission, and load or clear the simulated demo data. |

Astro follows 13 indicators: resting heart rate, blood pressure, body temperature, body mass (from the mass measurement device), aerobic capacity, fasting glucose, vitamin D, blood potassium, urine volume, urinary calcium, mission radiation dose, sleep and mood.

## Boundaries

- Astro shows readings and tells the crew member when to involve a person. The flight surgeon makes the medical decisions.
- Astro never chooses a medication or a dose.
- Everything Astro says comes from a fixed rule in the code. There is no AI model inside the product, so it keeps working with no link to Earth.
- What a crew member types into a check-in is used once for a safety check and then dropped. Only the three ratings are stored and reported.
- Everything is stored in the browser on the device. Nothing is uploaded.

## NASA data and resources used

Astro is organised around NASA's Human Research Program framework. Each indicator is tied to one of the five hazards of human spaceflight, and each screen links to the NASA source behind it.

- [NASA Human Research Program: 5 Hazards of Human Spaceflight](https://www.nasa.gov/hrp/hazards/)
- [NASA Human Research Program: Human Health and Performance Risks](https://www.nasa.gov/hrp/risks/)
- [NASA Human Research Program: Ongoing Research](https://www.nasa.gov/hrp/ongoing-hrp-research/)
- [NASA-STD-3001 Volume 1, Revision C: Crew Health](https://standards.nasa.gov/sites/default/files/standards/NASA/C//nasa-std-3001-vol-1-rev-c-signature.pdf), for the in-mission aerobic capacity limit of 80 percent of the pre-mission value
- NASA Office of the Chief Health and Medical Officer technical briefs: [Exercise](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-031-exercise-overview.pdf), [Orthostatic Intolerance](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-019-orthostatic-intolerance.pdf), [Food and Nutrition](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-013-food-and-nutrition.pdf), [Behavioral Health](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-016-behavioral-health.pdf), [Radiation Protection](https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf), [Urinary Health](https://www.nasa.gov/ochmo-mtb-003-urinary-health-2/)
- [NASA: Risk of Renal Stone Formation](https://www.nasa.gov/directorates/esdmd/hhp/risk-of-renal-stone-formation/) and [Risk of Spaceflight-Induced Bone Changes](https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/)
- [NASA Space Radiation Analysis Group](https://srag.jsc.nasa.gov/SpaceRadiation/How/How.cfm), for how dose is monitored and the 600 mSv career limit
- [NASA evidence report on sleep loss](https://ntrs.nasa.gov/api/citations/20160003864/downloads/20160003864.pdf)

## Space agency partner and other resources

- Canadian Space Agency: [Bio-Analyzer](https://asc-csa.gc.ca/eng/iss/bio-analyzer.asp), [Vascular studies](https://www.asc-csa.gc.ca/eng/sciences/vascular.asp), [Monitoring radiation for astronaut health](https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp)
- German Aerospace Center (DLR): [core body temperature in astronauts](https://elib.dlr.de/116228)
- [Zwart et al. 2014, body mass changes during long-duration spaceflight](https://www.ncbi.nlm.nih.gov/pubmed/25197887)
- [Jones et al. 2022, sleep, stress and performance on the ISS](https://pmc.ncbi.nlm.nih.gov/articles/PMC8919197)

The two background research reports in `docs/research/` list every source consulted.

## What is real and what is simulated

- **Simulated:** every reading, prescription and check-in in the demo data; the medication dispenser; the flight surgeon console; the signal delay (Mars is compressed from 20 minutes to 20 seconds so a demo does not stall).
- **From published sources:** why each indicator matters in space, the NASA limits quoted, and how each measurement is taken.
- **Standard clinical values:** most reference ranges. NASA publishes numeric in-mission limits for only a few indicators, so the ranges here are standard adult values used on Earth, labelled as such on every screen. A flight surgeon would set the real limits for each crew member.
- **Not included:** stool analysis, which has no in-flight analyzer today.

## Run it

Astro is a static site with no build step and no dependencies.

```
python3 -m http.server 8000
```

Then open `http://localhost:8000`. On the Today screen press **Load simulated demo data**.

Run the tests with Node 20 or later:

```
npm test
```

## Layout

```
index.html            page shell
css/styles.css        styles, light and dark
js/app.js             events and storage wiring
js/views.js           screens
js/lib/assess.js      status rules, trends, adherence, report
js/lib/checkin.js     check-in rules and handoff
js/lib/chart.js       SVG chart
js/lib/store.js       browser storage
js/data/              indicators, example kit, simulated demo data
tests/                logic and screen tests
docs/research/        background research reports
AI-USE.md             log of where and how AI was used
```

## Use of AI

The concept is the team's own. The code, tests, on-screen wording and background research were produced with an AI assistant (Claude) and reviewed by the team. No AI-generated images, audio or video are used, and no AI model runs inside the product. Every source file carries a disclosure comment, and `AI-USE.md` has the full log.

## License

Apache License 2.0. See `LICENSE`.
