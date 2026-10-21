# WiSo Fokus Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans task-by-task.
**Goal:** Deliver source-backed WiSo topics, review cards and original-question training.
**Architecture:** Build-derived JSON, pure read-only analytics, existing training store with backward-compatible optional topic filters.
**Tech Stack:** Python/PDF/cached OCR, TypeScript React, Vitest, Playwright, existing IndexedDB.
**Spec:** docs/superpowers/specs/2026-10-21-wiso-focus-design.md
## Global constraints
Original source datasets and personal records immutable; old Training Key byte-identical. No cloud activation. Legal current-valid only after official verification.
## Review focus
- Sparse/OCR-broken text must not fabricate topic evidence.
- Parent/multi-topic totals deduplicate.
- Deleted tests must not retain weakness influence.
- Missing optional filter leaves old keys identical.
- New source revision cannot replace human lock.
## Task 1 — derived data
- [x] Add tests and scripts/wiso_pipeline.py for inventory/revision/cache/fallback/reconciliation.
- [x] Produce public/data/wiso_focus.json with taxonomy, texts, classifications, summaries/config and evidence; use existing cropped images, no original writes.
- [x] Verify coverage and duplicate run, record source baseline.
## Task 2 — analytics and compatible training
- [x] Add src/wiso/model.ts and model.test.ts for frequency/personal priorities and overrides.
- [x] Extend src/training/model.ts optional wisoTopicIds; golden-test old keys, empty field and topic resume.
- [x] Return deriveWiso(inventory,dataset,snapshot,userId,now) and topic training definition helper.
## Task 3 — UI integration
- [x] Add src/wiso/WisoFocus.tsx/css + data hook and topic editor; integrate root route/nav/dashboard.
- [x] Reuse TrainingStore/TrainingWorkspace for topic-filter snapshot launch; no second learner.
- [x] Technical review exceptions and legal/provenance labels, compact responsive tables.
## Task 4 — review and deploy
- [x] Review each component against spec, run unit/Python/build checks.
- [x] Browser desktop/mobile training/resume, old keys, source invariance and mock change evidence.
- [ ] Commit/push, CI+Pages, live validation and report coverage/links/screenshots.
