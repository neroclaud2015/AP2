# Phase 0–1 execution ledger

Authority: ../AP2_MASTER_PLAN.md in the source workspace. Only 2017 Sommer is authorized for ingestion. Stop after prototype verification.

Ruling: The requested AP2/_MASTER/_PLAN.md does not exist; the root AP2_MASTER_PLAN.md contains the matching Phase 0/1 requirements and is the specification.
Ruling: Create a dedicated ap2-study repository on a prototype branch, since the workspace contains only source ZIPs and a plan. Keep ZIPs untouched.
Ruling: Existing approved master plan supplies architecture; implement React/TypeScript/Vite, local IndexedDB behind interfaces, Python page checkpoints, and conservative question proposals. No new design approval needed.

Tasks:
1. Establish skeleton, schemas, storage interfaces and Pages workflow.
2. Implement single-season ingestion with immutable source extraction, page images, raw text, proposed questions and solution mappings, durable checkpointing and review queue.
3. Browse the complete pilot exam, validate sources and demonstrate interruption/resume and unchanged-file skipping.
4. Review, report limitations, stop. No Phase 2/3 or bulk ingestion.

Deployment: Configure workflow locally; live GitHub Pages requires a repository destination and publication authorization. Do not claim live deployment without evidence.

Task 1: local skeleton/schema/storage complete; storage test red then green; TypeScript/Vite build passed.
Task 2: single-season ingestion implemented; four initial tests red then green; actual pilot stopped after 3 pages, resumed 45; unchanged rerun skips 4 PDFs.
Task 3: browser checks passed all 48 page images and PDF anchors, question and review links, mobile layout. Data validator: 0 structural errors, 248 content warnings.
Final review: independent reviewer found interrupted PDF copy and stale derived counts. Both reproduced, fixed and verified by a green 6-test Python suite.
Ruling: image-only pages remain visible and queued for OCR; noisy/spread-based question extraction remains unverified. Cost: not a validated question bank; no bulk ingestion permitted.
Ruling: user supplied https://github.com/neroclaud2015/AP2 for deployment verification. Repository is currently empty and private; preserve visibility.
