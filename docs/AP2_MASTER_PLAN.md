0. Project Goal
Build a personal adaptive AP2 exam preparation web application based primarily on real historical AP2 exam papers and official solutions.
The system must help the learner:
- study historical exam questions;
- identify weak knowledge areas;
- track mastery over time;
- understand why questions were answered incorrectly;
- build an adaptive study plan;
- perform diagnostic self-assessments;
- simulate real exams under original exam timing;
- generate structured mock exams based on historical exam distributions;
- later generate carefully controlled AI practice questions;
- preserve complete traceability between extracted data and original PDFs.
This is not a generic AI quiz application.
The historical exam archive is the authoritative source.
1. Core Principles
These rules have higher priority than convenience.
1.1 Historical exams are the source of truth
Do not invent:
- exam topics;
- knowledge categories;
- scoring rules;
- official answers;
- exam structures.
Every extracted question must retain a reference to its original source.
Example:
Exam: 2023 Winter
Module: Funktionsanalyse
Question: 12
Page: 7
Source PDF: ...
1.2 Clearly separate official content from AI content
The UI must visually distinguish at least:
ORIGINAL QUESTION
OFFICIAL SOLUTION
AI EXPLANATION
AI PRACTICE QUESTION
USER EDIT
AI-generated content must never be presented as official exam material.
1.3 Human edits override AI
If the user manually corrects:
- question text;
- solution;
- topic;
- source mapping;
- scoring;
- metadata;
that edit becomes locked.
AI must never silently overwrite a manually edited value.
AI may only propose a change.
1.4 Uncertainty must be visible
Never guess uncertain OCR results or solution mappings.
Use review states such as:
confirmed
needs_review
low_confidence
user_corrected
If uncertain:
⚠ Needs Review
Preserve:
- original page/image;
- raw extraction;
- normalized extraction;
- proposed correction.
2. Critical Token-Saving Rule
This requirement is essential.
The complete PDF archive must never need to be scanned from the beginning again.
The ingestion process must be resumable.
3. Resumable PDF Ingestion Architecture
Create a persistent ingestion manifest.
Example:
data/
  ingest/
    manifest.json
    documents/
    pages/
    review_queue.json
Every source file must have a unique ID based on:
exam
module
filename
file hash
Example manifest entry:
{
  "file": "2019_20_Winter/Funktionsanalyse.pdf",
  "sha256": "...",
  "status": "complete",
  "pages_total": 14,
  "pages_processed": 14,
  "last_completed_page": 14,
  "questions_extracted": 23,
  "updated_at": "..."
}
Possible statuses:
pending
extracting
partially_complete
complete
needs_review
failed
3.1 Save after small units of work
Do NOT process ten years of PDFs in one uninterrupted operation.
Checkpoint after:
- each PDF at minimum;
- preferably each page;
- each extracted question batch.
If processing stops because of:
- token limits;
- context limits;
- crash;
- timeout;
- interrupted Codex session;
the next run must inspect the manifest and continue from the first unfinished item.
Never restart completed PDFs.
3.2 File hashing
Calculate a file hash for each source PDF.
If the PDF did not change:
DO NOT REPROCESS IT
Only reprocess if:
- file hash changed;
- user explicitly requests reprocessing;
- extraction version requires migration.
3.3 Store intermediate results
Never rely on the AI remembering previous processing.
Persist all results immediately.
Suggested structure:
data/
  exams/
    2017_sommer/
      arbeitsplanung.json
      funktionsanalyse.json
      wiso.json
      solution.json
Once a PDF is converted into structured data, later application development should use the structured data rather than rereading the PDF.
4. Original Archive Handling
Current structure resembles:
AP2 历年考试题/
  2017 Sommer....zip
  2017_18 Winter....zip
  ...
  2024_25 Winter....zip
Each ZIP contains a folder such as:
2017 Sommer/
  17 Arbeitsplanung.pdf
  17 Funktionsanalyse.pdf
  17 Lösung.pdf
  17 WiSo.pdf
4.1 ZIP strategy
Keep original ZIP files untouched.
Extract once into:
raw/
  2017_sommer/
  2017_18_winter/
  2018_sommer/
  ...
