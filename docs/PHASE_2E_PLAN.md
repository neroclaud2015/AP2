# Phase 2E implementation ledger

Authorized scope: local test lifecycle + Winter2017/18 AP, then FA, then WiSo. No other season, taxonomy, generated questions or adaptive planning. Existing data and personal overlays preserved.

1. Lifecycle: normalize legacy submitted to completed using lossless IndexedDB migration; active/paused/completed/abandoned/discarded. Unified eligibility only completed and not discarded/deleted. Transactional revision-checked discard/delete, scoped child cleanup. Confirmation UI and hidden discarded view. Never mutate user database during verification.
2. Winter AP: accepted existing36crop preview, validate all cached ownership/identity, promote exact pixels. Independently inspect solution layout and deterministic circle parser, source crops/U screenshots. Per-source/page/version checkpoints.
3. Winter FA: scoped source caching only if not already processed, layout profile reuse/extension, full preview+structural validation. Block rather than infer. WiSo only after FA succeeds.
4. Multi-season UI: key bundles by exam+module, data-driven session labels and registry; unavailable cards not links. Legacy URLs default Sommer. Study/reviews/attempts remain question-ID keyed. Mixed module tests deterministically sample at least two available seasons and preserve per-question source; original tests remain one season.
5. Validate old data hashes, migration/discard/delete isolation, route/session refresh, real two-source test, all cache skips. Publish scoped evidence, commit/push main and Pages, live acceptance, stop.

Ownership: lifecycle worker owns storage/model lifecycle/ExamWorkspace lifecycle/RecordLifecycle component; data workers own new scoped Python/data/evidence files; parent owns learning registry/app multi-season integration, cross-year sampling after lifecycle model edits complete, final review/deploy.

Ruling: detailed user specification authorizes implementation and publication. No extra approval gate; only uncertain source interpretation blocks the relevant module. Existing clean project branch continues to preserve cache/provenance.
