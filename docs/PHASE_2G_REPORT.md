# Phase 2G — UX, history, multi-year selection and Firebase preparation

Baseline: e2755140e46d0982e8e1318ba729cca457c13399 (accepted Phase 2F main).

## Delivered scope

- Shared spacing tokens; 32px cards/history separation. MC choices use wrapping responsive grids with 20px radio controls and at least 44px targets.
- Default history excludes abandoned/discarded. Archive is collapsed. Restore preserves previous status; active restores paused; stale revisions and competing open sessions are rejected. Permanent deletion preserves ordinary learning attempts and other sessions.
- Dashboard maximum five records total. Full history renders twenty, then twenty more; type/year/status filtering is non-mutating.
- True all/single/multiple/empty source-year selection with URL/back/forward/refresh. Empty or unavailable module/year combinations cannot start a test. Existing test snapshots remain unchanged.
- Google/Firebase interfaces, UID-owned Firestore transactions/security rules, durable IndexedDB outbox, retries, explicit conflict resolution, additive v7 migration, settings and complete personal backups.
- First Google sign-in offers explicit local-data migration; original local data remain. No pairing code, Supabase or password login is implemented.

## Evidence

Browser evidence: docs/evidence/phase2g/index.html and after/acceptance.json. All test records/screenshots were generated in isolated browser profiles. They contain no actual user learning records.

Nine mobile scenarios cover Study, Originalprüfung and Modultest at 320/360/390px. Before the change 320px overflowed to 343px. After the change all nine fit the viewport; radios and borders remain inside their fieldsets. Desktop session actions remain on one line.

A 120-record browser fixture verifies 20→40 pagination, filters, restoration, discard, permanent deletion and Dashboard bounds. Real UI-created tests verify all/single/multi source_mix and immutable old sessions. Firebase-unconfigured UI is explicit. Unit tests additionally verify additive legacy-store migration, stable IDs, offline/retry, conflict and account isolation.

Firestore Security Rules are tested against the local Firebase emulator, separately from the in-memory synchronization tests. This is not real Google login or hosted two-device acceptance.

## Final verification

- 93 application tests passed; three emulator-only cases skipped in the ordinary suite and passed separately against the actual local Firestore SDK/emulator.
- Firestore Rules: 5 passed; real SDK transport: 3 passed.
- Existing Python regression suite: 93 passed; no production PDF ingest invoked.
- TypeScript and Vite production build passed. Production dependency audit found zero vulnerabilities.
- 1,241 tracked files under protected question/asset/registry/manifest/profile paths unchanged.
- Backup UI round-trip preserves attempt ID and source. Malformed backup models are atomically rejected without partial writes.

## Preserved boundaries

All production question data, crops, answers, source registry and ingestion manifests remain unchanged from baseline. No PDF scans were run. Sommer 2017 and Winter 2017/18 retain all three modules; Sommer 2018 retains WiSo only. Sommer 2018 AP/FA remain Blocked because the second Stückliste attachment is missing.

## Stop gate

No Firebase project/Web config exists. The application remains usable locally and displays not configured. Complete the Console steps in FIREBASE_SETUP.md, provide only public Firebase Web config, then request Windows ↔ Android/iPad real-account acceptance. No new years, taxonomy, mastery, adaptive planning or AI question generation are included.

Production smoke exposed a slow-source race: the first loaded module bundle enabled cross-year launch before the other selected year loaded. Launch now waits for every selected source; a controlled delayed-response browser regression verifies disabled-then-ready behavior.
