# Phase 3C — Persistent uncertainty

Approved task scope: additive persistent question uncertainty and an independent training collection. No source ingestion, Firebase activation, adaptive weighting or changes to existing progress semantics.

## State and history
QuestionUncertaintyState is keyed by userId + question_id, with active, entered_at, updated_at, revision and optional last_result_id. Only explicit user toggle changes an existing state. Resets, incorrect results, solution viewing and test discard do not clear it. Optimistic revision checking prevents stale tabs overwriting a newer toggle. Existing Attempt.unsure/confidence are immutable snapshots; new attempts read the current saved state at submission. Notes and progress remain independent.

Migration creates only missing states from the latest valid formal Attempt (deterministic timestamp/ID ordering). Invalid/discarded/deleted test results are excluded. Existing states, including inactive ones, always win. Migration never rewrites Attempts, WrongQuestionState, Notes or ModuleProgress. Additive IndexedDB upgrade and optional backup section preserve old exports. State remains local; no Firebase scope expansion.

## Eligibility
Use one function: active uncertainty AND no active wrong stage 1/2/3. This follows requirement K, includes a never-answered manually marked question, and permits mastered/dismissed wrong history. Uncertainty never drives the wrong-stage reducer. Valid wrong/partial attempts continue to drive stages normally; test result withdrawal remains respected.

## UI and training
Shared always-editable checkbox below answer actions and above solutions: Diese Aufgabe ist mir unsicher. Storage load/write errors and actual busy operations may disable temporarily; submitted/revealed/correctness do not. Exam/test active mode never renders the historical state, while submitted review renders the same component.

Fehlertraining retains four stage cards and adds a separate Unsicher section. Launch captures current eligible question IDs and immutable source snapshots in TrainingRun kind uncertainty. It never writes bank TrainingProgress. During the run toggles cannot change question order; re-entering from the collection or restarting creates a fresh snapshot. Refresh uses run ID to restore the same snapshot. Reuse Practice for answers, solution, note, classification and retry.

## Verification
Model/storage tests cover active false/true, idempotent latest-valid migration, snapshot immutability, wrong-stage dedup, mastery, reset isolation, backup, and fixed run membership. Isolated browser acceptance covers pre/post submission, reveal, reload, question/run/module resets, active exam hiding and review editing, notes, desktop/mobile and screenshot evidence. No real personal browser data is used. Deploy only after checks; stop after Phase 3C.

Self-review: additive state only; no destructive migration or history rewrite; no conflict with existing ModuleProgress/TestSession semantics. User authorization to proceed without further approval retained.
