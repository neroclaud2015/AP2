# Phase 2I.2 — Module order + Sommer 2019

Module order is explicitly defined as Arbeitsplanung(10), Funktionsanalyse(20), WiSo(30). Dashboard, Lernen, Originalprüfungen, Tests and the study selector use this metadata, including unavailable positions. Sommer2018 AP/FA remain blocked with “Fehlende Stückliste / Anlage”; no missing attachment was invented.

| Sommer 2019 | Questions | MC answers | U solutions | Needs Review | State |
|---|---:|---:|---:|---:|---|
| Arbeitsplanung | 36 | 28/28 | 8/8 | 0 | Production |
| Funktionsanalyse | 36 | 28/28 | 8/8 | 0 | Production |
| WiSo | 24 | 18/18 | 6/6 | 0 | Production |

All three reuse portrait-explicit-regions and official-ring-grid engines, with separate source-hash-bound geometry configurations. Existing global thresholds and old profiles are unchanged. MC values come only from deterministic circle measurements. No manual answer confirmation is required this season; the existing Winter2018/19 review records and locks remain unchanged.

89 new physical pages cached once: AP25 + FA32 + WiSo18 + shared Lösung14. No previously completed PDF reopened. A repeat run with PDF opening forbidden skipped all 12 source/layout/answer steps. Source hash, profile version, config hash and page/module checkpoint are retained. Later archives were not opened.

FA physical pages19/20/23/24 duplicate pages17/18/22/21: printed task labels, subquestions, graphics and printed page numbers were compared; duplicate pages are retained in cache and overview, not given extra question IDs. FA Q3/Q5 have explicit separate diagram regions. WiSo U2 continues on page7, U3 on page9, with printed Ergebnis U2/U3 ownership evidence. WiSo U5 retains original sideways layout; readable original-image zoom is available. U answers use whole-question self-assessment, without inferred scoring rules or numeric auto-grading.

Final U solution crop borders were visually corrected before deployment. Original machine outputs and all original validation gates are retained unchanged; separately reviewed U files and source-bound config/crop hashes are recorded at the append-only production gate. The production reader accepts paths bound by either prior validation or final publication, and the offline validator checks hashes for both. Unbound paths and changed final crops are rejected by regression tests.

Preservation: all24 prior source records unchanged; all existing question IDs, crops, answers, review-ledger files, personal storage and sync implementation unchanged. No IndexedDB migration. Current production total: 13 modules / 408 questions.

Validation evidence:
- browser/checks.json: 16 existing-season page order checks plus unavailable selector.
- browser/sommer2019-checks.json: 18 new Study / U self-assessment / refresh / Originalprüfung / all-single-multi-year test checks, all isolated browser contexts.
- resume.json: cache/layout/answer skip verification with PDF-open guard.
- preservation.json: old dataset/source preservation check against baseline272187a.
- ap/, fa/, wiso/: every question crop, all physical page ownership overlays, MC detection overlay, final U solution crops.

Sommer 2019 is the completed acceptance batch. Stop here for user review; Winter2019/20 remains pending. Firebase remains implemented but not configured. No taxonomy, mastery, adaptive planning or AI generation.

Final pre-release verification: 106 frontend tests passed (3 emulator tests reserved for CI), 100 Python tests passed, TypeScript/Vite build passed, independent bounded code review found no P1/P2 issues. Source validator:13 modules/30 sources/0 PDFs opened.
