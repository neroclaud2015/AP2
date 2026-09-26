# AP2 Study — Phase 1.5 question segmentation

Only **2017 Sommer** is imported. Phase 1.5 re-segments **Arbeitsplanung only**: 36 original-image questions, 4 low-confidence review items, local review/edit persistence. [Phase 1.5 report](docs/PHASE_1_5_REPORT.md). Stop for user acceptance; no full archive scan is authorized.

## Run locally

Node 24+, Python 3.10+:

```sh
npm ci
python -m pip install -r requirements.txt
npm run dev
```

Open the localhost URL printed by Vite. Saved pilot data lets the UI run without rereading PDFs.

## Ingestion

```sh
python scripts/ingest.py --archive "../2017 Sommer-20260926T101116Z-1-001.zip" --season 2017_sommer --max-pages 3
python scripts/ingest.py --archive "../2017 Sommer-20260926T101116Z-1-001.zip" --season 2017_sommer
```

The first command is an interruption demo for a fresh destination. Repeating either command on completed data skips the PDFs. `--root` permits a separate test destination. There is no all-seasons switch; other season IDs are rejected.

Original ZIPs stay outside this repository and remain untouched. `raw/` is immutable. Raw pages are committed before their manifest checkpoints; a crash between the two reuses the saved page. Process locking prevents simultaneous writers. Structured browser data is rebuilt from saved page records only.

## Checks

```sh
python -m unittest discover -s scripts -p 'test_*.py'
python scripts/validate_data.py
python scripts/validate_segmentation.py
npm test
npm run build
```

Structural errors fail validation. Missing solutions/points and unreviewed extraction are reported as content warnings in `data/ingest/validation.json`. A structurally valid prototype is **not** a verified question bank.

## Prototype limitations

Every original PDF/page can be browsed, including solution pages and diagrams. Text layers are noisy and five pages have no text layer. Those pages are image-only and explicitly require OCR/review. No OCR engine has been configured. Question boundaries/numbers/points are heuristic proposals, not complete or approved questions; no low-confidence mapping becomes an official answer. Full-page images preserve diagrams without reconstructing them.

## Layout

`raw/`: immutable pilot sources; `data/ingest/`: checkpoints/raw pages/review queue; `data/exams/`: structured exam; `public/`: served PDFs/images/data; `scripts/`: extraction and validation; `src/`: React viewer, schema and storage interfaces; `docs/`: master plan/status/evidence.

## GitHub Pages

The manual `pages.yml` workflow validates and builds existing pilot data; it never runs ingestion. Relative asset paths support a repository subpath. A remote repository, Pages enabled with GitHub Actions, and an actual successful deployment are still required for the live-deployment acceptance criterion. Source and pilot data are pushed to https://github.com/neroclaud2015/AP2. The user explicitly authorized making the repository public. GitHub Pages is live at https://neroclaud2015.github.io/AP2/; the build/deploy and online browser smoke checks passed.

Do not commit personal progress, notes, IndexedDB exports or secrets. Browser progress storage is separate from the source repository.

## Phase 1.5 segmentation

```sh
python scripts/segment.py --document 35c77ffdb630f70057e4cfb8
node scripts/browser_phase15.cjs
```

The segmentation manifest is separate from ingestion v1. Same source/version/config pages are reused without reopening the PDF. New versions are scoped to this explicit document. Default UI displays crops; the previous archive viewer remains under Sources / Debug. Review changes are local, locked overlays; export a backup before changing devices.
