# Phase 2F source registry and import contract

`data/source_registry.json` is the mutable pipeline metadata store; `public/data/source_registry.json` is its identical published index. Neither contains PDF bytes, private full-page solutions, credentials, or personal data. Python contract: `scripts/source_registry.py`. Browser contract: `src/sources/registry.ts`.

Each logical source has `source_id`, `exam`, `module`, `source_type` (`question_pdf` or `solution_pdf`), `filename`, exact-byte `sha256`, integer `version`, `status`, `layout_profile`, `answer_profile`, nullable `supersedes_source_id`, and UTC `created_at`. Gate evidence and event history are retained. Exam keys use the UI's canonical hyphen form; module keys use lowercase slugs. Three modules may reference the same physical solution hash, with separate logical source IDs and separate acceptance gates.

Historical migration reads only existing published segmented/answer/U metadata. The six previously accepted Sommer 2017 and Winter 2017/18 modules supply twelve production source entries. Their evidence explicitly says `existing_accepted_production_metadata_migration`: this indexes prior acceptance; it does not claim a new PDF scan or rerun. Existing question IDs, images, reviews, attempts, notes and test sessions are not changed.

Sommer 2018 starts with six logical entries for four physical PDFs. The hashes were supplied by the scoped archive inventory. Registration alone does not approve processing results or production.

## Pipeline API

All operations return a copied registry and leave the input untouched. Persist with `save_registry(root, registry)` only after the operation succeeds. The data runner owns registry writes serially; pipeline/source page checkpoints remain in its independent resumable manifests.

- `load_registry(root)` / `save_registry(root, registry)` read/write metadata only.
- `register_source(registry, *, exam, module, source_type, filename, sha256, version=1, layout_profile=None, answer_profile=None, supersedes_source_id=None)` returns `(registry, source_id)`. Re-registering the identical source is idempotent.
- `require_registered_source(registry, source_id, sha256)` returns a copy of the registered source, rejecting a wrong hash or blocked source before caching.
- `bind_profiles(registry, source_id, *, layout_profile, answer_profile)` binds exact profile versions/config identities before profile matching.
- `transition_source(registry, source_id, target, evidence)` permits exactly one next stage; no skips or backwards changes. Evidence requires `source_sha256`, `result: passed`, and a nonempty `artifacts` mapping from metadata paths to SHA256. Include geometry/config/parser/page-checkpoint proof in the relevant artifact. A blocked transition requires an explicit reason. Blocked sources never enter production.

Stages, in order: `registered` → `hash_verified` → `profile_matched` → `layout_validated` → `preview_ready` → `formal_segmented` → `answers_extracted` → `validated` → `production`.

Both original and solution logical sources progress through the module contract, referencing shared module reports where appropriate. The `validated` evidence on both includes the three exact `public/data/..._{segmented,answers,u_solutions}.json` paths and their canonical JSON hashes. Source PDF hashes always identify exact original PDF bytes; metadata hashes use deterministic canonical JSON where supplied by the pipeline. A production gate is not permission to publish a complete private PDF: source availability flags still govern public links.

## Replacement and historical provenance

A replacement must have a different source hash, next integer version, and `supersedes_source_id` pointing at the latest matching exam/module/type entry. Old entries are not overwritten or relabelled. A new replacement starts again at registration, so it cannot inherit prior validation.

`record_identity_decision(registry, id, 'preserve_ids', evidence)` requires explicit reviewed evidence with complete unique `old_question_ids`, `new_question_ids`, and an identity mapping for every ID. It never writes user data. Unsafe, partial, changed-ID mappings are rejected; record `'blocked'` with a reason to stop the source. Production cannot be reached without this decision for a replacement. This phase deliberately does not implement an automatic re-key migration.

A pending replacement leaves the old production source active. Once a replacement is approved, new attempts may snapshot its source IDs/revisions. Existing completed attempts and test sessions retain their saved source revision, official-answer revision, source mix, question image/source snapshot, result and answers. The registry API cannot access or rewrite personal storage. Old versioned assets must remain available while historical records reference them.

## Runtime registration gate

`moduleSources(registry, {examId, slug, segmentedPath?, answersPath?, solutionsPath?})` returns copies of the latest approved `{question, solution}` pair. It checks both source identities, all stage proofs, and safe replacement decisions. When configuration file paths are supplied, all must be present in each source's validated evidence; a registered module cannot point at another dataset.

`assertProductionModule(registry, config)` performs the same checks and throws on missing or pending sources. Call this when adding configurations to `MODULES`. `sourceSnapshot(registry, config)` returns source IDs, hashes and revisions for **new** personal records; never recompute old snapshots after replacement.

Tests cover immutable/idempotent registration, skipped stages, wrong hashes, same-hash replacement rejection, version protection, blocked identity mapping, explicit safe replacement, complete production pairs, configuration-path mismatch and copy isolation. No registry operation opens PDFs, archives or a user's IndexedDB.
