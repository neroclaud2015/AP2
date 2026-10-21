# Phase 3D validation — 2026-10-21

- Frontend: 232 tests passed, 3 emulator-dependent tests skipped locally; emulator tests remain in Pages CI.
- Python: 157 tests passed, including 9 WiSo extraction/cache/classification fixtures.
- Production build: TypeScript and Vite passed. Existing large-bundle warning remains.
- Browser: final production build passed desktop 1440px and mobile 390px checks; screenshots and checks.json are in browser/.
- Topic training resumes the same run; saved note survives refresh; solution-only leaves progress unchanged; manual classification saves locked.
- New topic pools do not alter existing run snapshots. Resume remains possible when current classification no longer includes the saved questions.
- Existing Training Key serialization is byte-identical for omitted/empty WiSo filters.
- Add/change/delete tests update derived inventory and retain retired evidence; confirmed classification survives changed source revision with a review flag.
- Source data and personal repository implementations unchanged. Browser acceptance uses a fresh isolated test profile.
- Text coverage 456/456 (68 PDF text, 388 OCR); classification 396/456, 60 unclassified, 10 text-review flags. Machine proposals are not represented as full human verification.
- Repeat derivation: 456 cache hits, identical dataset SHA-256, no PDF rendering.
- Seven current-law summary cards carry official references and a 2026-10-21 verification date; other legal cards remain review-needed.

Ranking, synthetic personal-priority inputs, configuration and compatibility assertions: acceptance.json.
Detailed cache/source/provenance assertions: pipeline-acceptance.json.
CI and live deployment status are reported after publication; local checks alone do not establish deployment.
