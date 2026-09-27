# Phase 2B.2 — Sommer 2017 Funktionsanalyse

## Scope and data

Only Sommer 2017 Funktionsanalyse is promoted. WiSo and Winter 2017/18 Arbeitsplanung remain Blocked. No Modultest, taxonomy, AI questions, or archive scan.

- 36 questions: Q1–Q28 and U1–U8. IDs and PNG bytes match the accepted Phase 2B.1 preview. Promotion reads saved metadata and copies PNGs; zero question-PDF pages are scanned.
- Q9 alone retains segmentation Needs Review. Other questions remain available for study.
- 28 official choice answers, each uniquely detected from physical solution page 1. Zero answer exceptions. The FA grid has independently validated geometry and low-contrast rings; AP page 2 geometry is not reused.
- Deterministic ring-density and angular-support checks agree at two threshold settings. Top-to-bottom rows map to answers 1–5. No question semantics, OCR answer inference, or LLM scoring.
- U1–U8 use official image crops from physical pages 5–7. Mixed-module page halves are explicitly bounded. 25 numbered subparts are recorded; all use user self-assessment. No numeric tolerance or scoring rubric is invented.

## Provenance and reproducibility

Question records retain source hash, PDF/page, bounding boxes, ordered owned regions, auxiliary text, crop, confidence, and review status. Answer records separately store the actual answer value and its source page/bbox/crop.

Independent promotion, answer, and U-solution manifests include source/config/version identity. Answer keys also bind the accepted question dataset hash. U checkpoints protect record metadata as well as images. Corrupted preview metadata, foreign question IDs, or corrupted U checkpoint metadata are rejected before cached outputs can be trusted.

## Learning and personal data

AP and FA use one reusable learning/review interface and a module registry. URLs include exam, module, and question; legacy AP links remain supported. Dashboard activity is filtered by stable question identity. Review stays an auxiliary mode.

IndexedDB schema remains version 4: no destructive migration is needed. Existing compound keys use user ID plus the full question ID, never the display label Q1. FA IDs and AP IDs are disjoint. Parsers write static files only; personal locked corrections remain in IndexedDB and overlay official answers.

## Validation

- 43 Python tests: row mapping, ambiguous circle rejection, accepted crop/identity/source coverage, cache integrity, completed-run no-PDF-open checks, and legacy regressions.
- AP: 130 saved artifact hashes verified unchanged before creating a canonical JSON baseline for portable CI. Question IDs, crops, official keys, and old manifests remain unchanged.
- Existing AP validators pass: 36 questions, 28 unique official answers, 8 U solutions.
- 13 frontend tests and production build pass. Real browser acceptance (no mocked data) verifies FA Q1 correct scoring/source, U1 three-part self-assessment, AP existing v4 answer/note unchanged, disjoint Q1 records, refresh/back/forward, and Review save/navigation guards.
- Legacy AP Phase 2A browser acceptance and delayed-save/Review-navigation regressions pass. Evidence: `docs/evidence/phase2b2/browser-acceptance.json` and `ap-regression/`.
- Independent code review passed after metadata/identity cache hardening.

## Inspect sources

- FA choice answer overlay: [detected rows and circles](../public/assets/answers/ea47a013956459b9cf4c907b/fa-2b.2.2-bd092bdba00b/answer-grid-overlay.png)
- Accepted 36-question preview: https://neroclaud2015.github.io/AP2/evidence/layout-profiles/fa-preview/
- Q15/Q16 accepted boundary: https://neroclaud2015.github.io/AP2/evidence/layout-profiles/fa-preview/q15-q16.html

The high-confidence label is a deterministic rule grade, not a calibrated statistical probability. Q9 remains available for review. U answers are not automatically graded.

## Production verification

The same no-mock browser acceptance passed at https://neroclaud2015.github.io/AP2/ after Pages deployment, including loaded MC/U source images, AP/FA record isolation, saved AP note, refresh/history and Review transitions. Evidence: `docs/evidence/phase2b2/live/browser-acceptance.json`. Browser checks wait for image decoding before asserting dimensions.
