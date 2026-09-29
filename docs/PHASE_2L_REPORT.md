# Phase 2L — Sommer 2021

## Manual confirmation completed — 2026-09-29

User export validated against source, crop, parser and evidence hashes: FA Q4=1, FA Q23=2, WiSo Q18=4. All locked with manual_source_review. FA now 36 questions, MC28/28, U8/8; WiSo24 questions, MC18/18, U6/6. Both registered in production. Original detector outputs, crops and audit history retained. This promotion rendered0 pages and opened0 PDFs. Prior review statistics below describe the initial gate, not current status.


| Module | Questions | MC reliable | U solution crops | Needs Review | State |
|---|---:|---:|---:|---|---|
| Arbeitsplanung | 36/36 | 28/28 | 8/8 | None | Production |
| Funktionsanalyse | 36/36 | 26/28 | 8/8 | Q4, Q23 | Manual source confirmation required |
| WiSo | 24/24 | 17/18 | 6/6 | Q18 | Manual source confirmation required |

Reused portrait-explicit-regions, official-ring-grid and cached U extraction. New source/hash-bound configs; no global threshold relaxation, duplicated parser or inferred answer. FA Q4/Q23 have no unique circle at both thresholds; WiSo Q18 has insufficient margin. Strongest candidates are advisory only, not accepted.

87 new pages rendered once: AP23 + FA30 + WiSo16 + shared Lösung17 + external drawing1. All69 question pages classified and all96 final question crops reviewed. Old PDF rescans0. Six repeated layout/answer calls and six cache calls skipped with PDF/archive opening forbidden.

AP U1-U3 explicitly reference the separately supplied Stirnradgetriebe drawing (Blatt1von2 including Stückliste). It is stored once as a shared attachment with SHA-256 and exact source page/bbox. AP U6 references included Blatt2von2. FA U4 uses included Typische Lastfälle sheet. No missing materials found. FA U1/U2/U4/U7/U8 and WiSo U1 continuation ownership is explicit. AP official U2/U5 solutions span pages.

Pre-release visual QA corrected the drawing's display orientation with an exact180° rotation of the immutable original derivative. Both images and hashes retained in attachment_presentations.json; every Source Registry gate/event remains unchanged. This affects presentation only, not source identity or question regions.

AP is registered for free practice, Originalprüfung and Module Test. FA/WiSo are not registered and cannot enter test pools. Module order remains AP→FA→WiSo. Existing production module registrations and historical source records compare equal to pre-task HEAD; old exam data and personal storage/sync models unchanged.

Browser (isolated profiles): AP MC/U and refresh; Originalprüfung with mapped drawing and hidden answers; all/single/multi-year filters; new progress0/36; prior note/progress preserved; new note survives retry; mobile390px without horizontal overflow; three source crops verified in review with no preselected answer; WiSo accurately displays17/18. All-year test samples need not contain every season, but the eligible module registry includes Sommer2021. Single/multi filters contain exactly selected seasons.

Validation: Python120 tests; Vitest124 passed,3 emulator-only tests skipped locally; production build passed. Independent read-only review passed after orientation correction. CI executes emulator tests.

Review: https://neroclaud2015.github.io/AP2/?view=answer-review&scope=sommer-2021
AP: https://neroclaud2015.github.io/AP2/?view=study&exam=2021-sommer&module=arbeitsplanung&q=1
Evidence: https://neroclaud2015.github.io/AP2/evidence/sommer2021/

Stop for actual user confirmation of FA Q4/Q23 and WiSo Q18. Export confirmations JSON and return it for source-bound import. No real confirmations performed by the agent. No Winter2021/22 or later processing, Firebase activation or learning algorithm changes.