Never modify files under:
raw/
Treat raw/ as immutable source material.
5. Two-Layer Question Data
Maintain two distinct layers.
Layer 1 — Raw Extraction
Stores what was actually extracted.
Example:
{
  "raw_text": "...",
  "source_page": 4,
  "source_image": "...",
  "ocr_confidence": 0.82
}
Never overwrite this with normalized text.
Layer 2 — Normalized Question
Example:
{
  "question_id": "...",
  "exam": "2022 Winter",
  "module": "Funktionsanalyse",
  "question_number": "12",
  "question_text": "...",
  "points": 4,
  "primary_topic": "...",
  "secondary_topics": [],
  "official_solution": "...",
  "ai_explanation": null,
  "source_reference": {...},
  "review_status": "confirmed"
}
6. PDF Extraction Strategy
Use a hybrid extraction system.
Text
Extract text programmatically where reliable.
Do not use OCR when normal PDF text extraction works.
Diagrams, technical drawings and tables
Preserve original visual regions.
Especially preserve:
- electrical circuit diagrams;
- mechanical drawings;
- tables;
- technical symbols;
- formulas;
- diagrams.
Do not attempt to rebuild these visually unless necessary.
Questions may therefore contain:
question_text
+
question_image
7. OCR and Extraction Errors
If extraction is uncertain:
Store all three:
original visual
raw extraction
normalized/proposed value
Allow user confirmation.
Never silently fix uncertain numbers such as:
0.5
0,5
5
50
or electrical/technical symbols.
8. Solution Matching
Try deterministic matching first:
question number
module
page structure
solution numbering
If matching confidence is low:
add it to:
Review Queue
Example:
Question 17
Possible solution: 17
Confidence: 63%

[Confirm]
[Change]
Do not automatically accept uncertain mappings.
9. Editing During Learning
If the user discovers during normal practice that:
- question is wrong;
- solution is mapped incorrectly;
- topic is wrong;
- points are wrong;
provide an Edit function directly from the question page.
User corrections must become:
user_corrected = true
locked = true
10. Question Metadata
Where available store:
exam season
year
module
question number
page
points
question type
primary topic
secondary topics
official solution
accepted-answer notes
source image
original PDF reference
Preserve scoring points whenever available.
Points will later be required for:
- mock exams;
- exam scoring;
- topic importance;
- realistic exam blueprints.
11. Official Answer + Explanation
Store separately:
Official Solution
Accepted Answer / Scoring Notes
AI Explanation
Never merge AI explanation into the official answer field.
12. Knowledge Taxonomy
AI may suggest topics, but does not have authority to create final taxonomy automatically.
Workflow:
Historical question
↓
AI proposes topic
↓
User reviews new topic if required
↓
Approved topic enters Knowledge Map
A new official Knowledge Map topic requires:
1. evidence from at least one real historical exam question;
2. user approval.
13. Topic Structure
Each question should have:
1 Primary Topic
0..N Secondary Topics
Example:
Primary:
Drehstrommotor

Secondary:
Leistung
Wirkungsgrad
Mastery calculations should weight the Primary Topic more strongly.
14. Knowledge Map
Provide a visual Knowledge Map / Skill Matrix.
Example:
Mechanik
  Lager                  82%
  Kräfte                 68%
  Drehmoment             75%

Elektrotechnik
  Schutzmaßnahmen        43%
  Motor                  71%

SPS
  ...
Allow clicking a topic to view:
- related historical questions;
- performance;
- mistakes;
- notes;
- Tabellenbuch references;
- AI explanations.
15. Tabellenbuch
User currently owns physical copies:
Tabellenbuch Metall
49. Auflage
2022

