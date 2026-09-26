"""Single-session, page-checkpointed ingestion. No bulk mode or implicit discovery."""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import zipfile
import pymupdf

VERSION = '1.0.0'

def now():
    return datetime.now(timezone.utc).isoformat()

def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

def save(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    with temporary.open('w', encoding='utf-8') as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, path)

def read(path, default=None):
    return json.loads(Path(path).read_text(encoding='utf-8')) if Path(path).exists() else default

@contextmanager
def lock(root):
    """OS advisory lock is automatically released after crash; no stale lock recovery."""
    path = root / 'data/ingest/.lock'
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a+b') as stream:
        stream.seek(0)
        if os.name == 'nt':
            import msvcrt
            if path.stat().st_size == 0:
                stream.write(b'0'); stream.flush(); stream.seek(0)
            msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            yield
        finally:
            stream.seek(0)
            if os.name == 'nt':
                msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(stream, fcntl.LOCK_UN)

def extract(archive, root, season):
    archive_hash = digest(archive)
    receipt_path = root / f'data/ingest/archives/{season}.json'
    receipt = read(receipt_path)
    if receipt:
        if receipt['sha256'] != archive_hash:
            raise ValueError('Archive changed. Explicit source-version migration required; raw is immutable.')
        for source in receipt['files']:
            if not (root / source['path']).exists() or digest(root / source['path']) != source['sha256']:
                raise ValueError('Immutable source missing or changed: ' + source['path'])
        return receipt['files']
    sources = []
    with zipfile.ZipFile(archive) as bundle:
        entries = bundle.infolist()
        paths = set()
        for entry in entries:
            name = PurePosixPath(entry.filename.replace('\\', '/'))
            if name.is_absolute() or '..' in name.parts or ':' in str(name):
                raise ValueError('Unsafe ZIP entry: ' + entry.filename)
            if (entry.external_attr >> 16) & 0o170000 == 0o120000:
                raise ValueError('ZIP symlinks are unsupported')
            key = str(name).casefold()
            if key in paths:
                raise ValueError('Duplicate archive path')
            paths.add(key)
        for entry in entries:
            if entry.is_dir():
                continue
            relative = Path('raw') / season / Path(entry.filename.replace('\\', '/'))
            target = root / relative
            content = bundle.read(entry)
            sha = hashlib.sha256(content).hexdigest()
            if target.exists():
                if digest(target) != sha:
                    raise ValueError('Refusing to overwrite immutable source')
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                temporary = target.with_suffix(target.suffix + '.extracting')
                temporary.write_bytes(content)
                os.replace(temporary, target)
            sources.append({'path': relative.as_posix(), 'sha256': sha})
    save(receipt_path, {'schema_version': 1, 'sha256': archive_hash, 'files': sources})
    return sources

def module_for(name):
    lower = name.lower()
    for token, module in [('arbeitsplanung', 'Arbeitsplanung'), ('funktionsanalyse', 'Funktionsanalyse'), ('wiso', 'WiSo'), ('lösung', 'Solutions'), ('losung', 'Solutions')]:
        if token in lower:
            return module
    return 'Unknown'

def page_extract(page, entry, number, root):
    image = f'assets/pages/{entry["id"]}/{number:03}.png'
    target = root / 'public' / image
    target.parent.mkdir(parents=True, exist_ok=True)
    page.get_pixmap(dpi=120, alpha=False).save(target)
    lines = []
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines', []):
            lines.append({'text': ''.join(span['text'] for span in line['spans']), 'bbox': list(line['bbox'])})
    raw = page.get_text(sort=True)
    return {'schema_version': 1, 'extraction_version': VERSION, 'document_id': entry['id'],
            'source_page': number, 'source_image': image, 'raw_text': raw, 'lines': lines,
            'width': page.rect.width, 'height': page.rect.height, 'method': 'pdf_text' if raw.strip() else 'image_only',
            'ocr_confidence': None, 'review_status': 'needs_review', 'extracted_at': now()}

def candidates(page):
    """Proposals only. Layout heuristics never certify OCR, segmentation or numbers."""
    markers = []
    for line in page['lines']:
        text = line['text'].strip()
        explicit = re.fullmatch(r'(?:Aufgabe\s+|U\s*)(\d{1,2})[.):]?', text, re.I)
        bare = re.fullmatch(r'(\d{1,2})[.)]?', text)
        box = line['bbox']
        if explicit or (bare and box[0] < page['width'] * .14 and box[1] < page['height'] * .9):
            number = (explicit or bare).group(1)
            if 1 <= int(number) <= 40:
                markers.append((box[1], number, text))
    markers.sort()
    # Same-line duplicate text layers should not create duplicate questions.
    unique = []
    for marker in markers:
        if not unique or abs(marker[0] - unique[-1][0]) > 5:
            unique.append(marker)
    result = []
    for index, (top, number, marker) in enumerate(unique):
        bottom = unique[index + 1][0] if index + 1 < len(unique) else page['height']
        text = '\n'.join(line['text'] for line in page['lines'] if top - 2 <= line['bbox'][1] < bottom - 2)
        if len(text) < 20:
            continue
        points_match = re.search(r'\b(\d+(?:[,.]\d+)?)\s*(?:Punkte|Punkt)\b', text)
        result.append({'number': number, 'marker': marker, 'text': text,
                       'points': float(points_match.group(1).replace(',', '.')) if points_match else None,
                       'bbox': [0, top, page['width'], bottom]})
    return result

