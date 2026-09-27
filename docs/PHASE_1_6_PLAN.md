# Phase 1.6 — Official Answer Key Extraction

Scope: 2017 Sommer Arbeitsplanung Teil A, Q1–Q28 only. Preserve every segmentation file and question ID. Do not run ingestion or segmentation.

1. Use Lösung physical PDF page 2. Its three groups have 10, 10 and 8 numbered columns. Bind a visually verified header/coordinate template to the exact PDF SHA256. The template contains no answers. Reject unknown source/layout instead of guessing. No OCR or question semantics decide answers.
2. At each of five dot centers measure an annular ink band and angular support. Require five visible center dots and exactly one strong ring. Top-to-bottom row indices are explicitly 1–5. Ambiguous results have null answers and needs_review.
3. Save a separate answer-key dataset with stable question IDs, source page, PDF-coordinate bounding boxes, column crops, raw measurements and a labeled overlay. Independent manifest/checkpoint key = source hash + parser version + layout config hash; atomic writes and the shared OS write lock (serializes ingestion/segmentation/answer writes; no other job is started).
4. Add a separate IndexedDB answer-review table. Human numeric edits/confirmations are locked and overlay generated data. Extend backup import/export atomically; retain old backups. Source-page mapping is not an answer value.
5. Test synthetic first/last rows, absent/double marks, shifted/missing grid positions, uncertain numbering, completeness, checkpoint recovery and skip. Test browser editing, refresh, new machine data, backup and numeric selection. Validate saved artifacts without scanning PDFs in CI.
6. Publish to the existing GitHub Pages site. Report counts, exceptions, eight seeded random examples, full grid overlay, persistence and skip proof. Stop for acceptance.

Confidence is a deterministic rule grade, not a calibrated probability. Header mapping is a reviewed, source-hash-bound template, not a general OCR claim. New document layouts require explicit template validation.
