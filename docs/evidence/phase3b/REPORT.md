# Phase 3B — Simplified question bank and four-stage wrong training

Status: implemented and locally accepted; CI/Pages runs are linked from the completion message.

## Product changes
- Aufgabenbank landing renders filters, a matched count, start/resume action and two compact statistics sections. It never renders a question list. Four dimensions and module shortcuts derive from inventory/taxonomy/registry.
- Stable canonical filter keys resume independent TrainingRuns. Each run freezes question membership, question image/source/config, answer key, open solution and source revisions. Explicit restart uses the current pool without removing older runs or history.
- Training drafts/results are separate from ordinary LearningSession/ModuleProgress. Original question identity is preserved. Notes remain shared per original question; formal training attempts retain training_run_id.
- Fehlertraining has exactly four cards. Wrong/partial -> 1; formal correct -> 2 -> 3 -> mastered. Mastered remains historical. Dismissal hides only training state; a new wrong reactivates it. Test discard/delete withdraws its contribution.
- Classification editor is default-collapsed directly below notes. Human saves are locked/source-bound; stale snapshots cannot confirm current-source classifications. Routine machine suggestions and missing labels are not mandatory review items.
- Existing compact Modultest multi-select is unchanged.

## Verification
- 164 frontend/storage/model tests passed locally; 3 Firestore-emulator tests await CI environment (Firebase remains unconfigured in production).
- 136 Python pipeline regression tests passed using test fixtures; production PDF reads/renders: 0.
- Browser acceptance uses isolated temporary Chrome contexts, not the user's profile.
- Browser checks: four filters/no list, original source, reveal-only no attempt/progress, resume/reload/back/forward, draft persistence, notes/restart retention, classification edit/lock, wrong 1/2/3/mastered, reactivation/removal, partial U, desktop/mobile, compact multiyear selector.
- Additional browser checks: completed original exam discard/restore/delete contribution withdrawal; legacy recovered state -> stage3 and idempotent reload; old attempt note/error fields and legacy audit preserved.
- Dynamic source check: original 36-question run remains byte-identical after a mock source change/removal; same filter resumes old36; explicit restart creates current35. Stage start re-reads another tab's latest effective results.
- Backup tests validate user remapping, snapshots, linkage, atomic rejection and no large remote training envelopes. Training data remains local plus backup; hosted Firebase sync is not activated.

## Coverage and unchanged data
- 42 production modules / 1,332 original questions.
- Knowledge suggestions: 378; question-type suggestions: 1,043; partially/unclassified: 1,042, all included by default. Static classification exceptions: 0. This is not a claim that classifications are human-verified.
- Classification labels/source revisions/locks unchanged. Only routine review flags and coverage summary changed in public data.
- Question inventory, original question/answer/solution data, crops, source registry, manifests and nine historical source blockers unchanged.
- No original personal Attempts, QuestionNotes, ModuleRuns or TestSessions are rewritten by the wrong-state migration.

## Evidence
- browser/checks.json: main browser acceptance
- browser/migration-lifecycle.json: migration and test-result withdrawal
- browser/snapshot-dynamic.json: frozen membership/source and latest stage launch
- browser/all-pool.json: entire production pool snapshot validation
- protected-data.json: baseline comparison

Design: docs/superpowers/specs/2026-09-30-phase3b-design.md
Implementation plan: docs/superpowers/plans/2026-09-30-phase3b.md
