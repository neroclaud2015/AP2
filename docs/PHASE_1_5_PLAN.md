# Phase 1.5 — Question segmentation and review

User specification: operate only on 2017 Sommer Arbeitsplanung. No bulk ingestion; stop for acceptance.

Design:
- Keep ingestion v1 manifest and raw pages immutable. Add a separate segmentation manifest indexed by document hash, segmenter version and configuration hash, with atomic page checkpoints. Only explicitly selected document/page versions can be recomputed.
- Use physical page coordinates, booklet half-page boundaries, printed separators and question-number evidence. Use OCR for missing/inverted question labels; auxiliary text never determines whole-page reading order.
- Preserve diagrams inside image crops rendered from the original PDF. Store stable IDs, original source references, bbox, auxiliary text, confidence/reasons, and automatic-vs-human review states separately.
- New default learner view is one cropped question at a time. Original pages/raw text remain available as source/debug tools.
- Review/edit: number, rectangular crop selection/coordinates, text, answer source selection/confirmation, personal tags, Confirmed/Needs Review. Atomic IndexedDB corrections override generated fields and persist independently of extractor versions; export/import protects edits.
- Review queue contains only low-confidence or user-flagged questions. High-confidence automatic extraction is not labelled human-confirmed.
- Preserve existing other-module assets; do not re-extract their PDFs. Use already cached solution-page references in the editor.

Verification:
1. Fixtures prove column separation, diagram inclusion, missing-label review and stable IDs.
2. Actual single-PDF run interrupted and resumed; unchanged version skips; version bump requires explicit scope and never invokes archive ingestion.
3. Inspect text-only, multicolumn and diagram pages. Reproducibly sample 5 successful crops and include diagram example.
4. Browser checks question navigation, crop edit, number/text/tag/solution changes, reload persistence, review queue filtering, original PDF links and responsive UI.
5. Independent review, build/tests, deploy to existing authorized Pages site, then STOP.

Progress: initial layout inspection found imposed two-page spreads with printed question separators, 28 multiple-choice questions and 8 U questions indicated by the source instructions. Counts must be validated against extracted labels, not synthesized.

Completed: coordinate segmentation, 36/36 coverage, 4-item review queue, image-first UI, persistent edits, backup, versioned resume, 12 Python tests and 2 storage tests, browser acceptance. Independent review findings fixed with regression tests. Deployment and live browser verification passed. STOPPED; awaiting user acceptance.