Tabellenbuch Elektrotechnik
30. Auflage
2022
Do not assume page references without evidence.
Support a Tabellenbuch reference database:
book
edition
chapter
page
search keyword
user note
Example:
Topic: Schutzleiterwiderstand
Book: Tabellenbuch Elektrotechnik
Edition: 30. Auflage 2022
Page: user-confirmed
Keyword: ...
Allow the user to edit/add these manually.
16. User Notes
Support both:
Question Notes
Example:
注意这里先换单位。
Topic Notes
Example:
Drehstrom: 永远先确认 √3 是否需要。
17. Learning Modes
Support three main modes.
17.1 Topic Practice
Practice one topic across multiple historical exams.
17.2 Individual Question Practice
One question at a time.
17.3 Original Exam Mode
Reproduce a historical paper with:
- original order;
- original timing;
- original points;
- no immediate solutions.
18. Question UI
Default question screen should remain clean.
Main content:
Question
Answer input
Submit
Expandable controls:
Hint
Source
Tabellenbuch
Unsure
Favorite
Notes
Edit
Original PDF
19. Hint System
Use progressive hints.
Example:
Hint 1
Knowledge direction.
Hint 2
Relevant formula / Tabellenbuch area.
Hint 3
Problem-solving approach.
Do not immediately reveal the answer.
Track number of hints used.
A question solved without hints should contribute more to mastery than one solved after several hints.
20. Answer Evaluation
Objective questions can be automatically evaluated where reliable.
For subjective questions:
User answer
+
Official solution
↓
AI assessment
↓
User confirms final result
AI may suggest:
Correct
Partially Correct
Incorrect
But user makes the final decision.
21. Error Reasons
After an incorrect or partial answer, optionally show:
Warum falsch?
Possible categories:
Wissen fehlt
Formel nicht gewusst
Tabellenbuch nicht gefunden
Aufgabe falsch verstanden
Rechenfehler
Deutsch / Begriff nicht verstanden
Flüchtigkeitsfehler
Zeitproblem
Andere
This should be quick and optional.
22. Mastery Algorithm — Initial Version
Do not overengineer the first version.
Mastery should consider:
correctness
recent performance
repeated errors
confidence / unsure flag
hints used
historical question vs AI question
Do NOT initially require:
- complex ML;
- advanced Bayesian models;
- heavy prediction systems.
Historical exam questions should have higher mastery weight than AI-generated questions.
23. Spaced Repetition
Incorrect questions should reappear.
Initial logic may consider:
1 day
3 days
7 days
14 days
Then dynamically increase/decrease intervals according to performance.
As the exam approaches, high-value/high-frequency topics may return even if previously mastered.
24. Self Assessment
Initial onboarding should recommend completing a diagnostic self-assessment before study planning.
The user may still access the system, but the UI should clearly recommend:
先完成自测，以便生成更准确的学习计划。
24.1 Initial self-rating
Ask for broad category confidence, not hundreds of topic ratings.
24.2 Diagnostic test
Initial target:
30–45 minutes
Use representative historical questions.
After completion:
score
topic performance
error distribution
confidence
Generate initial study plan.
24.3 Reassessment
Always provide:
重新自测
Every self-assessment receives a score.
After later self-assessment:
combine:
self-assessment result
+
current historical performance
+
mastery
+
mistake history
+
study progress
Then adjust the learning plan.
Do not reset previous progress.
25. Study Planning
Current provisional exam date:
1 December
The exam date must be editable.
When exam date changes
Recalculate the plan using:
remaining days
current mastery
unseen historical questions
wrong questions
topic weight
recent performance
mock exam results
Do not simply move old tasks to new dates.
26. Study Plan Style
Do not impose fixed daily question quotas.
The learner may:
start anytime
stop anytime
continue later
Use:
Weekly goals
Example:
This week's focus:
Schutzmaßnahmen
Lager
SPS
and
Dynamic Priority Queue
When opening the site:
Recommended next:
1. Schutzmaßnahmen practice
2. Review yesterday's errors
3. Continue 2021 Winter
27. Session Handling
Allow:
Save and stop
Continue later
Abandon session
Auto-save progress continuously.
28. Dashboard
Use a hybrid homepage.
Top:
Exam date
Days remaining
Overall readiness / mastery indicator
Main area:
Heute / Jetzt lernen
Recommended next activity
Secondary area:
weak topics
weekly focus
recent progress
self-test score
mock exam results
Avoid turning the homepage into a complex BI dashboard.
29. Exam Simulation
The PDF itself specifies module exam duration.
Extract and store those durations where reliable.
Support:
Original Exam
Use a real historical paper.
Preserve:
order
points
module timing
30. Generated Mock Exam
This MUST NOT be random question sampling.
First construct an:
Exam Blueprint
Analyze historical exams for:
topic distribution
question type distribution
module distribution
points distribution
calculation vs theory
diagram questions
question difficulty where inferable
exam timing
Generated mock exams must follow the learned historical structure.
31. Mock Exam Source Mix
Allow configurable mix.
Example:
100% Original Questions

80% Original / Variants
20% AI Practice

