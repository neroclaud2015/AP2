# Phase 2I — Winter 2018/19 checkpoint

This batch stops at the official-answer safety gate. Historical import is **not complete**. No 2019 or later PDF was opened.

| Module | Status | Questions | Reliable MC answers | U solution crops | Needs Review |
|---|---|---:|---:|---:|---|
| Arbeitsplanung | Blocked; not in learning pool | 36/36 | 23/28 | 8/8 | Q3, Q9, Q10, Q22, Q24 |
| Funktionsanalyse | Blocked; not in learning pool | 36/36 | 25/28 | 8/8 | Q7, Q21, Q27 |
| WiSo | Production | 24/24 | 18/18 | 6/6 | 0 |

AP/FA have complete cached segmentation and U crops. Their low-confidence MC marks fail unique-circle/threshold-agreement checks. No thresholds were relaxed and no answer was filled from semantics. Source Registry marks both question/solution sources blocked; their data are absent from MODULES and test pools. Review source crops are published, but unavailable learning modules cannot be entered.

All three modules reuse the portrait-explicit-regions engine, with source-bound configurations version 2i.1.0. MC extraction reuses official-ring-grid deterministic geometry. This is a new source configuration, not a copied per-year parser. All 75 question pages and 16 shared solution pages were cached once (91 total). Shared solution PDF rendered once for three logical module sources. Existing PDFs were not read or rendered. Repeated layout/answer processing returns skipped, 0 PDF pages and 0 processed pages.

Explicit continuations: AP U1 pages15–16, U7 pages21–22; FA U5 pages22–23 and shared context only Q13–15; WiSo U3 pages8–9, U4 pages10–11. Attachments are present and mapped. Official timing: AP105, FA105, WiSo60 minutes from each question PDF page2. WiSo U1 and FA attachment29 preserve sideways source orientation. AP/FA solution annotations remain visible; no numeric rubric inferred.

WiSo is registered in existing Freies Lernen / Originalprüfung / Modultest / exam selection. All-years tests now include four available WiSo seasons. Single and multi-selection restrict sources correctly; existing TestSessions are immutable. No storage, sync, algorithms, source engines, or old modules were changed.

Browser acceptance uses isolated synthetic data: MC scoring and official crop, U2 self-assessment and refresh, original24-question order and pause/resume/submit, all/single/multi source mix, immutable prior session, mobile overflow, Firebase not configured. Evidence: docs/evidence/phase2i/browser/acceptance.json.

Production total: 8 modules / 240 questions. Sommer2018 AP/FA remain blocked for missing attachments. Twelve later archives remain pending. Resume from data/ingest/historical_expansion_manifest.json; do not rerender completed caches. AP/FA need a reviewed source/profile correction or explicit verified answer workflow before clearing their safety gate; never mutate bound accepted configuration silently.

Firebase remains implemented but not configured. No real login/cross-device acceptance performed. No taxonomy, mastery, adaptive plan, or AI generation.

Live evidence: https://neroclaud2015.github.io/AP2/evidence/phase2i/
WiSo: https://neroclaud2015.github.io/AP2/?view=study&exam=2018-19-winter&module=wiso&q=1

Validation: 93 frontend tests passed (3 emulator tests deferred to CI), 93 Python tests passed; production build passed with existing bundle-size warning. Source Registry8 production modules/24 sources valid. Legacy1261 data/profile files,18 source records,36 engine/storage/test-logic files unchanged. Independent read-only review found no P1/P2.
