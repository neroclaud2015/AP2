# Phase 3D.1 — approved WiSo memorization extension

User specification is the design authority; prior authorization permits self-check, implementation, acceptance and deployment without another approval. No personal-data migration or Training Key change.

## Contracts / self-review
- Ordinary classification confidence >=.95: machine_accepted_high_confidence, unlocked. [.80,.95): machine_suggested, usable without manual review. Below .80 or missing topic: classification review. Human locks remain higher priority. Do not convert OCR confidence into classification confidence or inflate scores to hit a quota.
- Independent legal_review: validity, conflict, unclear dates, supersession, contradictory evidence cannot be auto-approved by classification confidence. Existing verified-as-of facts remain scoped; unknown commencement dates remain unknown.
- Improve unmatched stem rules with explicit evidence, preserving distractor exclusions. No PDF rerender, no answers changed. Report actual before/after and operational (not calibrated probability) confidence limitations.
- Topic flow: compact header, Merkwissen, direct-answer native details cards, existing original-question training, folded historical/context/statistics. Overview cards emphasize recall. Nur Merkwissen is URL-persistent and read-only.
- Review cards bind verified summary version + historical question IDs. Do not infer an answer from a pattern alone. Only verified, current card content is shown as current; unresolved knowledge remains honestly unavailable/reviewable. Never generate formal Attempts or write any learning entity from card disclosure.
- Data-driven content/taxonomy; preserve legal recency logic, historical evidence and classification overrides.

## Tasks
1. Classification policy and evidence rules: scripts/wiso_pipeline.py + tests, derived dataset/report. Validate boundary scores, legal separation, lock preservation, count reduction without fake confidence.
2. Recall content: source-backed JSON cards and concise summaries, official-source verification for legal additions, version-bound provenance, tests for references and missing/expired summary.
3. UI: separate read-only recall component, compact WisoFocus, URL mode, existing training integration unchanged. Tests for Q&A/route and zero write behavior.
4. Full tests/build, browser desktop/mobile and IndexedDB unchanged before/after recall. Commit/push Pages, verify live, report screenshots/counts/limitations.

## Execution ledger
Initial ruling: preserve existing branch/workspace and source caches; this task extends the already approved WiSo work. Three independent ownership areas with final integrated review. No new backend or archive processing.
