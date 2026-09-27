# Registered ingestion runner

`scripts/registered_ingest.py` is one registry-aware orchestrator for explicit source profiles. It reuses immutable portrait-region and official-ring engines; no year-specific parser copy is introduced.

Python API (all paths are pathlib.Path; config paths absolute):

- `cache_registered(root, archive, source_id, sha256, max_pages=None)`: requires registered identity, verifies ZIP-member bytes before opening PDF, checkpoints pages privately by source hash. Shared solution bytes render once across logical module sources.
- `run_layout(root, config_path, promote=False)`: requires a source allowlist, exact page geometry, explicit heading fingerprints and region ownership. Produces complete question previews and structural report before formal promotion. `promote=True` requires compatible structure and no blocking dependencies.
- `run_answers(root, layout_path, answer_path)`: requires immutable formal segmentation artifacts, exact official source/profile binding and complete IDs. Reuses deterministic ring measurements and screenshot U extraction. Successful coverage advances both logical sources to validated.
- `advance(root, source_id, "production", evidence_paths, **metadata)`: final stage only after independent artifact/visual validation; Source Registry rejects skipped stages.

Completed runs verify committed artifacts before private-cache access. Unknown sources, changed accepted geometry/configuration, incomplete physical coverage, changed formal crops and missing necessary attachments fail closed. A completed blocked AP preview can be inspected/repeated without source access; promotion remains forbidden. FA was stopped before region segmentation because its required appendix was absent.

All new full PDF/page caches are private under `data/ingest/registered-*-source/` (ignored). Only question/answer crops and necessary localized context are public. Canonical JSON hashes and LF HTML make accepted artifacts stable across Windows/Linux; two initial immutable byte-hash receipts have exact `-text` git attributes.

Sommer2018 status: WiSo production, AP/FA blocked for missing explicitly referenced Stückliste Blatt2. No later years authorized. Tests: `python -m unittest scripts.test_registered_ingest -v` with dependencies/scripts on PYTHONPATH; nine checks include interrupted cache resume, shared-source deduplication, registry/profile gates, blocked-safe behavior, no-private-cache final skip and changed-artifact rejection.
