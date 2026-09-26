"""Structural checks fail; content uncertainties are reported explicitly."""
import argparse
import hashlib
import json
from pathlib import Path

def validate(root):
    root = Path(root)
    exam = json.loads((root / 'data/exams/2017_sommer.json').read_text(encoding='utf-8'))
    errors, warnings = [], []
    documents = {d['id']: d for d in exam['documents']}
    ids = set()
    for doc in documents.values():
        if len(doc['pages']) != doc['pages_total']:
            errors.append(f'Incomplete document: {doc["id"]}')
        source = root / 'public' / doc['public_pdf']
        if not source.exists() or hashlib.sha256(source.read_bytes()).hexdigest() != doc['sha256']:
            errors.append(f'Invalid source file: {doc["id"]}')
        for page in doc['pages']:
            image = root / 'public' / page['image']
            if not image.exists() or image.read_bytes()[:8] != b'\x89PNG\r\n\x1a\n':
                errors.append(f'Broken page image: {image}')
            if page['method'] == 'image_only':
                warnings.append(f'OCR required: {doc["module"]} page {page["number"]}')
    for q in exam['questions']:
        qid = q['question_id']
        if qid in ids:
            errors.append(f'Duplicate question ID: {qid}')
        ids.add(qid)
        source = q['source_reference']
        doc = documents.get(source['document_id'])
        if not doc or not 1 <= source['page'] <= doc['pages_total']:
            errors.append(f'Missing source page: {qid}')
        if not (root / 'public' / source['image']).exists():
            errors.append(f'Broken question image: {qid}')
        if not (root / q['raw_extraction']).exists():
            errors.append(f'Missing raw extraction: {qid}')
        if q['primary_topic'] is not None or q['secondary_topics']:
            errors.append(f'Unapproved topic ID: {qid}')
        if q['points'] is None:
            warnings.append(f'Missing points: {qid}')
        if q['official_solution'] is None:
            warnings.append(f'Missing confirmed solution: {qid}')
        if q['review_status'] not in ('confirmed', 'user_corrected'):
            warnings.append(f'Unreviewed extraction: {qid}')
        for candidate in q['solution_candidates']:
            reference = candidate['source_reference']
            target = documents.get(reference['document_id'])
            if not target or target['module'] != 'Solutions' or not 1 <= reference['page'] <= target['pages_total']:
                errors.append(f'Orphan solution mapping: {qid}')
    return {'schema_version': 1, 'structural_errors': errors, 'content_warnings': warnings,
            'documents': len(documents), 'pages': sum(len(d['pages']) for d in documents.values()), 'question_proposals': len(ids),
            'approved_questions': sum(q['review_status'] in ('confirmed', 'user_corrected') for q in exam['questions'])}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    result = validate(args.root)
    (args.root / 'data/ingest/validation.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps({k: len(v) if isinstance(v, list) else v for k, v in result.items()}, indent=2))
    raise SystemExit(bool(result['structural_errors']))
