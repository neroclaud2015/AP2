# WiSo Fokus — Phase 3D design
Date: 2026-10-21. User explicitly authorizes design self-review, implementation, acceptance and deployment without additional approval.

## Outcome and scope
456 production WiSo questions across 19 seasons are the initial input. WiSo Fokus provides source-backed topic frequency, concise review cards, transparent personal priorities and original-question training. No Firebase activation, generated questions, adaptive daily plan or historical-source repair.

## Data contracts and boundaries
Build-time pipeline reads production inventory and source crops. WiSoQuestionText stores question_id, question_source_revision, text, extraction_method (pdf_text/existing_text/visual_transcription/manual), confidence, language, reviewed, updated_at and evidence. OCR fallback is identified as visual_transcription with engine metadata. Try reliable coordinate-clipped PDF text, then usable existing text, then cached crop OCR. Cache key binds source revision, crop hash, extraction version/config. Never write original datasets, answers or grading. All production questions remain inventoried even if text/classification unavailable. Removal retires derived records; history remains.
Independent two-level WiSo taxonomy lives in JSON. Topic classifications are multi-label and source-revision-bound; machine proposals include evidence. Human confirmed locked overrides retain priority; changed source marks source_changed_since_confirmation, never overwrites. New stable categories are proposed_new_wiso_topic review items. Uncertain text is text_needs_review; low confidence is visible, never silently fabricated.
Topic summaries store historical_exam_summary provenance and supporting question IDs. Exam patterns must name supporting questions. LegalFreshness contains relevant, reviewed_at, review_needed, optional valid_for_year and official references. No current-law claim before official-source verification. Historical questions retain their original legal context.

## Statistics
Count unique question IDs and unique seasons separately, including MC/U, first/last seen and recent seasons. Configurable relevance uses question count, distinct-season coverage and recent-season coverage; display ordinal labels only. Parent totals union child question IDs. Multi-topic counts do not add up to library totals. Show coverage and unclassified count alongside frequency to avoid suggesting exhaustive knowledge.
Personal statistics read existing valid formal result stream, filter discarded/deleted/invalid sessions and solution-only visits, deduplicate mirrored results, take latest per question. Topic accuracy requires >=3 distinct valid questions, otherwise null. Partial is not correct. Wrong stages1–3 and persistent Unsicher are reconciled with existing rules; priority uses unique union when combining them. Gemeistert is separate. Recent practice is a tie-break, not an adaptive algorithm. Expose reasons and config thresholds. One next-focus CTA only; cold start recommends frequent unpracticed topic without a weakness claim.

## Training compatibility
Reuse TrainingStore and TrainingWorkspace. Extend TrainingDefinition with optional wisoTopicIds. Omitted/empty field must serialize EXACTLY as old definition keys. Nonempty topic IDs sorted/deduped and namespaced via field. Existing runs/snapshots immutable; same topic filter resumes; new runs use current production pool only. No change to ModuleProgress, Attempts, Notes, WrongQuestionState or TestSessions semantics. Classification overrides stay in technical-review storage, separate from learning progress.

## UI
Main WiSo Fokus entry and small dashboard link. Overview: WiSo KPIs, 5–8 frequent topics, one next focus, sufficient-data weak topics, compact season heat table. Detail: frequency/provenance/personal metrics, short Merkwissen, supported exam patterns, original-question training CTA. No flat question list. Mobile tables scroll within container. Review link exposes text/classification exceptions and source crops. WiSo topics added inside existing collapsed classification editor below note.

## Validation and rollout
Tests: missing text, cache skip, source changes, locked overrides, add/change/remove production fixtures, unique-season frequency, low-sample accuracy, invalid tests and solution-only exclusion, overlap counts, old TrainingKey golden identity, resume immutable snapshot. Browser: overview/detail/train/resume/editor/legal label/desktop+390px no overflow. Record baseline source hashes and personal-code scope; production source data must remain unchanged. Report extraction/classification coverage honestly. Verify official legal sources before current-valid labels. Run full tests/build, CI, Pages and live checks.

## Self-review
No placeholders. Explicitly separate legal summary/current law from historical official answers. Old key compatibility fixed as byte-for-byte requirement. Missing text does not disappear. User-approved workflow overrides additional design approval gates. No destructive migration required.
