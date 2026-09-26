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
