# Overnight batch design and execution plan

User-authorized unattended execution, priority order: ingestion → unified human review → classification/bank → wrong questions → adaptive tests. Do not wait for human decisions overnight. Stop after all available sources <= Sommer 2025 have a known status; report lower priorities honestly if unfinished.

1. Inventory all ZIP directory entries without reopening old PDFs. Compare registry/production/checkpoints. Register/hash/cache only new PDFs; persist each page. Identify absent Sommer2025 explicitly.
2. For each new season inspect cached physical pages and official corrections, reuse source-bound existing engines. Primary owners unique; shared material referenced. Validate numbered anchors, crops, MC image geometry, U boundaries. Promote only fully safe modules, collect others with source-bound evidence; never relax thresholds or modify locked data.
3. Publish unified review-queue with issue type, exam/module/question, source hash/crop, proposed mapping, explicit confirmation/change/export. Human decisions do not silently publish. Missing sources need replacement, not fake confirmation. Resume from independent module checkpoints.
4. If ingestion/review complete: independent versioned taxonomy and classifications with canonical IDs and machine/human provenance. Question-bank filters retain original identity. Ambiguous classifications remain reviewable.
5. Then WrongQuestionState through personal repository/backup/sync: submitted wrong/partial only, two correct recoveries, hide without deleting attempts. Finally deterministic adaptive test selection with immutable question/config snapshots. No existing learning data mutations, Firebase configuration or generated exam content.

Validation: old registry records/datasets unchanged; no old PDF opens; repeat skips completed work; crop/overlay visual QA; relevant Python/TypeScript tests; isolated browser tests; main commit/CI/Pages and online checks. Morning report includes all statuses, exact review counts and completion/deferment per priority.
