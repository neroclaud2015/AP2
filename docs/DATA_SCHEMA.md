# Schema version 1

`src/types/index.ts` defines the web contract. `data/ingest/manifest.json` is the processing authority; `data/exams/2017_sommer.json` is the derived browser contract, copied to `public/data/`.

- Document IDs hash exam + module + source filename + SHA-256. Archive receipt verifies immutable extracted files on restart.
- Manifest: schema/extraction versions, documents indexed by ID, source hash, module, source path, PDF URL, page totals, processed count, last completed page, status, processing_complete, question count, timestamp.
- Status: pending, extracting, partially_complete, needs_review, failed; `complete` reserved for reviewed content. `processing_complete` prevents re-extraction while review is outstanding.
- Raw page records: unchanged PDF text, text lines with bounding boxes, original full-page PNG, page dimensions, method, nullable OCR confidence. Never substitute normalized text for raw text.
- Question proposals: deterministic ID including PDF page and marker occurrence; proposed number/text/points, source reference with PDF SHA-256/page/image/bbox, nullable topic/official solution/scoring notes/AI explanation, review status, locked fields, separate solution candidates.
- PDF page numbers are physical, 1-based, not printed booklet page numbers. Several source pages are imposed spreads; automatic question segmentation is provisional and may be incomplete.
- Solution candidate requires module and number evidence. Candidate != official solution; confidence remains null when not calibrated.
- Timing is a sourced proposal, not an approved duration. Missing points, text and solutions remain null/empty with review entries.
- Taxonomy remains empty until a user approves evidence-backed topics.
- `ProgressRepository`/`AuthProvider`/`SyncProvider` define future extension seams. `LocalUserProvider` and `IndexedDBProgressRepository` are implemented; no login or network sync exists.
- IndexedDB schema v1 records are keyed by user + question. User field edits are locked; machine updates cannot overwrite them. Private records are never written into static exam JSON.

Changes to extraction/schema versions require an explicit migration. No automatic rescan or destructive raw-source overwrite is supported.

## Segmentation schema v2 (Phase 1.5)

See `src/segmented/types.ts`. `extraction_confidence` describes heuristic layout/label confidence only; auxiliary OCR text is unverified. Source IDs use physical PDF page and stable layout anchors, independent of OCR number. `regions` is the exact union of retained source rectangles; `bounding_box` encloses this union. The cropped image masks other regions white. Review status distinguishes auto_ready, needs_review and confirmed. Local QuestionReview records overlay generated fields; solution_confirmed is separate. IndexedDB v2 adds reviews without replacing v1 progress records.


## Separate official answer key (Phase 1.6)

`src/segmented/answers.ts` and `data/exams/2017_sommer_arbeitsplanung_answers.json` hold the scoped answer grid output. Existing segmented questions are unchanged. Join by exam/module/original numeric question number during extraction, then by stable question_id in the UI; editing the visible number does not silently reassign the answer.

- `solution_source_page`/`source_page`: physical source page, 1-based. Not an answer value.
- `official_answer_type`: multiple_choice; `official_answer`: integer 1–5 or null; `official_answer_status`: auto_ready / needs_review.
- `source_pdf`, `source_pdf_sha256`, `source_crop`, `answer_bbox` (header + five positions), `circle_bbox` (selected ring), `bbox_units`: PDF points, top-left origin.
- `measurements`: each row 1–5 has center, center ink, annular ink and angular support. `confidence` is a deterministic rule grade, not calibrated probability.
- Header numbering comes from a visually verified, PDF-hash-bound layout template. No OCR or semantics determine answer values.
- `data/ingest/answer_manifest.json`: separate entries keyed by source hash, parser version and layout config hash; atomic checkpoint and content-verified outputs. Shared OS lock serializes writers. No directory discovery.
- IndexedDB v3 adds `answerReviews`, keyed by userId + question_id. Locked manual answer records are independent of regenerated data; `user_corrected=true` for edits, `official_answer_status=confirmed`, `locked=true`. Automatic processing never writes this table.
- Backup schema v2 includes `reviews` + `answer_reviews`, imported in one transaction. v1 backups remain accepted without clearing answer reviews.
- Legacy `solution_page`/`solution_confirmed` only map a source; they never become numeric official answers.


## Learning and U solution schema (Phase 2A)

`src/learning/model.ts` defines multi_part U solutions, numeric/short_text/drawing/diagram subparts and private Attempt/LearningSession records. Official U source crops live separately in `data/exams/2017_sommer_arbeitsplanung_u_solutions.json`, keyed to unchanged question IDs. Regions carry physical PDF page and PDF-point box; the composite preserves source imagery.

IndexedDB v4 adds `attempts` keyed by userId+attempt_id and `learningSessions` keyed by userId+question_id. Submission atomically appends a historical attempt and stores active session; duplicate attempt IDs are rejected. Attempt grading snapshots are immutable. Only reflection fields (note/error_reason/unsure/confidence) may be amended. User answers, timestamp, partial status, hints and scoring provenance remain private. Drafts/revealed state persist separately; session updated_at determines resume order.

MC uses the effective official key (including locked local Review correction) at submission time. U numeric comparison produces a suggestion; final per-subpart assessment always comes from the user. AI advisory interface cannot access the repository. No AI evaluation is active. Numeric practice tolerance is not official scoring policy. No knowledge taxonomy or other-year ingestion is added.


## Phase 2F — replaceable interfaces and immutable sources

The production composition constructs only LocalUserProvider, IndexedDBProgressRepository and NoopSyncProvider. UI receives AppServices (repository/auth/sync/user) via context; no concrete IndexedDB/Dexie imports remain in UI. ProgressRepository covers all six existing stores, lifecycle actions, notes/reflections and snapshot reads. Auth exposes currentUser/login/logout/restoreSession; local login explicitly rejects as unsupported. Sync exposes pull/push/sync/resolveConflict with no-op local implementation and no network. Database remains v6; every personal record is userId-owned. See PHASE2F_INTERFACES.md.

Source Registry: data/source_registry.json and its public copy index source_id, exam, module, source_type (question_pdf/solution_pdf), original filename, SHA-256, version, status, layout/answer profile, supersedes_source_id and created_at. A shared physical Lösung may have one logical module binding per module with the same SHA. Historical registration uses existing accepted metadata, never rescans PDFs or changes question IDs.

Import stages: register → verified hash → profile match → layout validation → preview → formal segmentation → answers → validation → production. Each gate records matching source hash and hashed evidence. MODULES is guarded by the registry: both question and solution sources must be production-approved. New hashes require a new source/version. A replacement keeps the old source intact and requires fresh validation plus an explicit reviewed identity mapping. Unsafe mapping is blocked; no registry operation accesses or migrates personal records.

New attempts retain question_source_revision, official_answer_revision, source IDs and optional answer-review revision. Legacy source_revision is preserved in old and new records with its original meaning. New test source_mix records include source IDs, question/answer versions, immutable question and subpart snapshots; official numeric answer snapshots determine MC scoring. Existing attempts/tests/sourceExams/source_mix are not rewritten or reassembled when sources or exam seasons change. Older records lacking new provenance are not assigned invented historical versions.
