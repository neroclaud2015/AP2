# Phase2G Implementation Plan

> For agentic workers: use superpowers:subagent-driven-development. User supplied complete scope and execution authorization; continue reversible implementation without repeated design approvals. Firebase project setup remains gated by user-provided public Web config. Main baseline verified e2755140e46d0982e8e1318ba729cca457c13399. Latest authoritative request is attachment bcb48edc-3983-4ba3-b171-14093ca52a25; supersedes canceled Supabase/pairing proposal.

Goal: polish existing UX/history/multi-year tests and deliver offline-first personal sync infrastructure; no PDF or source-registry edits.
Architecture: React/IndexedDB remains authoritative offline. FirebaseAuthProvider uses Google Sign-In; same Firebase uid owns the same Firestore data. FirestoreSyncProvider uses local durable envelopes and Firestore compare-and-swap transactions with stable IDs, explicit conflicts and deletion tombstones. Firestore Security Rules isolate users. Only VITE_FIREBASE_* public Web config is permitted; no Admin SDK, service account or server secret. No username/password or pairing codes. Missing Firebase configuration shows not configured and prevents real-cloud claims; local learning stays available.


## Independent tasks and ownership
- History worker: src/exams/model.ts, RecordLifecycle.tsx, new HistoryView.tsx/history.ts and tests. Restore from recorded previous_status/discarded_from; active restores as paused, time never runs invisibly. Reject restore into competing active session at repository integration. Archive abandoned/discarded. Dashboard limit5, history pages20, pure type/year/status filters. Parent integrates LearningApp.
- Firebase worker: FirebaseAuthProvider/Firestore transport, src/sync/protocol.ts, firebase.rules/config/tests/docs. Google browser auth only; UID-isolated rules, versioned CAS, stable IDs and tombstones. No backend project exists; real login/two-device cloud acceptance is deferred. SDK and emulators may be tested locally without cloud credentials. Document Console project, Google enablement, authorized domain, Firestore creation/rules, Web config and forbidden admin secrets.
- Sync worker: src/storage/, src/services/, src/types/index.ts, src/sync/ except protocol.ts, SyncSettings UI/tests. Additive IndexedDB migration, settings and durable metadata/outbox/tombstones. Local writes remain usable on failures. Bind explicit local-to-Firebase-UID transfer after summary; preserve stable IDs/provenance and local originals. User/device identities explicit; conflicts retain both; explicit resolution; snapshot backups support local-only vs sync. Use backend protocol agreed with worker. Parent integrates entry point and refresh events.
- Parent: LearningApp integration, sourceExams multi-select component, CSS tokens/320px layouts, route/history/settings entrypoints, browser evidence, production regression, docs/deployment.

## Checks
- Lifecycle: recorded restore target, stale revision, duplicate active prevention, completed eligibility, permanent deletion only selected test.
- History:120 synthetic sessions;20 initial+20/load; Dashboard max5; archive hidden by default; filters do not mutate.
- Multi-select: all/single/combination/empty; URL refresh/back/forward; immutable existing sessions; unavailable module/year combination cannot start.
- Sync: two isolated stores, stable IDs, offline/reconnect, concurrent edits, deletion vs editing, retry after remote-success/local-ack-failure, complete local migration, device disconnect keeps cloud. Test transport evidence explicitly separate from real hosted acceptance.
- Security: unauthenticated access and cross-UID reads/writes denied; Firestore rules schema/revision checks; no admin SDK or credentials.
- UI: MC Study/Original/Test at320/360/390, desktop spacing; screenshot before/after.
- Regression: all production sources, crops/answers/registry remain identical; no PDF scans.

## Ledger
Planning/read-only discovery complete. No Firebase configuration exists. User explicitly authorizes local implementation first, then STOP with Firebase Console setup instructions. Real Google login/cloud acceptance is blocked until public Web config is supplied. Canceled Supabase draft removed; no code from it deployed.


## Completion ledger

Local implementation completed. Application tests: 93 passed; three real-SDK emulator tests are intentionally skipped by ordinary npm test and passed separately with the emulator. Firestore Rules emulator: 5 passed. Existing Python unit tests: 93 passed. Production build passed. Browser acceptance covers all nine narrow MC viewports, history lifecycle/pagination, all/single/multi/empty years, route persistence, immutable old sessions and in-memory backup export/import. Final independent review found one malformed-backup model gap; complete TestSession validation and atomic rejection tests fixed it. Protected production/data/profile paths: 1,241 tracked files unchanged. No PDF ingestion was invoked.

Publication includes the unconfigured frontend and static acceptance evidence only. Firebase project creation, public Web config and actual Google/two-device hosted acceptance remain with the user. Stop after this publication.
