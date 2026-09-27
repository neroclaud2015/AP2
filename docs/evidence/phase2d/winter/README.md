# Winter 2017/18 Arbeitsplanung — acceptance-only preview

Current entry: [index.html](index.html). The independently versioned current directory is recorded in `data/ingest/winter_layout_manifest.json` (active_key/report). No existing layout-validation manifest is changed by this runner.

## Result

- 25 physical cached pages inspected and classified.
- 36 observed printed question labels: 1–28 and U1–U8; 36 full PNG previews.
- No missing/duplicate heading, unresolved owner, outside-page region or different-owner overlap in the final report.
- `compatible_dry_run`; user visual acceptance remains pending. This is not production registration.
- No formal question records, answer parsing or learning-state changes.

## Actual-number evidence

Every printed label was inspected individually at readable size. `audit/headings-contact.png` contains all36 label patches. Each transcription is bound to its exact RGB pixel SHA256 in `scripts/layout_profiles/winter_2017_18.json`. The reusable portrait engine verifies those fingerprints before emitting an anchor. A changed/missing patch creates an unowned region and Needs Review; expected sequence is only a completeness check, never a source of numbers. No OCR result is claimed: this source is supported through explicit visual observations plus pixel authentication.

The entire cached source image and saved raw-page record hashes are checked first. Geometry must match the audited physical page within0.001 PDF point. All input paths come from the source-hash-specific immutable cache (`f5e152ae12d23f22345ae8b5f6f60208eaab095cbe5e3c7d5eecf563af6b6c21`). The PDF/ZIP is never opened.

## Explicit ownership cases

- Q1 excludes the sample marking form above it and retains both component drawings.
- Q8 owns the upper panel and the right-side electrical circuit beside Q9. The preview preserves their physical alignment and masks Q9. The right margin retains the complete “Störung” label.
- Q26 owns the right grid explicitly labelled “Nebenrechnung Aufgabe26”.
- U5 begins on physical page19 and includes the Grafcet response on page20. Page20's scoring field explicitly says “Ergebnis U5”; matching diagram symbols and task wording corroborate this. Ownership does not depend on adjacency.
- U8 retains its full response grid and excludes the examiner summary below it.
- Page14 is shared task context, page24 is the U4 oil-change attachment, and landscape page25 is the U2 extrusion-tool drawing. Covers, instructions and marking examples are classified separately.

Within each physical page, regions retain their spatial arrangement; explicit multi-page regions are then stacked in source order. Preview resolution is the unchanged120dpi cache; no source rerender or synthetic sharpening is used.

## Verification

Six focused tests pass: all-page/36-heading ownership, changed heading rejection without sequence filling, changed U5 owner rejection, exact geometry rejection, L-shaped masking plus explicit page ordering, and completed resume with PDF/ZIP opening and page analysis forbidden.

`resume-verification.json`: processed_now0, skipped_pages25, source_pdf_pages_opened0, source_pdf_pages_rendered0. `verification.json`: visual QA and222 valid relative links.

Runner: `python scripts/winter_preview.py`. Completed page checkpoints and output artifacts are integrity checked. Source/profile/config/runner hashes isolate revisions. Failures publish Blocked rather than leave stale success at the current entry.
