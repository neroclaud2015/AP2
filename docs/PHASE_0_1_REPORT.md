# Phase 0–1 pilot report

Scope: 2017 Sommer only. No other ZIP has been opened or extracted. No Phase 2/3 or bulk scan started.

The requested nested plan path was absent; the matching root `AP2_MASTER_PLAN.md` was used and copied into docs. Implementation lives in a dedicated `ap2-study` repository on `prototype/phase-0-1`.

## Delivered

- React/TypeScript/Vite prototype with original PDF page browser, raw text details, unverified question proposals, and review queue navigation.
- Versioned schemas; IndexedDB progress repository; user/auth/sync interfaces; user corrections locked against machine overwrite; no login UI.
- Single-season ZIP extraction and PDF discovery; immutable source hashes and receipts; page images and raw text persisted; proposed question boundaries/points/solution mappings retain source references.
- Page-level atomic checkpoints, process lock, crash-safe PDF publication, completed-document skipping; explicit version migration required.
- GitHub Pages workflow validates/builds existing data only. It never starts ingestion.

## Pilot result

| Module | PDF pages | Unverified question proposals |
| --- | ---: | ---: |
| Arbeitsplanung | 13 | 16 |
| Funktionsanalyse | 15 | 53 |
| Official solution document | 11 | 0 |
| WiSo | 9 | 14 |
| Total | 48 | 83 |

All 48 images and 4 original PDFs are retained. Five pages lack a text layer and remain image-only with OCR-required review entries. Six question proposals have proposed points. Twenty-five possible solution links remain unconfirmed. Zero question proposals or solution mappings have been approved. The 131 review entries produce 248 content-validation warnings; structural validation reports zero errors.

The PDFs include imposed booklet spreads and noisy existing OCR. Proposal counts are **not** real question totals. This prototype demonstrates ingestion plumbing and complete source browsing; it is not yet a validated, ready-to-study question bank. OCR integration and robust spread-aware segmentation require review before any bulk ingestion.

## Verification evidence

- Actual pilot: first run `--max-pages 3` saved 3 pages; next run processed exactly the remaining 45 pages.
- Repeated completed run: `processed_now: 0`, `skipped_documents: 4`.
- Python suite: 6/6 pass. Covers resume without rewriting saved pages; completed-PDF skipping; ZIP traversal rejection; immutable-source mutation rejection; uncertain-answer isolation and source retention; interrupted PDF copy recovery; first-run derived counts. Some tests cover multiple related assertions.
- IndexedDB suite: 1/1 pass; manual correction survives machine write and repository reopen, separate user cannot read it.
- Browser: all 48 images load; 48 PDF page anchors match; question/review source navigation works; 390px mobile layout has no horizontal overflow; no browser page errors.
- TypeScript and Vite production build pass. Dependency audit: zero vulnerabilities.
- Independent code review found two issues (interrupted copy and stale counts). Both reproduced in failing tests, fixed, and covered in the passing suite.
- Screenshots and browser result: `docs/evidence/`.

## Stop condition

Stop after repository/deployment outcome is recorded. Other exam seasons remain untouched. No scheduled continuation or automation is configured.