50% Original
50% AI Practice
Default early implementation should be conservative.
32. Mock Exam Review
After submission provide:
Score
Incorrect questions
Partial answers
Topic weaknesses
Error-reason breakdown
Time problems
Tabellenbuch problems
Use the result to adjust the study plan.
Do not present fake-precision predictions about future exam scores.
33. AI Practice Questions
AI practice questions are a later-phase feature.
Initially:
AI may only generate questions using knowledge already demonstrated in historical exam questions.
No unrestricted curriculum expansion.
34. AI Question Lifecycle
AI-generated question:
Generate
↓
Show evidence/source basis
↓
Preview
↓
User edits question/solution if necessary
↓
User approves
↓
Enters AI Practice Pool
Rejected questions must not enter the pool.
35. AI Question Provenance
Every AI question must retain:
knowledge topic
historical supporting questions
generation batch
generation date
review status
user modifications
Example:
Based on:
2019 Winter Q12
2022 Sommer Q7
36. AI Practice Module
Create a dedicated section.
Allow views by:
Knowledge Topic
Generation Batch
Example:
2026-10-08
Pneumatik Training Set
12 Questions
37. AI Practice Export
User wants one PDF containing:
questions
+
answers
Before export:
show an editable preview.
User must be able to:
edit question
edit answer
remove question
reorder question
Then generate PDF.
This PDF is intended for:
- printing;
- asking a teacher;
- asking colleagues;
- external verification.
38. AI Batch Analysis
Do NOT invoke AI after every answered question unless necessary.
Prefer:
Complete group/module/session
↓
perform local calculations
↓
AI analyses summarized result
↓
update study priorities
This significantly reduces API/token usage.
39. Phase-Based AI Introduction
Stage 1 — Strict Historical Mode
Only:
real historical questions
official solutions
verified topics
Stage 2 — Controlled Variations
AI may create:
changed values
slightly altered scenarios
alternative wording
but only within verified historical knowledge.
Stage 3 — Transfer Questions
After sufficient historical practice:
AI may generate new practice questions within verified topic boundaries.
Always label them:
AI Übungsfrage
Never call them official predictions.
40. WiSo
Keep WiSo separate from technical AP2 modules.
Example:
Technische AP2
WiSo
But overall dashboard may display combined progress.
41. Data Storage — Current Version
The initial application is private and single-user.
Use:
GitHub
→ source code
→ static question database
→ assets
→ GitHub Pages deployment
Personal learning data should NOT be committed to the public/static GitHub repository.
Store private progress locally using:
IndexedDB
Prefer a clean data-access abstraction rather than accessing IndexedDB directly throughout UI code.
Possible library:
Dexie
42. Backup
Provide:
Export Learning Data
Import Learning Data
Export format:
JSON
Include:
progress
notes
mastery
self-tests
mock exams
user edits
settings
study history
This protects against browser/device loss.
43. Future Multi-User Architecture
DO NOT implement login now.
However, architecture must allow it later without rewriting the app.
Create an abstraction such as:
UserContext
ProgressRepository
AuthProvider
SyncProvider
Current implementation:
LocalUserProvider
IndexedDBProgressRepository
Future implementation might become:
RemoteAuthProvider
CloudProgressRepository
UI code should not depend directly on the storage implementation.
44. Future Login Requirements
Leave extension points for a future version where:
- admin creates/provides username and password;
- each user has separate progress;
- users can log in from their own devices;
- user data syncs between devices;
- account owner can manage authorized devices;
- password sharing alone should not allow unlimited devices.
Possible future features:
device registration
session tokens
device list
revoke device
maximum active devices
password reset
admin user management
DO NOT implement these now.
Only design interfaces so they can be added later.
45. Important Security Principle
When multi-user support is eventually implemented:
Do NOT store user passwords in GitHub.
Do NOT store passwords in frontend JavaScript.
Do NOT create authentication using a static JSON username/password list.
Real authentication will require a backend/auth service.
That decision belongs to a later phase.
46. Recommended Frontend Architecture
Prefer a lightweight maintainable stack such as:
React
TypeScript
Vite
For local user data:
IndexedDB
Dexie
For PDF viewing:
PDF.js or equivalent
Do not introduce heavy frameworks without a clear need.
47. GitHub
The user has a newly created GitHub account.
Codex should eventually create/use one dedicated repository for this project.
Required repository-level permissions:
read repository
write repository
create/edit files
commit
push
GitHub Actions
GitHub Pages configuration where necessary
Do NOT require unrestricted access to the entire GitHub account.
Use repository-scoped access wherever possible.
48. Deployment
Deploy using:
GitHub Pages
Initial URL will likely resemble:
username.github.io/...
Later support attaching a custom domain if the user chooses to purchase/use one.
Deployment should preferably be automated using GitHub Actions.
49. Responsive Design
Primary usage:
Windows laptop
Also support:
iPad
mobile
Use responsive layout.
Do not make phone layout the primary design target at the expense of desktop study usability.
50. Project Folder Proposal
Suggested starting structure:
ap2-study/
│
├─ raw/
│  └─ historical_exam_sources/
│
├─ data/
│  ├─ ingest/
│  │  ├─ manifest.json
│  │  ├─ review_queue.json
│  │  └─ documents/
│  │
│  ├─ exams/
│  ├─ taxonomy/
│  ├─ exam_blueprints/
│  └─ generated_questions/
│
├─ scripts/
│  ├─ extract_archives/
│  ├─ extract_pdf/
│  ├─ normalize_questions/
│  ├─ match_solutions/
│  └─ validate_data/
│
├─ src/
│  ├─ components/
│  ├─ pages/
│  ├─ learning/
│  ├─ exams/
│  ├─ storage/
│  ├─ ai/
│  ├─ auth/
│  └─ types/
│
├─ public/
│
├─ docs/
│  ├─ AP2_MASTER_PLAN.md
│  ├─ DATA_SCHEMA.md
│  └─ INGESTION_STATUS.md
│
└─ README.md
51. Implementation Phases
DO NOT attempt the entire project in one Codex run.
PHASE 0 — Repository & Architecture
Goal:
Create project skeleton only.
Tasks:
- initialize repository;
- configure React/TypeScript/Vite;
- create folder structure;
- create data schemas;
- create IndexedDB abstraction;
- create future auth/storage interfaces;
- configure GitHub Pages deployment;
- add ingestion manifest structure.
Do not scan all PDFs yet.
Acceptance Criteria
Project runs locally.
GitHub Pages deployment works.
Storage abstraction exists.
Future multi-user interfaces exist but no login UI.
PHASE 1 — Ingestion Prototype
Use only ONE or TWO exam sessions first.
For example:
2017 Sommer
2017/18 Winter
Implement:
- ZIP extraction;
- PDF discovery;
- text extraction;
- visual preservation;
- raw extraction;
- normalized questions;
- solution matching;
- point extraction;
- source references;
- resumable manifest;
- Review Queue.
Do not process all years until prototype quality is checked.
Acceptance Criteria
At least one complete exam can be browsed in the web UI.
Every question can link back to original PDF/page.
Interrupted ingestion resumes correctly.
PHASE 2 — Validate Extraction
Before processing all exams, inspect:
question extraction
solution mapping
diagrams
point values
module recognition
exam timing
Fix pipeline first.
Do NOT manually patch dozens of questions if the extractor itself is wrong.
PHASE 3 — Full Historical Archive Ingestion
Process remaining exams incrementally.
IMPORTANT:
Before every run:
read manifest
skip complete files
continue partial files
After every processed unit:
save checkpoint
Codex must assume the current session may terminate at any moment.
Example
If processing ends after:
2017–2020 complete
2021 Summer pages 1–4 complete
the next run starts:
2021 Summer page 5
NOT 2017.
This rule is mandatory.
PHASE 4 — Core Study UI
Build:
- homepage;
- knowledge map;
- historical exam browser;
- single-question practice;
- topic practice;
- original PDF button;
- official solutions;
- notes;
- favorites;
- error reasons;
- editing;
- resume session.
PHASE 5 — Personalization
Build:
- mastery calculation;
- spaced repetition;
- weekly targets;
- dynamic priority queue;
- onboarding self-assessment;
- 30–45 minute diagnostic test;
- repeat self-test;
- self-test scoring;
- study plan adjustment;
- editable exam date.
PHASE 6 — Original Exam Simulator
Build:
- real exam selection;
- original timing;
- module timer;
- points;
- submit;
- scoring;
- review;
- weakness analysis.
PHASE 7 — Historical Exam Blueprint
Analyze historical structured data.
Generate statistics for:
topics
question types
points
modules
timing
exam structure
Create structured blueprint files.
Do not make assumptions unsupported by data.
PHASE 8 — Generated Mock Exams
Generate mock papers according to blueprint.
Not random sampling.
Allow configured original/AI ratio.
Initially support original questions only if AI question system is not ready.
PHASE 9 — AI Assistance
Add AI features gradually:
- subjective answer assistance;
- explanations;
- session/module analysis;
- study plan refinement.
Avoid per-question API calls when unnecessary.
PHASE 10 — AI Practice Question System
Implement:
- controlled generation;
- source provenance;
- topic restrictions;
- review;
- editing;
- approval;
- rejection;
- batches;
- topic filtering.
PHASE 11 — PDF Export
Create:
AI Practice Questions + Answers.pdf
Before exporting provide editable preview.
52. Codex Token / Context Rules
Codex MUST follow these rules.
Rule 1
Never reread all PDFs just to understand the project.
Read structured data and documentation instead.
Rule 2
Never scan completed PDFs again unless necessary.
Check:
manifest
hash
status
first.
Rule 3
Do not load every extracted exam into the active context simultaneously.
Process one exam or small batch at a time.
Rule 4
Write results to disk immediately.
Do not rely on conversational memory.
Rule 5
Maintain:
docs/INGESTION_STATUS.md
Example:
Complete:
2017 Sommer
2017/18 Winter
2018 Sommer

