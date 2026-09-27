# Phase 2C — Original Exam and Module Test Framework

## Scope
Existing Sommer 2017 Arbeitsplanung and Funktionsanalyse only. No PDF scanning, ingestion, static question/answer changes, taxonomy, adaptive claims, or AI question generation. WiSo and Winter AP remain blocked.

## Session rules
Free practice keeps its existing attempts and drafts. Tests use a separate testSessions table in IndexedDB version 5. The additive upgrade preserves all records, reviews, answerReviews, attempts and learningSessions from version 4. Test answers never write ordinary attempts or review corrections.

Original exams require the complete unique configured paper, retain real order and start with blank answers. Submitted answers cannot be edited. Official answer keys and source references are captured with the session. Pending U assessments are ungraded, not wrong; blank questions are counted separately. Counts are practice feedback, not official weighted grades.

Kurztest: 6 MC + 2 U. Standardtest: 12 MC + 4 U. Selection uses deterministic seeds, rejects duplicates and avoids an entirely consecutive subset when alternatives exist. The source is explicitly Sommer 2017 only, not claimed cross-year or adaptive assembly.

One active/paused session per type, exam and module. Replacement is explicit and preserves the old attempt as abandoned. Both ordinary updates and replacement validate revisions transactionally, preventing stale tabs from overwriting newer work.

## Timing evidence
Both cached physical page 2 images clearly state 105 minutes for Teil A and Teil B together. See `docs/evidence/phase2c/timing-sources.json` and the two source excerpts. No PDF was opened or rescanned for this check. The timer continues across refresh/background until explicit pause; pauses are excluded. Reaching the official duration warns without automatic submission. Module tests show elapsed time only. Unknown official durations must be labelled unconfirmed.

## Validation ledger
- Model/storage test-first implementation; incomplete paper and stale replacement issues independently reviewed and fixed.
- Real v4 fixture migration preserves all five legacy tables exactly.
- Browser and final deployment checks recorded below after completion.

## Completed acceptance

- 25 frontend unit tests, 43 Python data regression tests, production build and diff checks pass.
- 19 real-data browser checks pass, including slow-storage beforeunload protection. Production preview passes the 18 checks applicable to a bundled build; delay injection is tested against the development module.
- AP and FA legacy study regression checks pass. Browser snapshots prove tests do not mutate attempts, learningSessions, reviews or answerReviews. Migration fixture additionally verifies all five legacy tables.
- Original AP and FA start with all 36 ordered questions and blank independent answers. Kurztest and Standardtest both submit and retain results/sources. U self-assessment remains user controlled.
- Independent review passed after fixes for incomplete papers, stale replacement confirmations, and pending-save refresh protection.
- Desktop result and mobile Dashboard screenshots inspected. No horizontal overflow at 390px.
- Saved evidence published at `public/evidence/phase2c/`; includes JSON, source-time excerpts, original result, module-test result and mobile Dashboard.

All static learning datasets and ingestion manifests remain unchanged. No other module processing was invoked.
