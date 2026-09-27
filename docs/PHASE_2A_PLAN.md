# Phase 2A: single-module learning

Scope: 2017 Sommer Arbeitsplanung only. Preserve segmentation, stable IDs and Teil A keys.

- Start dashboard, exam catalogue, exam view with Teil A/B navigation. Existing Review remains an auxiliary mode; official answer confirmation never appears in Study.
- Separate immutable attempt history from official data and corrections. IndexedDB v4 adds attempts and persistent draft sessions. Submission snapshots the actual grading key; later correction changes do not silently rewrite history. Each attempt stores timestamp, answer, correctness/partial status, unsure, hints, error reason, note, scoring provenance and subpart outcomes.
- MC: choose 1–5, submit, then reveal correct/wrong, source, explanation/reflection and notes. Do not fabricate pedagogical explanations; offer a clearly labeled source comparison and personal explanation field.
- U: original question, per-subpart input, reveal source, per-subpart self-assessment. Numeric checks are deterministic suggestions from visually verified official numeric fields; U final assessments always require the user. Drawing can be completed on paper and recorded as such; no image scoring. AI evaluation interface is advisory only and no AI call is implemented.
- Scoped source templates: U1 p6 right, U2/U3 p7 left, U4 p8 right + p9 left top, U5/U6/U7 p9 left, U8 p9 right. Same-numbered Funktionsanalyse regions are excluded. Bind source hash, template config and version; separate resumable U manifest.
- Verify cropped images and numerical sources visually. Test MC correct/wrong, decimal/unit/tolerance validation, append-only attempts, draft refresh, per-subpart final assessment and mode separation, persistence and existing review controls. Independent review, publish existing Pages, full acceptance report; then STOP.
