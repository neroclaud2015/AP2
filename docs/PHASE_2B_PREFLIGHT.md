# Phase 2B — preflight stopped

Status: blocked at layout compatibility check; Phase 2B is not complete.

## Authorized scope
Existing Sommer 2017 Arbeitsplanung; additions limited to Sommer 2017 Funktionsanalyse, Sommer 2017 WiSo, Winter 2017/18 Arbeitsplanung. No other years/modules or taxonomy.

## Read-only findings
Inspected physical PDF pages 2–4 of cached Sommer 2017 Funktionsanalyse and WiSo. Both are imposed landscape sheets (1190.4 × 841.44 PDF points). Funktionsanalyse shows a broadly similar band layout, but full compatibility has not been established.

WiSo source: public/assets/pdfs/35f662246f2737dba0b61b88.pdf, physical page 4. The U1 heading bbox is [64.8000, 64.5825, 85.8870, 87.2535]. Existing scripts/segment.py recognizes U headings only when bbox top < 60 and assigns the entire booklet half. This heading therefore fails the existing U detection rule. Visual inspection also shows a response area continuing at the top of the right half above Q15/Q16, requiring explicit continuation ownership rather than automatic inheritance from the Arbeitsplanung grid. Existing rules have not established that ownership.

This is a concrete incompatibility, not merely a different module name. Do not loosen a threshold and claim complete support without validating U question/continuation boundaries and the module-specific structure.

## Stop decision
Per the requested stop-on-incompatible-layout gate, stopped before generating any new segmented records or answer mappings. Winter archive was not processed. No existing question IDs, manifests, personal overlays, application code, or deployed site were changed by this preflight. No new module is declared ready.

## Outstanding work
A separately validated WiSo layout profile is needed before this module can proceed. Funktionsanalyse and Winter Arbeitsplanung still require complete compatibility validation. Data registry, navigation, deterministic module tests, IndexedDB test records and Phase 2B acceptance demonstrations remain unimplemented. Existing Phase 2A functionality is retained.
