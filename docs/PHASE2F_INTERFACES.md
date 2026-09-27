# Phase 2F: personal-data interfaces

The default composition in `src/services/composition.ts` constructs the sole actual persistence implementation, `IndexedDBProgressRepository`, and restores the explicit `LocalUserProvider` identity. `main.tsx` injects these services through `AppServicesProvider`. UI components depend only on `ProgressRepository` and context; none imports Dexie or constructs IndexedDB. Failed initialization produces a readable alert.

## Contracts

- `ProgressRepository` in `src/types/index.ts` includes progress fields, review and answer-review reads/writes/imports, attempts and immutable result annotations, learning drafts, test sessions, analysis eligibility reads, revision-checked update/discard/delete, and transactional `exportSnapshot(userId)` over all six personal stores. Notes/reflections remain existing record fields, attempt annotations, and learning drafts; no new table or schema migration.
- All reads and ID-based updates require `userId`; record writes carry their owner. A paired attempt/draft must have the same owner and question. UI review imports explicitly pass the current user; imported foreign/mixed owners are rejected. The optional import owner preserves old caller compatibility, deriving a single owner from the payload if omitted.
- `AuthProvider`: `currentUser`, `restoreSession`, `login`, `logout`. Local restore/current return `LOCAL_USER_ID` from `src/services/identity.ts`. Login explicitly rejects as unsupported. Logout is an explicit local no-op and does not erase records. No remote credentials or fake authentication.
- `SyncProvider`: `pull`, `push`, `sync`, `resolveConflict`, all with a user context. Results can express noop, completed, conflicts, or error. `NoopSyncProvider` always returns an explicit local-mode noop and performs no network calls.
- `AppServices` supplies `repository`, `auth`, `sync`, and `user`. Alternate implementations can be injected without concrete database dependencies. Changing user identity remounts UI state so prior-user drafts are not reused. Local mode is the only production composition.

## Identity and historical data

Database stays logical version 6 with unchanged compound keys and lifecycle transactions. Existing local data are not rewritten. Validators accept nonempty user IDs instead of requiring one literal user. New UI writes use context identity; new test creation explicitly passes it. Browser databases used for acceptance are isolated and never access the user's personal browser profile.

New attempts copy optional provenance supplied by LearningApp: question source revision, official answer revision, review revision, and registry source IDs when available. The legacy source_revision retains its previous meaning. Existing attempts are never backfilled. ExamWorkspace prefers immutable question/subpart snapshots in new test records and falls back to live source data only for old records without snapshots.

## Verification

- Full frontend suite: 51 tests passed after initial failing contract tests.
- Production build passed.
- New interface tests cover alternate-user attempts, all-table read/export isolation, paired-write rejection, foreign/mixed review imports, lifecycle owner isolation, interface-only React injection, local auth, and all noop sync methods.
- Existing storage migration and lifecycle tests still pass, preserving prior v4/v5 data behavior.
- Real browser lifecycle regression evidence: `docs/evidence/phase2f/interfaces-lifecycle/` (isolated context).
