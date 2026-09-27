# Phase 2B.1 controlled layout validation

Scope: only Sommer 2017 Funktionsanalyse, Sommer 2017 WiSo and Winter 2017/18 Arbeitsplanung. Existing Sommer AP is a frozen regression target. No navigation or module tests.

Design: generic checkpoint/evidence engine plus hash-bound layout profiles. Profiles own geometry, heading detection, region construction, numbering and explicit continuation ownership. Unknown source/geometry fails closed. Version/config/source hashes isolate validation revisions. New region objects carry page, bbox, role and owner anchor; unresolved ownership remains null and needs_review. Old records and browser overlay keys stay unchanged through an adapter.

Implementation sequence:
1. Snapshot legacy assets and write contract tests.
2. Move AP layout decisions into its profile while preserving old exports, configuration hash and outputs.
3. Add independent FA/WiSo/Winter validation profiles; inspect every physical page, save anchors/overlays/contact sheets and explicit unresolved cases.
4. Checkpoint every page and module, validate resume and source rejection. Publish no formal question records unless all structural gates pass; Winter remains validation-only.
5. Run legacy regression, independent review and produce module reports. Stop for user acceptance.
