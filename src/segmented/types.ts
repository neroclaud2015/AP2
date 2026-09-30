import {questionPdfUrl} from './fullPdf';
export type Box = [number, number, number, number];
export interface SourceRegion {page:number;bbox:Box;role:string;owner:string;evidence:string;source_page_image?:string;source_size?:[number,number]}
export interface QuestionSource {source_page:number;source_page_image:string;source_size:[number,number];bounding_box:Box;regions:Box[]}
export interface SegmentedQuestion {
  question_id: string; exam: string; module: string; question_number: string;
  source_pdf: string; source_pdf_available?:boolean; source_page_available?:boolean; source_page: number; source_page_image: string; source_size: [number, number];
  bounding_box: Box; regions: Box[]; source_regions?:SourceRegion[]; cropped_question_image: string; extracted_text: string;
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
  schema_version: 2; exam: string; module: string; document_id: string; source_pdf: string; source_pdf_available?:boolean; source_page_available?:boolean;
  extractor_version: string; segmentation_revision: string; questions: SegmentedQuestion[];
  pages_processed: number; pages_total: number; confidence_note: string;
  solution_document: { public_pdf: string; public_pdf_available?:boolean; pages: {number: number; image: string}[] };
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
  return typeof r.userId === 'string' && !!r.userId.trim() && typeof r.question_id === 'string' && typeof r.source_revision === 'string' &&
    typeof r.question_number === 'string' && !!r.question_number.trim() && typeof r.extracted_text === 'string' &&
    box(r.bounding_box) && Array.isArray(r.regions) && r.regions.length > 0 && r.regions.every(box) &&
    Array.isArray(r.tags) && r.tags.every(t => typeof t === 'string') && typeof r.solution_confirmed === 'boolean' &&
    (r.solution_page === null || Number.isInteger(r.solution_page) && r.solution_page > 0) &&
    (!r.solution_confirmed || r.solution_page !== null) && ['confirmed','needs_review'].includes(r.review_status) && typeof r.updated_at === 'string';
}

// Reviews deliberately retain their legacy primary-page shape. Continuation pages
// always come from immutable source metadata and are never replaced by a review.
export function questionSources(q:SegmentedQuestion):QuestionSource[]{
 const primary:QuestionSource={source_page:q.source_page,source_page_image:q.source_page_image,source_size:q.source_size,bounding_box:q.bounding_box,regions:q.regions};
 const pages=new Map<number,SourceRegion[]>();
 for(const region of q.source_regions??[]){if(region.page===q.source_page)continue;pages.set(region.page,[...(pages.get(region.page)??[]),region]);}
 return [primary,...[...pages].map(([page,regions])=>({source_page:page,source_page_image:regions.find(r=>r.source_page_image)?.source_page_image??'',source_size:regions.find(r=>r.source_size)?.source_size??q.source_size,
  bounding_box:[Math.min(...regions.map(r=>r.bbox[0])),Math.min(...regions.map(r=>r.bbox[1])),Math.max(...regions.map(r=>r.bbox[2])),Math.max(...regions.map(r=>r.bbox[3]))] as Box,regions:regions.map(r=>r.bbox)}))];
}

export function questionSourceUrl(q:SegmentedQuestion,source:QuestionSource,sha256?:string){return questionPdfUrl(q,source.source_page,sha256)??(q.source_pdf_available===false?asset(source.source_page_image||q.cropped_question_image):asset(q.source_pdf)+`#page=${source.source_page}`);}