Partial:
2018/19 Winter — page 7/15

Pending:
...
Update this after every ingestion run.
Rule 6
Before each Codex session:
read only:
AP2_MASTER_PLAN.md
INGESTION_STATUS.md
relevant phase files
Do not automatically reread the complete codebase.
Rule 7
When changing one subsystem, inspect only files related to that subsystem unless dependencies require more.
Rule 8
Do not repeatedly ask an LLM to classify identical questions.
Cache classifications.
Rule 9
Use deterministic scripts for:
file discovery
hashing
ZIP extraction
PDF metadata
page extraction
question IDs
data validation
Use AI only where semantic understanding is actually necessary.
53. Validation
Create automated validation checks for:
duplicate question IDs
missing source pages
missing solutions
invalid source files
invalid topic IDs
missing points
orphan solution mappings
broken images
unreviewed low-confidence extraction
Run validation before deployment.
54. Data Versioning
Add schema version fields.
Example:
{
  "schema_version": 1
}
Future schema changes should use migrations.
Do not silently break existing progress data.
55. Private Data
Never commit:
personal progress
private notes
personal self-test results
browser IndexedDB dump
passwords
future auth secrets
API keys
GitHub tokens
to the repository.
Add appropriate entries to:
.gitignore
56. First Codex Task
Do NOT immediately begin scanning the entire archive.
The first execution should only:
1. inspect the current project directory;
2. create/update AP2_MASTER_PLAN.md;
3. propose final repository structure;
4. initialize the web project;
5. implement the resumable ingestion manifest;
6. implement archive/PDF discovery;
7. test extraction using one historical exam only;
8. report the result;
9. stop.
Do not continue automatically to the complete archive.
The first prototype must be reviewed before bulk ingestion.
57. Definition of Success
The finished product should eventually allow the learner to open the website and see something like:
AP2 Prüfung: 1. Dezember
Noch 66 Tage

