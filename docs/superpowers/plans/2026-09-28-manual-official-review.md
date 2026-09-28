# Phase 2I.1 Manual Official Answer Review

**Goal:** Let the user inspect and explicitly confirm eight Winter2018/19 AP/FA marks, preserve immutable machine evidence, then promote each complete module without PDF access.
**Architecture:** Existing IndexedDB answerReviews stores source-bound locked confirmations. A dedicated auxiliary React page loads an eight-item immutable queue, never prefills a machine candidate, and exports only confirmations. A scoped Python importer validates every binding and artifact, writes separate reviewed keys and an append-only confirmation ledger, resolves only the official-answer blocker, and registers complete modules through public/data/promoted_modules.json. Existing parser output stays byte-identical.
**Spec:** User Phase2I.1 message. Firebase remains unconfigured; static Pages cannot write to GitHub. User exports actual selections and returns file; importer performs automatic promotion after validation. No user answers fabricated by agent.

- [x] Test source-bound confirmations, no candidate autoaccept, locked priority after machine changes, reload persistence/export.
- [x] Build eight-question Previous/Next/Save UI with original crop, explicit five rows, raw measurements, strongest candidate disclaimer, counts and JSON export.
- [x] Test importer wrong/missing/duplicate/source-tampered answers, partial per-module completion, locked idempotence, complete28+8 gate, no PDF opens.
- [x] Implement separate reviewed answer artifacts/ledger and audited unblock transition, register eligible modules automatically without rewriting old source evidence or machine outputs.
- [ ] Browser synthetic acceptance, old-data regression, independent review, CI/Pages release.
- [ ] Await real user confirmations; production coverage is pending until real confirmations arrive.

Review focus: incomplete module stays blocked; forged/stale crop or measurement binding fails closed; later machine revision cannot override manual locks; no personal attempts in export; original test sessions unchanged; failed import cannot partially unblock data.
Execution: native inline, existing checkout to retain private source caches. Baseline635153791eb6fcb770a1b7d4e092496e9c3bc085. No PDF operations permitted.

Ledger: 100 frontend tests,99 Python tests and production build passed. Isolated browser verified8 synthetic selections/save/reload/export and source hash rejection; no real answers accepted. Independent review P2 fixed: FA13–15 shared page8 now available in Study/Exam via explicit per-question context. Temporary-repository promotion browser test verified both AP/FA test pools. All1657 preexisting data/profile/asset files unchanged. CI/Pages deployment remains the last technical step; real user review remains pending.
