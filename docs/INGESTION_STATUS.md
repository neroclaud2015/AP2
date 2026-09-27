# Current stop: Phase 2F — infrastructure complete; Sommer 2018 WiSo validated

Production: Sommer 2017 AP36 / FA36 / WiSo24; Winter 2017/18 AP36 / FA36 / WiSo24; Sommer 2018 WiSo24. Total 7 modules / 216 questions.

Sommer2018 AP: Blocked, missing required Stückliste Blatt2 referenced by U6/U7. 36-question dry-run only.
Sommer2018 FA: Blocked, missing required Stückliste Blatt2 referenced by U1/U2/U3. Stopped before detailed segmentation.

Source Registry has 18 logical records, including every historical production source. Four new physical PDFs cached by hash; shared solution rendered once. Old modules were not rescanned or changed. Page/module checkpoints and profile/config hashes remain required.

ProgressRepository/AuthProvider/SyncProvider are complete replaceable contracts. Runtime remains LocalUserProvider + IndexedDB v6 + NoopSyncProvider. No real authentication/sync. Replacement source gates require safe complete identity mapping; historical provenance is immutable. See PHASE_2F_REPORT.md and DATA_SCHEMA.md.

No later season is authorized. Stop for user acceptance.

---
# Historical status (retained below, superseded by Phase 2F above)

# Current stop: Phase 2A learning prototype; awaiting user acceptance

2017 Sommer Arbeitsplanung only: normal Dashboard/exam navigation, separate Study and Review, MC submissions and personal progress, U1–U8 official source crops and user-controlled subpart assessment. U7.1 numeric comparison uses an explicit practice tolerance. No other years/modules processed. See PHASE_2A_REPORT.md.

## Historical Phase 1.6 status

# Current stop: Phase 1.6 complete; awaiting user acceptance

Only 2017 Sommer Arbeitsplanung Teil A official answers were added: Q1–Q28, 28 auto_ready, 0 answer needs_review. Source: Lösung PDF page 2. Parser 1.6.0, separate answer manifest. Phase 1.5 segmentation and all question IDs remain unchanged; its 4 crop reviews remain. No other years/modules/U answers processed. See PHASE_1_6_REPORT.md.

## Historical Phase 1.5 status

Arbeitsplanung only: 36 segmented questions, 32 auto-ready, 4 need review (8, 24, 25, 27). Active segmenter 1.5.3. Legacy ingestion records below remain unchanged. No other modules or years reprocessed.

# Ingestion status

Scope: **2017 Sommer only**. No bulk scanning authorized.

- Arbeitsplanung: 13/13 pages; needs_review
- Funktionsanalyse: 15/15 pages; needs_review
- Solutions: 11/11 pages; needs_review
- WiSo: 9/9 pages; needs_review

{'pages': 48, 'questions': 83, 'image_only_pages': 5, 'review_items': 131}

Processing completion is separate from content approval. All OCR/segmentation/points/solutions remain proposals until reviewed.

Other seasons: untouched. Stop after Phase 0–1.