def materialize(root, manifest, season):
    documents, questions, queue = [], [], []
    solution_candidates = []
    for entry in manifest['documents'].values():
        if entry['exam'] != season:
            continue
        pages = []
        for number in range(1, entry['pages_processed'] + 1):
            page = read(root / f'data/ingest/pages/{entry["id"]}/{number:03}.json')
            pages.append(page)
        duration = None
        for page in pages:
            match = re.search(r'\b(60|90|105|120)\s*min\b', page['raw_text'])
            if match:
                duration = {'minutes': int(match.group(1)), 'source_page': page['source_page'], 'review_status': 'needs_review'}
                break
        documents.append({**entry, 'duration': duration, 'pages': [
            {'number': p['source_page'], 'image': p['source_image'], 'raw_text': p['raw_text'], 'method': p['method']} for p in pages]})
        for page in pages:
            source = {'document_id': entry['id'], 'sha256': entry['sha256'], 'pdf': entry['public_pdf'],
                      'page': page['source_page'], 'image': page['source_image']}
            if entry['module'] == 'Solutions':
                solution_candidates.append({'source_reference': source, 'raw_text': page['raw_text']})
            queue.append({'id': f'{entry["id"]}-page-{page["source_page"]}', 'kind': 'page',
                          'reason': 'ocr_required' if page['method'] == 'image_only' else 'verify_text_and_segmentation',
                          'source_reference': source, 'status': 'needs_review'})
            if entry['module'] in ('Solutions', 'Unknown'):
                continue
            # Cover/instructions are retained in the page browser, not treated as questions.
            text_lower = page['raw_text'].lower()
            if 'vorgabezeit' in text_lower or 'pruflingsnummer' in text_lower and page['source_page'] == 1:
                continue
            for index, item in enumerate(candidates(page)):
                qid = f'{entry["id"]}-p{page["source_page"]}-q{item["number"]}-{index}'
                question = {'schema_version': 1, 'question_id': qid, 'exam': season, 'module': entry['module'],
                            'question_number': item['number'], 'question_text': item['text'],
                            'raw_extraction': f'data/ingest/pages/{entry["id"]}/{page["source_page"]:03}.json',
                            'points': item['points'], 'primary_topic': None, 'secondary_topics': [],
                            'official_solution': None, 'accepted_answer_notes': None, 'ai_explanation': None,
                            'source_reference': {**source, 'bbox': item['bbox']}, 'review_status': 'needs_review',
                            'locked_fields': [], 'solution_candidates': []}
                questions.append(question)
                queue.append({'id': qid, 'kind': 'question', 'status': 'needs_review',
                              'reason': 'verify_segmentation_points_and_solution', 'source_reference': source})
    for question in questions:
        for solution in solution_candidates:
            text = solution['raw_text']
            # Require module AND question marker; even this stays proposed, never official.
            if question['module'].lower() in text.lower() and re.search(r'(?:Aufgabe|U)\s*' + re.escape(question['question_number']) + r'\b', text, re.I):
                question['solution_candidates'].append({'source_reference': solution['source_reference'], 'confidence': None,
                                                        'basis': 'module_and_number', 'status': 'needs_review'})
    for doc in documents:
        count = sum(q['source_reference']['document_id'] == doc['id'] for q in questions)
        doc['questions_extracted'] = count
        manifest['documents'][doc['id']]['questions_extracted'] = count
    exam = {'schema_version': 1, 'exam': season, 'title': season.replace('_', ' ').title(),
            'documents': documents, 'questions': questions, 'review_queue': queue,
            'notice': 'Extraction proposals are unverified. Original page images are authoritative. Image-only pages require OCR/review.'}
    save(root / f'data/exams/{season}.json', exam)
    save(root / f'public/data/{season}.json', exam)
    save(root / 'data/ingest/review_queue.json', {'schema_version': 1, 'items': queue})
    save(root / 'public/data/catalog.json', {'schema_version': 1, 'exams': [{'id': season, 'title': exam['title']}]})
    counts = {'pages': sum(len(d['pages']) for d in documents), 'questions': len(questions),
              'image_only_pages': sum(p['method'] == 'image_only' for d in documents for p in d['pages']),
              'review_items': len(queue)}
    status = root / 'docs/INGESTION_STATUS.md'
    status.parent.mkdir(parents=True, exist_ok=True)
    status.write_text('# Ingestion status\n\nScope: **2017 Sommer only**. No bulk scanning authorized.\n\n' +
                      '\n'.join(f'- {d["module"]}: {d["pages_processed"]}/{d["pages_total"]} pages; {d["status"]}' for d in documents) +
                      f'\n\n{counts}\n\nProcessing completion is separate from content approval. All OCR/segmentation/points/solutions remain proposals until reviewed.\n\nOther seasons: untouched. Stop after Phase 0–1.\n', encoding='utf-8')
    return counts

