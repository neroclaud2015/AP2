# Phase 2I.1 — Official answer manual source review

Review URL: https://neroclaud2015.github.io/AP2/?view=answer-review

1. The eight items are AP Q3/Q9/Q10/Q22/Q24 and FA Q7/Q21/Q27, all Winter2018/19.
2. Inspect the original official crop. Row1 at top means answer1, through row5 at bottom. Numbered labels match source geometry. Open the original crop or full grid when needed.
3. Select1–5 and click **Speichern**. The strongest ring-density candidate is not preselected or accepted. Previous/Next move through all8. Unsaved choices require explicit discard before button navigation.
4. Saved choices persist in the existing local answerReviews table. They are confirmed, user_corrected, locked, confirmation_method=manual_source_review. Machine measurements and source pixels remain untouched. No attempts/testSessions or question edits are changed.
5. Export **Bestätigungen exportieren** and return the downloaded `winter-2018-19-answer-confirmations.json` in this chat. It contains only source-bound confirmations, no user ID or learning history.
6. Pages is static and Firebase is not configured. Saving locally does **not** publish a global official answer. The agent runs the validated importer and deploys after receiving real user selections. No GitHub credentials or keys belong in the page.

## Import and automatic promotion

`python scripts/manual_answer_promotion.py <confirmation-export.json>` validates without writing.

`python scripts/manual_answer_promotion.py <confirmation-export.json> --apply` persists validated confirmations, then automatically promotes each complete module independently (28 unique MC answers +8 U source crops). No extra manual module registration or page duplication is required. Missing confirmation keeps that module blocked. Wrong source hashes, crops, machine evidence, identities, duplicates, values or lock metadata reject the whole import before writes.

The importer retains original `_answers.json`, segmentation, crops, machines' registered manifests and all historical gate events. It creates separate `_reviewed_answers.json`, `data/reviews/official_answer_confirmations.json`, `data/ingest/manual_answer_promotion_manifest.json` and appends complete modules to `public/data/promoted_modules.json`. Existing accepted provenance gates are never overwritten; the narrowly scoped answer blocker gets an appended manual-resolution event and new validated/production gates. Old production sources are unchanged.

Repeated identical import is idempotent. An already imported manual answer is locked; conflicting import fails. A new parser result cannot overwrite it. `merge_confirmed` preserves the selected answer and flags `machine_suggestion_changed` when evidence differs. Existing extraction writes only the immutable machine artifact, whereas promoted modules read the separate reviewed artifact. Any changed source binding requires explicit review before publication; it cannot silently clear the gate.

After real import: run Python/frontend tests, source registry validation and build; inspect prepared registration and data; update INGESTION_STATUS/Phase2I.1 report; commit/push main and dispatch Pages. Stop afterward; no later exam seasons or PDF scans.

## Current acceptance state

- Actual user confirmations: **0/8**, awaiting user.
- AP reliable official coverage: **23/28**, U8/8, still blocked.
- FA reliable official coverage: **25/28**, U8/8, still blocked.
- Actual production promotion this phase: **none yet**.
- Browser acceptance uses isolated **synthetic** selections only. These are not official answers and were never imported into the real repository.
- Tested: no candidate preselection; all8 save/reload; export contains only confirmations; changed machine preserves lock; corrupt source image disables save; mobile no overflow; old learning/test/review records unchanged.
- Temporary-repository tests: complete and partial per-module promotion, immutable machine data, original production sources unchanged, idempotence, invalid/stale/duplicate inputs rejected, no PDF access.

Independent review found a missing FA Q13–15 shared-source entry in the proposed promotion. Fixed through data-driven questionContextPages from already validated attachment ownership. Temporary-repository browser test verifies page8 in both Study/Originalprüfung, and AP/FA cross-season module tests. Synthetic confirmation fixtures are never used for official publication.

Validation:100 frontend tests and99 Python tests passed; production build passed (existing bundle-size warning). Existing1657 data/asset/profile files and complete Source Registry unchanged. Production remains8 modules/240 questions. Final independent review reports no outstanding P1/P2.
