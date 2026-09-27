# Phase 2C Implementation Plan

## Approved scope
User specification: existing Sommer 2017 AP/FA only; separate Freies Lernen, Originalpruefung, Modultest. No PDF scan or static data changes; WiSo/Winter remain blocked. Publish and verify production.

## Design
Independent testSessions table added at IndexedDB logical v5, preserving all v1-v4 tables. Sessions snapshot ordered question identities, kind/subparts, source and MC keys. No ordinary practice attempts are written by tests. Original exams include 36 questions in registered part order. Module tests use seeded shuffle, no duplicates, Kurz 6 MC + 2 U, Standard 12 MC + 4 U. Results are counts, not claimed official weighted marks. U answered but unassessed remains pending/vorlaeufig; blank U stays unanswered, never marked wrong.

Timer: official AP and FA page2 cached images visually confirm 105 minutes combined A+B. Store provenance in module config. Original exams use 105-minute advisory deadline; tests have elapsed timer only. Active time continues through refresh/background until explicit pause. Timeout only warns.

Session state transitions are transactional with optimistic revisions to reject stale tabs. One active/paused session per type/exam/module. Explicit replace abandons prior session atomically, never deletes it. Submitted answers and key snapshots immutable; U assessments remain editable. Session URL carries test ID; route question updates are persisted with guards.

## Tasks / interfaces
- [x] Model/storage: src/exams/model.ts, model.test.ts; storage/storage.ts adds v5 and createTestSession/getTestSessions/getTestSession/updateTestSession. Pure model defines createSession, reduceSession, sessionResult, elapsedMs. No existing data mutation.
- [x] UI: src/exams/ExamWorkspace.tsx plus navigation/dashboard integration. Session UI consumes typed repository actions; original questions/crops and official sources only revealed after submit. Config.parts remain data driven. Free U assessment controls only after solution reveal.
- [x] Acceptance: unit transitions/timing/seed/partial results, real v4-to-v5 storage migration preservation, concurrency conflicts; browser pause/reload/resume/submit/U assessment/MC results/seed tests/history/data isolation; legacy regression.
- [ ] Review, commit main, CI/Pages, live browser acceptance and report.

## Ownership
Parent implements model/storage + unit tests + timing evidence. UI implementer edits LearningApp/modules/Practice and new ExamWorkspace/CSS only, then real browser script. Reviewer read-only.

## API contract
TestType='original'|'module'; TestMode='kurz'|'standard'. TestSession includes test_id, exam_session_id, userId, test_type, exam, module, mode, seed, question_ids, question_models, source_mix, answers, subpart_assessments, official_answers, started_at, completed_at, status, current_question, elapsed_time, active_since, revision, duration_minutes, result.
createSession({type,config,exam,officialAnswers,solutions,mode?,seed?,now?}):TestSession.
reduceSession(session,action,now?):TestSession. Actions: answer {questionId,answer:Record<string,string>}; move {questionId}; pause; resume; submit; abandon; assess {questionId,assessments:Record<string,Correctness>}.
sessionResult(session): {total,beantwortet,richtig,falsch,teilweise,unbeantwortet,pending,vorlaeufig,byQuestion:Record<string,Correctness|'unbeantwortet'|'pending'>}.
elapsedMs(session,now?):number.
Repository: createTestSession(session,replace?:{id,revision}):Promise<TestSession>; getTestSessions(userId):Promise<TestSession[]>; getTestSession(userId,id):Promise<TestSession|undefined>; updateTestSession(userId,id,revision,action):Promise<TestSession>. Revision mismatch throws; UI reloads state and does not overwrite.

Review fixes: reject incomplete/duplicate original paper numbering; replacement also requires confirmed prior revision inside transaction.

Model/storage review completed: both findings fixed and re-reviewed without blockers; 11 model/storage tests pass. Timing source crops saved without scanning PDFs.
