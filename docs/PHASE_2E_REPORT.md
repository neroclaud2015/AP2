# Phase 2E acceptance report

Scope completed: Test/Originalprüfung record lifecycle and Winter 2017/18 Arbeitsplanung, Funktionsanalyse, WiSo. No Sommer 2018, taxonomy, generated questions, or adaptive weighting.

## Dataset

| Winter module | Questions | Official MC | Official U crops | Needs Review | Verified time |
|---|---:|---:|---:|---:|---:|
| Arbeitsplanung | 36 (28+8) | 28/28 | 8/8 | 0 | 105 min |
| Funktionsanalyse | 36 (28+8) | 28/28 | 8/8 | 0 | 105 min |
| WiSo | 24 (18+6) | 18/18 | 6/6 | 0 | 60 min |

AP promotion reuses the accepted 36 crop bytes and original IDs. FA validates 24 physical pages; WiSo validates 13. Original pixels, explicit region ownership, source hashes, page/bbox and version/config checkpoints are retained. Circle answers use deterministic geometric measurements; U answers remain original solution crops with self-assessment. No inferred scoring rubric or AI answers.

The three Sommer datasets and existing question IDs/crops/answers are unchanged. New source identities include exam, module and global question ID. Original exams use only their real module; seeded module tests draw from both available seasons, retain source exam per question and contain no duplicates.

## Local record lifecycle

Statuses: active, paused, completed, abandoned, discarded. Existing submitted records migrate losslessly to completed. Explicit confirmation is required for discard and permanent delete. Discard preserves the internal record, hides it from default history and Dashboard, and excludes it through the shared isEligibleForAnalysis predicate. An explicit discarded view allows permanent deletion. Revision checks reject stale confirmations from another tab. Deletion affects only the selected test and its nested records; ordinary practice, review overlays and other tests remain intact.

Browser acceptance uses isolated profiles, never the user's personal database. The lifecycle suite covers active/paused/completed cases and a completed Modultest, default history visibility, reload, two-tab conflict, permanent deletion, and unchanged ordinary practice/other sessions. Navigation evidence demonstrates Winter AP original exam pause/reload/resume, MC/source/U self-assessment, and an eight-question AP module test containing both Sommer and Winter with source provenance and a completed result.

## Resume and integrity

Completed module runs verify source/config/profile versions and published artifact hashes before skipping. No completed PDF is reopened. Official answer caches additionally bind the accepted formal segmentation, crop bytes and region ownership; tampered artifacts are rejected. Tests deny PDF/cache access during completed skip checks. Private source caches are excluded from the public repository.

## Source access limitation

Automatic approval review rejected publishing complete Winter solution PDFs, the complete Winter AP PDF, and the complete Winter WiSo PDF/pages. The site therefore publishes authorized question and answer crops with provenance. Winter AP can also link to its already-published page evidence; FA's approved original PDF is available. WiSo whole-page crop editing is unavailable, explicitly shown in Review; number/text/tags/answer review remains available. Official solution images and WiSo's necessary U6 attachment excerpt and timing proof are available.

## Acceptance links

- Dashboard: https://neroclaud2015.github.io/AP2/?view=start
- Winter AP: https://neroclaud2015.github.io/AP2/?view=study&exam=2017-18-winter&module=arbeitsplanung&q=1
- Original exams: https://neroclaud2015.github.io/AP2/?view=exams&exam=2017-18-winter&module=arbeitsplanung
- Cross-season module tests: https://neroclaud2015.github.io/AP2/?view=tests&exam=2017-18-winter&module=arbeitsplanung
- Evidence: https://neroclaud2015.github.io/AP2/evidence/phase2e/

Stopped after these three Winter modules. No further archive processing is scheduled.

Verification before release: 72 Python tests, 39 frontend tests, production build, 14 lifecycle browser checks, 7 navigation checks and 8 Winter FA/WiSo browser checks passed.