Aktueller Schwerpunkt:
Schutzmaßnahmen

Empfohlen:
▶ 8 historische Aufgaben
↻ 3 alte Fehler
📘 Tabellenbuch überprüfen

Wöchentliche Ziele:
Mechanik
Schutzmaßnahmen
SPS
The learner can study for as long as desired and stop at any time.
The system progressively learns the learner's strengths and weaknesses from:
historical question performance
self-assessment
mock exams
confidence
hint use
mistake types
review performance
and adapts future study priorities without losing traceability to the real historical exam archive.
END OF MASTER PLAN

## Phase 2F operational checkpoint (2026-09-27)

This checkpoint limits the implemented scope; broader sections above remain future plans.

- Complete repository/auth/sync contracts; actual runtime remains local IndexedDB v6 with LocalUserProvider and NoopSyncProvider.
- Source Registry covers all production sources. Replacement is append-only: new source hash/version, every validation gate, complete verified identity mapping. Unsafe mappings block; personal records are never migrated automatically.
- New records snapshot source/official-answer revisions; old tests retain their original questions, sourceExams and source_mix.
- Sommer 2018 WiSo validated: 24 questions,18 MC official answers,6 U screenshot solutions; registered through existing data-driven learning/original/test interfaces.
- Sommer2018 AP and FA blocked: required Stückliste Blatt2 is absent. AP36-question preview retained; FA stopped before detailed segmentation. Neither is production.
- No old source rescans and no later years. No real auth/cloud sync/taxonomy/AI generation. Stop for acceptance.

Detailed evidence: docs/PHASE_2F_REPORT.md and docs/evidence/phase2f/.
