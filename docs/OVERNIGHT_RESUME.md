# Overnight review / resume operations

- Resume checkpoints: `python scripts/resume_overnight.py`. Completed stages are integrity-checked and skipped; no PDF may be reopened. Layout-blocked FA stays blocked.
- Review UI: `?view=review-queue`. Export `overnight-review-confirmations.json` after source review.
- Validate exported bundle: `python scripts/import_overnight_review.py FILE.json`. The default is read-only. Use `--apply` only for the user's actual exported confirmations. Each scope retains its original source/crop/hash checks and locked confirmation ledger.
- Mapping decisions are exported but never silently applied. Sommer 2024 FA remains held by `data/ingest/overnight_promotion_holds.json` until an append-only reviewed attachment revision is implemented. Winter 2024/25 FA needs a boundary revision; its original bound profile and blocked event remain intact.
- After any future promotion, register its exam in the data-driven session list and rerun source validation/build/browser checks before deploying. Do not claim a module is publicly available just because the local review counter reaches complete.
- Official PAL notices are independent source artifacts. New notices use `official_corrections_overnight.json`; the old globally hash-bound notice file is unchanged. The FA U2.3 notice is in `pending_official_corrections.json` until formal question identity is confirmed.
- `MORNING_REPORT.md` and `docs/evidence/overnight/verification.json` contain this batch's acceptance evidence.
