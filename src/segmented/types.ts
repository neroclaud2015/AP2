export type Box = [number, number, number, number];
export interface SegmentedQuestion {
  question_id: string; exam: string; module: string; question_number: string;
  source_pdf: string; source_page: number; source_page_image: string; source_size: [number, number];
  bounding_box: Box; regions: Box[]; cropped_question_image: string; extracted_text: string;
  extraction_confidence: number; label_evidence: string; review_status: 'auto_ready' | 'needs_review' | 'confirmed';
  review_reasons: string[]; extractor_version: string; segmentation_revision: string;
  tags: string[]; solution_page: number | null; solution_confirmed: boolean;
}
export interface QuestionReview {
  userId: string; question_id: string; source_revision: string; question_number: string;
  bounding_box: number[]; regions: number[][]; extracted_text: string; tags: string[];
  solution_page: number | null; solution_confirmed: boolean;
  review_status: 'needs_review' | 'confirmed'; updated_at: string;
}
export interface SegmentedExam {
  schema_version: 2; exam: string; module: string; document_id: string; source_pdf: string;
  extractor_version: string; segmentation_revision: string; questions: SegmentedQuestion[];
  pages_processed: number; pages_total: number; confidence_note: string;
  solution_document: { public_pdf: string; pages: {number: number; image: string}[] };
  source_pages: {number: number; image: string; raw_text: string}[];
}
export const asset = (path: string) => import.meta.env.BASE_URL + path;
export function effectiveQuestion(q: SegmentedQuestion, review?: QuestionReview): SegmentedQuestion {
  return review ? { ...q, question_number: review.question_number, bounding_box: review.bounding_box as Box,
    regions: review.regions as Box[], extracted_text: review.extracted_text, tags: review.tags,
    solution_page: review.solution_page, solution_confirmed: review.solution_confirmed, review_status: review.review_status } : q;
}
export function validReview(value: unknown): value is QuestionReview {
  if (!value || typeof value !== 'object') return false;
  const r = value as QuestionReview;
  const box = (b: unknown) => Array.isArray(b) && b.length === 4 && b.every(Number.isFinite) && b[0] >= 0 && b[1] >= 0 && b[2] > b[0] && b[3] > b[1];
  return r.userId === 'local' && typeof r.question_id === 'string' && typeof r.source_revision === 'string' &&
    typeof r.question_number === 'string' && !!r.question_number.trim() && typeof r.extracted_text === 'string' &&
    box(r.bounding_box) && Array.isArray(r.regions) && r.regions.length > 0 && r.regions.every(box) &&
    Array.isArray(r.tags) && r.tags.every(t => typeof t === 'string') && typeof r.solution_confirmed === 'boolean' &&
    (r.solution_page === null || Number.isInteger(r.solution_page) && r.solution_page > 0) &&
    (!r.solution_confirmed || r.solution_page !== null) && ['confirmed','needs_review'].includes(r.review_status) && typeof r.updated_at === 'string';
}
