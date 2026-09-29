# Phase 2J.2 — Module progress and learning rounds

## Delivered

Permanent QuestionNotes, immutable attempt snapshots and explicit current ModuleProgress are separate. ModuleProgress is keyed by user/exam/module; ModuleRun has a unique run_id and generation. Each question contributes one current result (correct/incorrect/partial/unanswered). Rate = correct/completed; empty modules show –.

Free learning shows a compact progress card, current result icons, first-unanswered continuation (then incorrect/partial; all-correct returns Q1), Aufgabe erneut versuchen, and confirmed Modul neu starten. Reset clears only this module's current states/drafts/reveal/binding/hints/unsure; notes, attempts, review corrections, sources and test sessions remain. A saved note survives every round.

Each historical free-learning attempt has confirmed Versuch löschen. Deleting a current source falls back only to the latest valid attempt in the same run; older runs never revive. Test-associated attempt records are excluded and repository deletion rejects them.

## Migration / concurrency / persistence

IndexedDB v9 adds moduleProgress and moduleRuns without rewriting old attempts/notes. The first migration captures legacy eligible attempt IDs and latest valid completed results in generation1. It is idempotent. New attempts receive run_id/generation/order. Existing legacy records retain their exact bytes/fields. A stale-tab draft or submission is rejected after reset.

Reset and submit are transactional. Concurrent reset generations never decrease through incoming sync, conflict resolution or Firestore policy. Immutable run metadata is retained. Firebase remains implemented but not configured; no real cloud acceptance.

Backup schema1 accepts optional moduleProgress/moduleRuns. Imports validate current run and source attempt associations atomically. Old backup attempts cannot revive progress after reset. Tests and exams remain fully separate.

## Validation

- 120 frontend tests pass; production build passes.
- All16 user browser scenarios pass in an isolated persistent browser: new0/N; Q1correct; Q2wrong→correct counted once; history2; save note; confirmed reset; allstates0; notes/history survive; Q3newrun without old Q1/Q2; deletion same-run fallback; exam/test isolation; UI backup export/import; refresh and real browser restart.
- Real v8→v9 IndexedDB browser migration: latest valid result, newer invalid attempt ignored, test-linked attempts excluded, existing notes and attempts unchanged, reload idempotent.
- 360px browser layout has no horizontal overflow.
- Independent review: reset rollback conflict and linked-test deletion findings fixed;20 focused tests independently re-run successfully.
- Zero question/answer/crop/Source Registry/ingestion manifest changes; zero PDF reads or new seasons. No real user database was touched by acceptance scripts.

Evidence: docs/evidence/phase2j2. Stop before Sommer2020, Firebase activation, taxonomy/mastery/adaptive learning. CI/Pages and live acceptance are verified after deployment and linked in the delivery message.
