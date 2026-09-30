# Aufgabenbank summary card and second overnight review export

## Result
- Tasks available: 1,368 (previously 1,332), 43 production modules.
- Summary card: white background, 16px radius, light border/shadow, larger heading, 52px CTA; desktop horizontal/mobile stacked. CSS-only card change.
- Stable count/filter/Training Key/TrainingRun/resume semantics unchanged. Four screenshots capture desktop/mobile, start/resume.

## User review decisions
- Sommer 2024 FA: production, 36 questions / 28 locked or ready MC / 8 U solution crops. Two attachment sheets belong to U3 only; Q25 association removed through an audited publication overlay. Original config/hold retained.
- Winter 2024/25 FA: attachment review resolved: pages 23/24 -> U2, pages 25/26 excluded. New processing revision preserves blocked source evidence. Formal 36 questions / 8 U solutions. MC 11/28 auto-ready; 17 require source review: Q1–6, Q10–11, Q14–20, Q22–23. Not production.
- Sommer 2018 AP: user permits missing Stückliste sheet with explicit notices on U6/U7. Acceptance recorded. Existing preview is complete, but formal records and AP answer extraction still need preparation; not production.
- Sommer 2018 FA: same permission, notices must cover U1/U2/U3. Layout/answer profiles are incomplete; not production.
- Sommer 2023 FA: user accepts original handwritten answers on U7/U8. Acceptance recorded; no formal question/answer records yet; not production.
- Sommer 2023 WiSo: user explicitly defers absent original source. Remains unavailable.
- Sommer 2025: awaiting optional source archive from user. No fabricated data.

Answered mapping/source requests removed from active queue; immutable export and prior queue retained. Active queue has 17 newly extracted MC answer reviews plus 3 missing Sommer 2025 source items.

## Verification
- 168 frontend tests passed; 3 emulator tests skipped locally (CI runs emulator checks).
- 143 Python tests passed.
- Source registry validates 43 production modules.
- Existing 96 source records retain all prior events and gates. All 1,332 old inventory records and classifications unchanged.
- Desktop/mobile isolated browser checks pass; actual start/resume retains identical run ID, filter key and question snapshot. No user browser storage accessed.
- Sommer 2024 FA Q25/U3 links and solution rendering verified. Winter answer-review source crop hash verified and no answer preselected.
- Original PDFs: 63 source files, 1,368 question links; new module included. PDF rescans/rendering: 0. New crops use existing caches.

## Links
- Aufgabenbank: https://neroclaud2015.github.io/AP2/?view=bank
- New module: https://neroclaud2015.github.io/AP2/?view=study&exam=2024-sommer&module=funktionsanalyse&q=1
- New review: https://neroclaud2015.github.io/AP2/?view=answer-review&scope=winter-2024-25-fa-mapping-v2
- Evidence: https://neroclaud2015.github.io/AP2/evidence/bank-summary/
