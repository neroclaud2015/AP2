# Phase 2G client synchronization

## Current deployment boundary

Firebase is not configured. The application remains usable offline and displays “Cloud-Sync nicht eingerichtet” / “Noch nicht synchronisiert”; Google sign-in is disabled. No pairing-code, Supabase, profile-token, administrator credential or real-cloud acceptance is part of this implementation. See the Firebase worker setup guide for the public Web configuration and Firestore Rules.

## Offline persistence

IndexedDB logical version 7 adds settings, syncMeta, outbox, tombstones, syncConflicts, and deviceState. Existing six personal tables, compound IDs and lifecycle revision checks remain intact. Opening a v6 database preserves all previous rows and does not queue them for upload. Ordinary local writes atomically persist their entity plus durable sync metadata/outbox. A random persistent device ID is allocated before the first queued write. Settings are the seventh synchronized entity; credentials/device state are excluded from backups.

A permanent test deletion removes only that test record and adds a durable tombstone. It never deletes free-learning attempts. Restore/resume reject a competing active/paused session in the same original scope or across years for the same module-test scope.

## Authentication and orchestration

`AppServices.syncControl` depends on the replaceable `SyncController` interface. `FirestoreSyncProvider` coordinates the injected transport and IndexedDB implementation. `FirebaseAuthProvider` supplies Google UID; this is the personal-data owner. Context remounts learning state on identity changes. Logout returns to the retained local profile and does not erase either UID data or cloud data.

Sync runs manually, on reconnect, and every 30 seconds while authenticated. Missing configuration or a local identity produces an explicit noop. A sync captures UID and auth generation; transport receives the expected UID. A later account waits for an old in-flight run to terminate and starts its own run. Old responses cannot apply to the new account or display its success state.

## Conflict and retry semantics

Stable entity IDs and mutation IDs, base remote revisions, and per-user cursors implement CAS, not last-write-wins. Push precedes pull. If the server succeeds but local acknowledgement fails, retry uses the same mutation ID and is idempotent. An acknowledgement removes a pending write only when its mutation ID still matches; an edit made while uploading stays queued with the updated base revision.

Concurrent edits and delete-versus-edit retain both versions in syncConflicts. The UI displays both and requires a local/remote choice. The choice is revision/mutation checked; stale choices require reviewing the current conflict. New local edits update the retained local conflict copy. Remote payloads require the current UID, stable ID, valid entity schema and preserved historical provenance. Remote deletion cannot silently resurrect locally deleted records: it must pass the same conflict flow.

Only remote apply, explicit migration/import and conflict application emit `ap2:personal-data-changed`. Ordinary writes do not emit it and therefore do not reset answer drafts.

## Migration and backups

Settings shows counts of existing local records. No old local data are automatically attached to a Google UID. The explicit migration button remaps only ownership, retaining stable IDs and complete provenance, queues the new UID copies, and keeps local originals even after success. A conflicting existing ID causes an atomic import abort without partial changes.

Backups include all seven personal entity types and exclude tokens/device metadata. Import explicitly chooses local-only (stored under local, no upload) or import-and-sync (current authenticated UID). Identical records are compared canonically independent of object key order. A previously local-only record can later be explicitly queued without duplicating IDs. A synchronized identical record is not re-uploaded merely because the same backup is imported again.

## Verification evidence

Application unit suite: 91 tests passed at the completed client handoff (22 test files). This includes nine provider scenarios against two isolated fake-indexedDB databases and an injected deterministic transport, plus durable-write and real v6-to-v7 upgrade tests. Coverage includes all seven migration entities, provenance preservation, offline/reconnect, concurrent notes, tombstone versus edit, failed acknowledgement retry, newer in-flight writes, stale conflict choices, wrong-owner payload rejection, explicit backup upload, account switching, logout, and restoration competition.

These are local/injected-transport tests, not evidence of real Google login, deployed Firestore Rules, or Windows/Android/iPad cloud synchronization. Production build also passes. The remaining real-device acceptance requires user-provided public Firebase Web configuration and deployed Rules.
