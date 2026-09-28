# Phase 2J — Winter 2019/20 acceptance report

Scope: Winter 2019/20 only. Stop awaiting FA Q21 source confirmation. No Sommer2020+ PDFs opened. Firebase remains implemented but not configured.

| Module | Questions | Reliable MC | U original crops | Needs Review | Production |
|---|---:|---:|---:|---|---|
| Arbeitsplanung | 36/36 | 28/28 | 8/8 | 0 | Ready |
| Funktionsanalyse | 36/36 | 27/28 | 8/8 | Q21 | Not registered |
| WiSo | 24/24 | 18/18 | 6/6 | 0 | Ready |

FA Q21 has no_unique_circle / threshold_disagreement. Strongest candidate is displayed only as machine evidence; no selection was accepted. Actual user confirmations: **0**. Open the review link, select the observed circle, save, export JSON and return it for source-bound promotion. AP and WiSo are independent of this gate.

- Review: https://neroclaud2015.github.io/AP2/?view=answer-review&scope=winter-2019-20&item=2019-20-fa-p12-21
- Evidence / all question previews / full physical-page ownership / official overlays and U crops: https://neroclaud2015.github.io/AP2/evidence/phase2j/
- AP: https://neroclaud2015.github.io/AP2/?view=study&exam=2019-20-winter&module=arbeitsplanung&q=1
- WiSo: https://neroclaud2015.github.io/AP2/?view=study&exam=2019-20-winter&module=wiso&q=1

## Source and layout evidence

Four physical PDF sources registered as six module-specific source records. 79 physical pages cached once: AP25, FA26, WiSo15, shared Lösung13. Existing `portrait-explicit-regions` and `official-ring-grid` engines reused unchanged. New hash-bound coordinate configurations use version2j.1.0. Circle thresholds unchanged. All96 printed question headings individually checked; no missing/duplicate anchors.

FA U2 explicitly spans physical pages19–20, with printed subpart3, continuation instruction and U2 scoring box. AP Q20/Q21 share diagram on page8; FA Q4/Q5 share drawing/table on page5; FA Q14 references drawing on page10. These are source-bound shared context attachments, not guessed ownership. AP includes mechanical/parts drawing23, hydraulic24 and electrical25. WiSo contains statutory attachment15 for U2/U3. No missing required attachment found in this season.

22 U official source crops retain full printed cell contents, formulas, tables and diagrams. Whole-question self-assessment only; no inferred scoring/numeric rubric. Durations105/105/60 minutes are printed on each module's physical page2.

## Preservation and resume

Baseline34fca64f79fda6170c1eb4164205aeefebbbb17c. All30 prior Source Registry objects exactly unchanged. Existing exam JSON, question/answer assets, manual confirmations and personal storage/sync implementation unchanged. No user IndexedDB was accessed. Browser tests use disposable contexts. Sommer2018 AP/FA remain blocked by missing Stückliste/Anlage.

All12 repeated cache/layout/answer steps return skipped under a guard that raises if `pymupdf.open` is called. Old PDF rescans0. New registered cache checkpoints retain source SHA256, geometry and artifact hashes; layout and official checkpoints retain config/version/revision. FA machine state remains blocked; never erase it to simulate acceptance.

## Validation

- 108 front-end tests passed;3 Firebase emulator tests reserved for CI.
- 103 Python tests passed; Source Registry validates15 production modules /36 source records.
- Production build passed.
- 12 isolated study/original-exam/filter browser checks passed for AP/WiSo: MC grading/source, U self-assessment/refresh, exam answers hidden, all/single/multiple year source_mix.
- All six seasons preserve AP → FA → WiSo; FA unavailable card cannot launch an exam.
- AP Q20 links correct shared diagram. Legacy8-item review URL works.
- Q21 original image hash verification, no candidate preselection, local save/refresh and scoped export verified using synthetic throwaway browser records only. These are **not user confirmations** and were not imported.
- Read-only final review found no P1/P2 issue.

Release commit and CI/Pages run URLs are provided with the delivery message after deployment. Stop here; do not continue later seasons.
