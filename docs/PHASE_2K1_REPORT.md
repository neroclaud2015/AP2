# Phase 2K.1 — Shared M3 proposal, awaiting human confirmation

The new source-bound AP profile candidate is `portrait-explicit-regions@2k.1.2-858b8b40d916`, superseding the blocked draft `portrait-explicit-regions@2k.1.0-6c3034f72486` only after human review. The old configuration, failed geometry report, source profile binding, blocked event, and all existing gates are unchanged. Two `profile_revision_proposed` events were appended to the AP source. No rollback.

Q7/Q8 anchor identities are unchanged. Final visual review found the old draft Q7 primary crop truncated option5 and Q8 included its tail. The second candidate corrects their boundary using the original ruled line at cached pixel rows751–752; the first candidate 2k.1.1-45d5abe596d9 is preserved unchanged. M3 is one `shared_context` attachment with explicit references from 7 and 8. Generic shared-region proposal/confirmation validation is independent of year-specific parsing. The existing segmentation and answer engines are unchanged.

## Current gate

- Structural validation: 36/36 anchors, no missing/duplicate/overlap issues.
- Human shared-region confirmation: pending.
- Formal AP segmentation: not run.
- AP MC/U extraction: not run; no coverage claimed.
- AP production: not released.
- New PDF renders: 0; old PDF rescans: 0.
- Cached pages reused: 30. Unchanged page checkpoints reused: 29; only page5 layout changed.

Review page: https://neroclaud2015.github.io/AP2/evidence/phase2k1/

The page verifies the three source-image hashes before enabling review. Confirm both statements and choose Bestätigen; it stores the acknowledgement locally and downloads `sommer-2020-ap-shared-region-confirmation.json`. Mapping ändern exports a needs_review change request; a changed mapping cannot pass the confirmation validator. No IndexedDB learning records are accessed.

After the user supplies the downloaded confirmation, import it using `scripts/shared_region_review.py --proposal docs/evidence/phase2k1/revised/proposal.json --confirmation <file>`. The importer checks source/config/image/revision bindings, saves immutable confirmation evidence, and appends a confirmation event. It deliberately does not remove blocked history or automatically release AP. Resume activation and the remaining segmentation/answer/production gates occur after actual human confirmation, preserving old gates and revisions.

Evidence: `old-audit-snapshot.json`, `proposal.json`, `validation.json`, `ownership-overlay.jpg`, `Q7.png`, `Q8.png`, `shared-m3.png` in the review directory. Stop here awaiting the required human source review. No Winter2020/21 processing.

Validation: 110 full Python tests passed before the final trust-boundary regression; all 5 focused revision tests then passed. Production build passed. Six isolated browser checks passed (desktop/mobile, download, reload, changed mapping and tampered image). Browser-generated confirmations were simulated and never imported as human approval. Imported proposals must match both canonical proposal hash and latest registered file digest/path.
