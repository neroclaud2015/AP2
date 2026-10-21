# WiSo knowledge recency — approved extension

Current Merkwissen uses the newest verified, applicable knowledge. Historical frequency is not evidence of current legal validity. Exam questions, official answers, scoring and personal learning records remain immutable.

Complete-topic knowledge revisions live in `scripts/wiso_knowledge_versions.json`. Each revision has an ID, effective_from, exclusive effective_until, source_exam_season, verified_at, verified, current, supersedes, bullets and official references. Unknown dates remain null. A verification date is never substituted for a statute's commencement date. Current is resolved at build time, with client-side expiry/boundary protection.

Explicit supersedes links preserve prior versions. Multiple unrelated applicable revisions, uncertain successors, missing verification/references or expired versions require review and produce no current bullets. Future versions do not prematurely replace today's valid version. Frequency does not participate in selection. If a known effective boundary passes after deployment, the page suppresses current claims until refreshed data is published.

Existing seven verified cards are imported as verified knowledge snapshots, with their original official citations and verification dates. No historical legal values or statutory commencement dates are invented. Unverified historical summary bullets remain separately accessible and cannot appear as current Merkwissen. Review includes unresolved knowledge topics.

The WiSo overview/detail explains the policy. Topic cards show Aktuell or Prüfung offen; historical revisions remain under Historischer Stand. The source crop links retain their exam-season labels. General question data, official answer data, Training Key and frequency classification are unchanged.

Self-check: no migration/deletion, no new legal factual claims, no majority vote, no invented conflict history. Regression tests cover explicit replacement, uncertain successor, unrelated conflicts, future/expired rules, missing references and unknown dates. Browser acceptance covers current verified card, unverified historic card and unchanged topic training.
