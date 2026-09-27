# Phase 2F — controlled outcome

Only Sommer 2018 was inspected. Infrastructure is complete; WiSo passed production validation. Arbeitsplanung and Funktionsanalyse remain blocked for missing required source material. No Winter 2018/19 or later files, taxonomy, AI questions, login or cloud service were introduced.

## Infrastructure and existing records

- UI uses the complete ProgressRepository contract through AppServicesProvider. IndexedDB remains the sole storage implementation; database version 6 and existing local-user semantics are unchanged.
- AuthProvider exposes currentUser/login/logout/restoreSession; LocalUserProvider remains active. NoopSyncProvider exposes pull/push/sync/resolveConflict without network requests.
- All operations scope records by userId. Tests cover a second synthetic user, import ownership, lifecycle isolation and interface-only UI injection.
- New attempts and test sessions snapshot source IDs, source hashes, question revision and official answer revision. New test sessions also snapshot question content and subpart models. Existing records are not backfilled or reassembled.
- Registry: 18 logical records (12 accepted historical source records plus 6 Sommer2018 module/source records). The three new solution references share one physical PDF; only four new physical PDFs were cached.
- Replacement requires a new hash/version, ordered validation gates and an explicit identity decision bound to BOTH complete validated datasets and their hashes. Partial maps fail closed. No personal-data migration is automatic.
- Production registration is checked by the frontend metadata gate and by CI's artifact-hash validator. Old metadata migration reads existing JSON only.

## Sommer 2018

| Module | Result | Evidence / remaining work |
| --- | --- | --- |
| Arbeitsplanung | Blocked | 29 pages classified; 36/36 anchors and crops. U6/U7 explicitly require Stückliste Blatt2, absent from the supplied file. No formal records or answers generated. |
| Funktionsanalyse | Blocked | 25 pages visually checked; Q1–28/U1–8 observed. U1/U2/U3 require the missing Stückliste Blatt2. Stopped before detailed crops; no formal records or answers. |
| WiSo | Production | 14 pages; Q1–18/U1–6; 18/18 deterministic MC answers; 6/6 official U crops; zero review items. U4 ownership explicitly crosses pages8–9. Context and U1/U3 appendix excerpts retained. 60 minutes is evidenced on page2. |

The shared official solution file was also checked and does not supply either missing parts list. AP/FA must remain unavailable until complete source material is supplied and validated. No substitute was inferred from another year.

## Validation

- 58 frontend and 93 Python tests passed; production build passed (non-blocking bundle-size warning remains).
- 1,082 historical JSON/crop/checkpoint files match the accepted baseline commit `daca24e53ed2da643852e6f01ff596a622e9c7ca`.
- Isolated browser: old attempt/session data unchanged; old Alle-Jahre session retains its original sourceExams/source_mix; WiSo MC/U learning, original-order exam, pause/refresh/resume/submit passed.
- New WiSo Alle-Jahre test contains Sommer2017, Winter2017/18 and Sommer2018. Each single-year filter is exclusive. Back/forward/refresh and mobile overflow checks passed.
- Completed layout/answer reruns skip with zero pages processed, even when PDF/private-cache/render functions are mocked to fail. Shared solution cache is deduplicated; fixture interruptions resume by page.
- Existing Review/answer corrections remain separate. Private baseline stays local; browser evidence includes no imported private record content.

## Entrances

- Website: https://neroclaud2015.github.io/AP2/
- WiSo Q1: https://neroclaud2015.github.io/AP2/?view=study&exam=2018-sommer&module=wiso&q=1
- WiSo U1: https://neroclaud2015.github.io/AP2/?view=study&exam=2018-sommer&module=wiso&q=U1
- Original exam: https://neroclaud2015.github.io/AP2/?view=exams&exam=2018-sommer&module=wiso
- Tests: https://neroclaud2015.github.io/AP2/?view=tests&years=all&module=wiso
- Evidence: https://neroclaud2015.github.io/AP2/evidence/phase2f/

See PHASE2F_INTERFACES.md, PHASE2F_SOURCES.md and REGISTERED_INGESTION.md for contracts. Full source PDFs/page caches remain private; public evidence consists of question/answer crops and necessary context excerpts. Deployment SHA and final CI/Pages run links are provided with the release response. Stop here for acceptance.