def run(archive, root, season, max_pages=None):
    if season != '2017_sommer':
        raise ValueError('Prototype scope permits only 2017_sommer. No bulk mode.')
    if max_pages is not None and max_pages < 1:
        raise ValueError('max_pages must be positive')
    archive, root = Path(archive).resolve(), Path(root).resolve()
    with lock(root):
        path = root / 'data/ingest/manifest.json'
        manifest = read(path, {'schema_version': 1, 'extraction_version': VERSION, 'documents': {}})
        if manifest['extraction_version'] != VERSION:
            raise ValueError('Explicit extraction-version migration required')
        sources = extract(archive, root, season)
        processed, skipped = 0, 0
        for source in sorted(sources, key=lambda item: item['path']):
            if not source['path'].lower().endswith('.pdf'):
                continue
            module = module_for(source['path'])
            identity = f'{season}|{module}|{source["path"]}|{source["sha256"]}'
            doc_id = hashlib.sha256(identity.encode()).hexdigest()[:24]
            entry = manifest['documents'].get(doc_id)
            if entry and entry['processing_complete']:
                skipped += 1
                continue
            if max_pages is not None and processed >= max_pages:
                continue
            public_pdf = f'assets/pdfs/{doc_id}.pdf'
            destination = root / 'public' / public_pdf
            destination.parent.mkdir(parents=True, exist_ok=True)
            if not destination.exists():
                temporary_pdf = destination.with_suffix('.pdf.tmp')
                shutil.copyfile(root / source['path'], temporary_pdf)
                if digest(temporary_pdf) != source['sha256']:
                    raise ValueError('Incomplete PDF copy')
                os.replace(temporary_pdf, destination)
            elif digest(destination) != source['sha256']:
                raise ValueError('Published source copy changed')
            with pymupdf.open(root / source['path']) as pdf:
                if entry is None:
                    entry = {'id': doc_id, 'exam': season, 'module': module, 'file': source['path'],
                             'sha256': source['sha256'], 'public_pdf': public_pdf, 'status': 'pending',
                             'pages_total': len(pdf), 'pages_processed': 0, 'last_completed_page': 0,
                             'processing_complete': False, 'questions_extracted': 0}
                    manifest['documents'][doc_id] = entry
                entry['status'] = 'extracting'
                save(path, manifest)
                try:
                    for number in range(entry['last_completed_page'] + 1, len(pdf) + 1):
                        if max_pages is not None and processed >= max_pages:
                            break
                        page_path = root / f'data/ingest/pages/{doc_id}/{number:03}.json'
                        # Page atomically saved before manifest: reuse a committed page after a crash.
                        page = read(page_path)
                        if page is None:
                            page = page_extract(pdf[number - 1], entry, number, root)
                            save(page_path, page)
                            processed += 1
                        entry.update(pages_processed=number, last_completed_page=number, updated_at=now())
                        entry['status'] = 'partially_complete'
                        save(path, manifest)
                    entry['processing_complete'] = entry['pages_processed'] == entry['pages_total']
                    entry['status'] = 'needs_review' if entry['processing_complete'] else 'partially_complete'
                    save(path, manifest)
                except Exception as error:
                    entry.update(status='failed', error=str(error), updated_at=now())
                    save(path, manifest)
                    materialize(root, manifest, season)
                    raise
        counts = materialize(root, manifest, season)
        exam = read(root / f'data/exams/{season}.json')
        for entry in manifest['documents'].values():
            entry['questions_extracted'] = sum(q['source_reference']['document_id'] == entry['id'] for q in exam['questions'])
        save(path, manifest)
        result = {**counts, 'processed_now': processed, 'skipped_documents': skipped, 'updated_at': now()}
        save(root / 'data/ingest/last_run.json', result)
        return result

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, required=True)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--season', choices=['2017_sommer'], required=True)
    parser.add_argument('--max-pages', type=int)
    args = parser.parse_args()
    print(json.dumps(run(args.archive, args.root, args.season, args.max_pages), indent=2))
