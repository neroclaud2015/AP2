# Sommer 2022 release (2026-09-29)

| Module | Questions | MC | U | Needs Review | Status |
|---|---:|---:|---:|---:|---|
| Arbeitsplanung | 36/36 | 28/28 | 8/8 | 0 | Production |
| Funktionsanalyse | 36/36 | 28/28 | 8/8 | 0 | Production |
| WiSo | 24/24 | 18/18 | 6/6 | 0 | Production |

Reused portrait-explicit-regions and official-ring-grid. Source-specific configuration only; ring thresholds unchanged. All physical pages classified. AP Bild A (p4) shared by Q3/Q4, hydraulic attachment p33 for U5; explicit continuations AP U1/U2 and FA U7/U8. No missing materials or separate official errata in supplied archive.

New cached pages: AP34 + FA28 + WiSo20 + Lösung15 =97. Old PDF rescans0. Duplicate run12 steps skipped,0 renders, with PDF open mocked to fail.54 previously production source records unchanged; existing tracked datasets unchanged. Only isolated browser contexts used, never real personal IndexedDB.

## U solution boundary review

Initial answer extraction retained immutable. User authorized a narrow pre-production review flow. AP U1/U4 headings restored; FA U5/U6 separator corrected. Maximum25 PDF points, vertical only, same page/count/source/identity. Reviewed U datasets and crops stored separately; production proof references the review plus original artifacts. No MC changes, no rubric inference. Seven safety tests cover bounds, ownership, immutability, cache binding and production rejection. Read-only code review completed; findings fixed.

Repeated import of actual winter-2021-22-answer-confirmations.json is idempotent: FA Q23=3, Q24=3, Q26=4 locked/manual_source_review; FA36 MC28 U8 now Production.

## Validation

133 Python tests passed.124 frontend tests passed;3 Firebase emulator tests skipped locally (CI runs emulator). Build passed.18 browser workflow/filter checks passed. Mobile/isolation evidence is under docs/evidence/sommer2022/browser. Production source validator:31 modules,68 source records,0 PDFs opened.

## Links

- https://neroclaud2015.github.io/AP2/evidence/sommer2022/
- https://neroclaud2015.github.io/AP2/?view=study&exam=2022-sommer&module=arbeitsplanung&q=1
- https://neroclaud2015.github.io/AP2/?view=study&exam=2022-sommer&module=funktionsanalyse&q=1
- https://neroclaud2015.github.io/AP2/?view=study&exam=2022-sommer&module=wiso&q=1

Stop after Sommer2022; no Winter2022/23 processing.

## Resume

Use registered_ingest.run_layout(...,promote=True) and run_answers with sommer2022_* configs. Existing steps skip. For AP/FA production rerun, pass solution_review=data/reviews/2022-{ap|fa}-u-crop-review.json to promote_registered_modules.promote. Raw extraction remains immutable and should not be regenerated. WiSo uses normal promote. Audit manifest and published reviewed solution revisions must not be overwritten.

Browser isolation/mobile checks passed for all three modules. Winter2021/22 FA additionally passed six production flow/filter checks.
