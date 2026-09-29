# Phase 2J.1 — Persistent notes and Winter 2019/20 FA

## Result

- QuestionNote is independent of attempts and LearningSession drafts, keyed by userId + question_id. Explicit save shows Gespeichert. New attempts clear answers/reveal/unsure/hints/assessments only.
- IndexedDB v8 adds a store without rewriting old tables. Transactional migration prefers a nonempty current session note, otherwise the latest nonempty attempt; an existing QuestionNote (including empty text) wins. Old Attempt.note/error_reason remain historical snapshots.
- Why-wrong / Fehlerursache and Reflexion speichern removed from practice. Unsicher saves separately; new attempts use empty error_reason and snapshot the saved persistent note for compatibility.
- Active/paused Originalprüfung and Modultest do not mount the note editor. Submitted review can edit notes. Unsaved edits prevent navigation/deletion and warn before closing.
- Backup schema1 accepts optional questionNotes and old backups. Offline queue, explicit conflict handling, revision+content save comparison and owner-isolated Firebase entity/rules include notes. Firebase remains unconfigured; no real cloud acceptance claimed.

## FA official answer gate

User supplied the source-bound export at 2026-09-29T12:09:18.366Z. Q21 = **2**, confirmed, locked, manual_source_review. Source PDF SHA256 89cc6247493d8908e5043b95e5e2c1b3c05bf1b986e3df2f68f15754fa07f984; crop SHA256 464622f8f643c0bf196b06693cfef3f81223d9b9ed83542ba7d6a9d9d682c564. Original detector output and measurements unchanged. Separate reviewed answer artifact, immutable confirmation ledger and append-only Source Registry gates preserve provenance.

Winter2019/20 FA: **36 questions / MC28 of28 / U8 of8 / unresolved0**. Production registration includes learning, original exams and all/single/multiple-year module tests. Total production:16 modules /504 questions.

## Validation

- 112 frontend tests passed;104 Python tests passed; production build passed.
- 8 isolated browser checks: actual v7 migration, precedence/latest-nonempty policy, unchanged legacy attempts and error_reason, save/refresh/question/year/module/restart, repeated new attempts, original/module concealment and submitted editor, discard/delete preservation, confirmed FA Q21 answer/source.
- 6 additional FA production flows: MC, U/reload, Originalprüfung, all/single/multiple-year Modultest sources.
- Independent review identified internal review navigation and equal-version remote replacement edges; both fixed and covered.
- 34 previous source records exactly unchanged; only FA question/solution registration gates advanced. Existing question/crop/raw answer/U datasets unchanged.0 PDF opens/renders/rescans; repeat manual promotion idempotent.
- Firebase emulator security tests run in CI; real Firebase remains unconfigured.

Screenshots and machine-readable checks: evidence/phase2j1/. Browser tests use isolated synthetic personal data, never the user's real IndexedDB. No Sommer2020 or other ingestion. Stop for acceptance.
